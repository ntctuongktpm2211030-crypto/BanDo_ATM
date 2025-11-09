// parse.js
// Chuyển file văn bản banks-atm.txt thành atm-cantho.json
// Chạy: node parse.js

const fs = require("fs");

// 1. đọc dữ liệu thô
const RAW_FILE = "banks-atm.txt";
const OUT_FILE = "atm-cantho.json";

if (!fs.existsSync(RAW_FILE)) {
  console.error(`❌ Không tìm thấy file ${RAW_FILE}.`);
  process.exit(1);
}

const raw = fs.readFileSync(RAW_FILE, "utf8");

// 2. tách dòng và bỏ dòng trống
const lines = raw
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

// 3. HÀM PHỤ

function guessBrand(name = "") {
  const n = name.toLowerCase();
  const banks = [
    "vietcombank", "bidv", "vietinbank", "acb", "techcombank", "vpbank",
    "vib", "ocb", "mb", "mb bank", "sacombank", "pvcombank", "shb",
    "lpbank", "abbank", "dong a", "msb", "kienlong", "hdbank",
    "eximbank", "woori", "baoviet", "vietbank", "maritime", "oceanbank"
  ];
  for (const b of banks) if (n.includes(b)) return b.toUpperCase();
  return null;
}

function extractLastLatLng(line) {
  const all = [...line.matchAll(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/g)];
  if (!all.length) return null;
  const last = all[all.length - 1];
  return { lat: parseFloat(last[1]), lng: parseFloat(last[2]), index: last.index };
}

function splitNameAddress(before) {
  const numPos = before.search(/\d/);
  if (numPos > 0)
    return { name: before.slice(0, numPos).trim(), address: before.slice(numPos).trim() };
  const lastComma = before.lastIndexOf(",");
  if (lastComma > 0)
    return { name: before.slice(0, lastComma).trim(), address: before.slice(lastComma + 1).trim() };
  return { name: before.trim(), address: "" };
}

// 4. BẮT ĐẦU PARSE
let currentAmenity = "bank";
const out = [];

for (const line of lines) {
  if (line.startsWith("#")) {
    if (line.toLowerCase().includes("atm")) currentAmenity = "atm";
    else currentAmenity = "bank";
    continue;
  }

  const ll = extractLastLatLng(line);
  if (!ll) continue;

  const before = line.slice(0, ll.index).trim();
  const after = line.slice(ll.index).replace(/-?\d+\.\d+,\s*-?\d+\.\d+/, "").trim();

  const { name, address } = splitNameAddress(before);

  const obj = {
    name,
    address,
    lat: ll.lat,
    lng: ll.lng,
    opening_hours: after || null,
    amenity: currentAmenity,
  };
  const brand = guessBrand(name);
  if (brand) obj.bank = brand;

  out.push(obj);
}

// 5. Ghi file JSON
fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
console.log(`✅ Đã tạo ${OUT_FILE} với ${out.length} điểm dữ liệu.`);
