// server.js
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { runFetch } from "./scripts/fetch_overpass.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// file gốc (fetch_overpass tạo)
const RAW_FILE = path.join(__dirname, "data", "atm_cantho.json");
// file đã enrich bằng parse-hybrid.cjs
const HYBRID_FILE = path.join(__dirname, "data", "atm-cantho-hybrid.json");

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/atm", async (req, res) => {
  try {
    // ưu tiên hybrid
    let fileToRead = RAW_FILE;

    try {
      // nếu tồn tại hybrid thì dùng
      await fs.access(HYBRID_FILE);
      fileToRead = HYBRID_FILE;
    } catch (e) {
      // không có hybrid thì thôi, dùng RAW_FILE
    }

    const raw = await fs.readFile(fileToRead, "utf8");
    const json = JSON.parse(raw);
    res.json(json);
  } catch (err) {
    console.error("read atm error:", err);
    res.status(500).json({ error: "Không đọc được dữ liệu ATM" });
  }
});

// fetch 1 lần khi khởi động (cái này tạo atm_cantho.json)
(async () => {
  try {
    await runFetch();
  } catch (err) {
    console.error("Initial fetch failed:", err);
  }
})();

// cron 6 tiếng/lần
cron.schedule("0 */6 * * *", async () => {
  console.log("[cron] running fetch_overpass...");
  try {
    await runFetch();
  } catch (err) {
    console.error("[cron] fetch failed:", err);
  }
});

app.listen(PORT, () => {
  console.log(`GIS ATM server is running at http://localhost:${PORT}`);
});
