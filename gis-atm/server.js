// server.js
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import compression from "compression";
import helmet from "helmet";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5000;

// ---- FILE DỮ LIỆU CHÍNH (HYBRID) ----
const DATA_FILE = path.join(__dirname, "data", "atm-cantho-hybrid.json");

// ---- MIDDLEWARE ----
app.use(helmet({ contentSecurityPolicy: false })); // gọn cho dev
app.use(compression());

// ---- STATIC ----
app.use(express.static(path.join(__dirname, "public")));              // serve /public
app.use("/data", express.static(path.join(__dirname, "data"), {      // expose /data
  maxAge: "1h",
  etag: true
}));

// ---- API ----
app.get("/api/atm", async (_req, res) => {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    res.json(JSON.parse(raw)); // mảng [{lat,lng,bank,name,...}]
  } catch (e) {
    console.error("read hybrid error:", e);
    res.status(500).json({ error: "Không đọc được dữ liệu ATM hybrid" });
  }
});

// ---- HEALTH ----
app.get("/health", (_req, res) => res.json({ ok: true }));

// ---- 404 & ERROR ----
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// ---- START ----
app.listen(PORT, () => {
  console.log(`GIS ATM server at http://localhost:${PORT}`);
  console.log(`Serving data from: ${DATA_FILE}`);
});
