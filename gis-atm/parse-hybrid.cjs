// parse-hybrid.cjs
// Tạo file data/atm-cantho-hybrid.json từ Overpass + ranh giới
// Chạy: node parse-hybrid.cjs

const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");

// ====== CẤU HÌNH ======
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const BBOX = "9.95,105.60,10.25,105.85";
const DATA_DIR = path.join(__dirname, "data");
const ADMIN_FILE = path.join(DATA_DIR, "ranhgioi.geojson");
const OUT_FILE = path.join(DATA_DIR, "atm-cantho-hybrid.json");

// GIỚI HẠN reverse để không chạy quá lâu
const MAX_REVERSE = 40;
const NOMINATIM_DELAY = 1100;

// ====== QUERY ======
const OVERPASS_QUERY = `
[out:json][timeout:60];
(
  node["amenity"="atm"](${BBOX});
  way["amenity"="atm"](${BBOX});
  node["amenity"="bank"](${BBOX});
  way["amenity"="bank"](${BBOX});
);
out center tags;
`;

async function fetchOverpass() {
  console.log("→ Đang gọi Overpass...");
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(OVERPASS_QUERY),
  });
  if (!res.ok) {
    throw new Error("Overpass lỗi: " + res.status + " " + res.statusText);
  }
  const data = await res.json();
  console.log(`→ Nhận được ${data.elements.length} đối tượng từ Overpass.`);
  return data.elements || [];
}

function buildAddressFromTags(tags) {
  if (!tags) return null;
  if (tags["addr:full"]) return tags["addr:full"];
  const parts = [];
  if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
  if (tags["addr:street"]) parts.push(tags["addr:street"]);
  if (tags["addr:suburb"]) parts.push(tags["addr:suburb"]);
  if (tags["addr:city"]) parts.push(tags["addr:city"]);
  if (tags["addr:district"]) parts.push(tags["addr:district"]);
  if (tags["addr:province"]) parts.push(tags["addr:province"]);
  return parts.length ? parts.join(", ") : null;
}

async function reverseNominatim(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "ctut-atm-mapper/1.0",
    },
  });
  if (!res.ok) {
    console.warn("⚠️ Nominatim lỗi:", res.status);
    return null;
  }
  const data = await res.json();
  return data.display_name || null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadAdminGeoJSON() {
  if (fs.existsSync(ADMIN_FILE)) {
    console.log("→ Đang nạp ranh giới từ", ADMIN_FILE);
    const raw = fs.readFileSync(ADMIN_FILE, "utf8");
    return JSON.parse(raw);
  }
  console.log("⚠️ Không tìm thấy ranh giới → bỏ qua gán quận/huyện.");
  return null;
}

// ✅ phiên bản an toàn
function getDistrictNameFromPoly(lat, lon, adminGJ) {
  if (!adminGJ) return null;
  const pt = turf.point([lon, lat]);

  for (const f of adminGJ.features || []) {
    if (!f || !f.geometry) continue;

    const g = f.geometry;
    // chỉ nhận Polygon / MultiPolygon có tọa độ
    const isPoly =
      (g.type === "Polygon" || g.type === "MultiPolygon") &&
      Array.isArray(g.coordinates) &&
      g.coordinates.length > 0;

    if (!isPoly) continue;

    // tạo feature sạch để turf dùng
    const featurePoly = {
      type: "Feature",
      properties: f.properties || {},
      geometry: g,
    };

    let inside = false;
    try {
      inside = turf.booleanPointInPolygon(pt, featurePoly);
    } catch (e) {
      // có feature lỗi hình học → bỏ qua
      continue;
    }

    if (inside) {
      const p = f.properties || {};
      return (
        p.NAME_2 ||
        p.name_2 ||
        p.NAME2 ||
        p.TEN_QH ||
        p.district ||
        p.name ||
        null
      );
    }
  }

  return null;
}

function elementToPoint(el) {
  let lat = el.lat;
  let lon = el.lon;
  if ((!lat || !lon) && el.center) {
    lat = el.center.lat;
    lon = el.center.lon;
  }
  if (!lat || !lon) return null;

  const tags = el.tags || {};
  const amenity = tags.amenity || (tags.bank ? "bank" : null);
  const bankName =
    tags.bank ||
    tags["name:vi"] ||
    tags.name ||
    tags.operator ||
    tags.brand ||
    null;

  return {
    id: `osm_${el.type}_${el.id}`,
    osm_id: el.id,
    osm_type: el.type,
    amenity,
    bank: bankName,
    name: tags.name || bankName || "Điểm ngân hàng / ATM",
    lat,
    lng: lon,
    tags,
  };
}

(async () => {
  try {
    const elements = await fetchOverpass();
    const adminGJ = loadAdminGeoJSON();

    let items = elements.map(elementToPoint).filter(Boolean);
    console.log("→ Sau khi chuẩn hóa còn:", items.length, "điểm hợp lệ.");

    // 1) gán địa chỉ từ tags
    for (const it of items) {
      it.address = buildAddressFromTags(it.tags);
    }

    // 2) reverse một phần
    let reversed = 0;
    for (const it of items) {
      if (reversed >= MAX_REVERSE) break;
      if (!it.address) {
        console.log(`→ Reverse địa chỉ cho ${it.id} (${it.lat},${it.lng})`);
        const addr = await reverseNominatim(it.lat, it.lng);
        if (addr) {
          it.address = addr;
          it.address_source = "nominatim";
        } else {
          it.address = "Không có địa chỉ cụ thể";
          it.address_source = "fallback";
        }
        reversed++;
        await sleep(NOMINATIM_DELAY);
      }
    }

    // 3) gán quận/huyện (bọc try/catch để không chết giữa chừng)
    for (const it of items) {
      if (!adminGJ) break;
      try {
        const qh = getDistrictNameFromPoly(it.lat, it.lng, adminGJ);
        if (qh) it.district = qh;
      } catch (e) {
        // bỏ qua điểm này
      }
    }

    // 4) output
    const output = items.map((it) => ({
      id: it.id,
      osm_id: it.osm_id,
      osm_type: it.osm_type,
      amenity: it.amenity,
      bank: it.bank,
      name: it.name,
      address: it.address || "Không có địa chỉ cụ thể",
      district: it.district || null,
      lat: it.lat,
      lng: it.lng,
      opening_hours: it.tags?.opening_hours || null,
      source: it.address_source || "tags+overpass",
    }));

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf8");
    console.log("✅ Đã ghi xong file:", OUT_FILE);
  } catch (err) {
    console.error("❌ Lỗi:", err);
  }
})();
