// scripts/fetch_overpass.js
import fs from "fs/promises";
import fetch from "node-fetch";
import crypto from "crypto";

const OUT_FILE = "./data/atm_cantho.json";
const BBOX = "9.90,105.60,10.20,105.95"; // Cần Thơ

const OVERPASS_QUERY = `
[out:json][timeout:25];
(
  node["amenity"="atm"](${BBOX});
  node["amenity"="bank"](${BBOX});
);
out center tags;
`;

function hashObj(o) {
  return crypto.createHash("md5").update(JSON.stringify(o)).digest("hex");
}

async function fetchOverpass() {
  const url = "https://overpass-api.de/api/interpreter";
  const res = await fetch(url, { method: "POST", body: OVERPASS_QUERY });
  if (!res.ok) throw new Error("Overpass error: " + res.status);
  const data = await res.json();
  const elements = data.elements || [];
  return elements.map((e) => {
    const tags = e.tags || {};
    const addrParts = [];
    if (tags["addr:housenumber"]) addrParts.push(tags["addr:housenumber"]);
    if (tags["addr:street"]) addrParts.push(tags["addr:street"]);
    if (tags["addr:city"]) addrParts.push(tags["addr:city"]);
    return {
      osm_id: e.id,
      lat: e.lat ?? e.center?.lat ?? null,
      lng: e.lon ?? e.center?.lon ?? null,
      bank: tags.operator || tags.brand || tags.name || "ATM",
      name: tags.name || null,
      address: addrParts.join(", "),
      amenity: tags.amenity || "atm",
      raw_tags: tags,
      source: "overpass",
      updated_at: new Date().toISOString(),
    };
  });
}

async function readOld() {
  try {
    const raw = await fs.readFile(OUT_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function detectDiffs(oldList, newList) {
  const oldMap = new Map(oldList.map((x) => [String(x.osm_id), x]));
  const newMap = new Map(newList.map((x) => [String(x.osm_id), x]));
  const added = [];
  const removed = [];
  const changed = [];

  for (const [k, v] of newMap) {
    if (!oldMap.has(k)) added.push(v);
    else {
      const old = oldMap.get(k);
      const hOld = hashObj({
        lat: old.lat,
        lng: old.lng,
        bank: old.bank,
        address: old.address,
      });
      const hNew = hashObj({
        lat: v.lat,
        lng: v.lng,
        bank: v.bank,
        address: v.address,
      });
      if (hOld !== hNew) changed.push({ old, new: v });
    }
  }

  for (const [k, v] of oldMap) {
    if (!newMap.has(k)) removed.push(v);
  }

  return { added, removed, changed };
}

async function writeOut(list) {
  await fs.writeFile(OUT_FILE, JSON.stringify(list, null, 2), "utf8");
  console.log("[fetch_overpass] wrote", OUT_FILE, "items:", list.length);
}

export async function runFetch() {
  console.log("[fetch_overpass] fetching overpass...");
  const fresh = await fetchOverpass();
  const old = await readOld();
  const { added, removed, changed } = detectDiffs(old, fresh);
  console.log(
    `[fetch_overpass] added=${added.length} removed=${removed.length} changed=${changed.length}`
  );
  if (!old.length || added.length || removed.length || changed.length) {
    await writeOut(fresh);
  } else {
    console.log("[fetch_overpass] no changes – skip write");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFetch().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
