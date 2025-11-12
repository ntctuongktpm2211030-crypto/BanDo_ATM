// scripts/extract_banks.js
import fs from "fs";
import path from "path";

// ✅ Đường dẫn file dữ liệu gốc
const inputFile = "D:/TTDL_BCN/gis-atm/data/atm-cantho-hybrid.json";

// ✅ Đường dẫn file xuất kết quả
const outputFile = "D:/TTDL_BCN/gis-atm/data/banks-list.json";

// Đọc file JSON gốc
const raw = fs.readFileSync(inputFile, "utf8");
let data = JSON.parse(raw);

// Nếu file không phải mảng thì chuyển thành mảng
if (!Array.isArray(data)) data = [data];

// Lấy danh sách tên ngân hàng duy nhất
const uniqueBanks = [
  ...new Set(
    data
      .map((item) => item.bank?.trim())
      .filter((name) => !!name)
  ),
].sort();

// Ghi ra file JSON (đẹp, dễ đọc)
fs.writeFileSync(outputFile, JSON.stringify(uniqueBanks, null, 2), "utf8");

console.log(`✅ Đã xuất danh sách ${uniqueBanks.length} ngân hàng duy nhất vào:`);
console.log(outputFile);
