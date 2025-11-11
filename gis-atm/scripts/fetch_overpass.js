// scripts/fetch_overpass.js
import fs from "fs/promises";
import fetch from "node-fetch";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// 👇 File ĐANG SỬ DỤNG để hiển thị
const DATA_FILE = path.join(__dirname, "..", "data", "atm-cantho-hybrid.json");

const BBOX = "9.90,105.60,10.20,105.95"; // Cần Thơ
const OVERPASS_QUERY = `
[out:json][timeout:25];
(
  node["amenity"="atm"](${BBOX});
  node["amenity"="bank"](${BBOX});
);
out center tags;
`;

async function fetchOverpass() {
  const url = "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "ct-cantho-atm-map/1.0"
    },
    body: "data=" + encodeURIComponent(OVERPASS_QUERY)
  });
  if (!res.ok) throw new Error("Overpass error: " + res.status);
  const data = await res.json();
  const els = data.elements || [];
  return els.map((e) => {
    const t = e.tags || {};
    const addr = [
      t["addr:housenumber"], t["addr:street"], t["addr:city"]
    ].filter(Boolean).join(", ");
    return {
      osm_id: String(e.id),
      lat: e.lat ?? e.center?.lat ?? null,
      lng: e.lon ?? e.center?.lon ?? null,
      bank: (t.operator || t.brand || t.name || "ATM")?.trim(),
      name: t.name || null,
      address: addr || null,
      amenity: t.amenity || "atm",
      raw_tags: t,
      source: "overpass",
      updated_at: new Date().toISOString(),
    };
  });
}

async function readJson(file) {
  try {
    const raw = await fs.readFile(file, "utf8");
    const json = JSON.parse(raw);
    // đảm bảo là mảng
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function runAppendOnly() {
  console.log("[append-only] fetch Overpass…");
  const fresh = await fetchOverpass();                 // danh sách mới
  const current = await readJson(DATA_FILE);           // dữ liệu đang dùng

  const seen = new Set(current.map(x => String(x.osm_id)));
  const toAdd = [];
  for (const v of fresh) {
    const key = String(v.osm_id);
    if (!seen.has(key)) {           // 👈 chỉ thêm khi CHƯA có
      toAdd.push(v);
      seen.add(key);
    }
  }

  if (toAdd.length) {
    const merged = current.concat(toAdd);
    await writeJson(DATA_FILE, merged);
    console.log(`[append-only] added ${toAdd.length} new item(s). total=${merged.length}`);
  } else {
    console.log("[append-only] no new items – do nothing");
  }
}

// Chạy tay: node scripts/fetch_overpass.js
if (import.meta.url === `file://${process.argv[1]}`) {
  runAppendOnly().catch(e => { console.error(e); process.exit(1); });
}

// Đọc file dữ liệu đang dùng (ví dụ data/atm-cantho-hybrid.json)

// Gọi Overpass

// Chỉ thêm các phần tử có osm_id chưa tồn tại trong file hiện có

// Ghi lại file (giữ nguyên các bản ghi cũ)