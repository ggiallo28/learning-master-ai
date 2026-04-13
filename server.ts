import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "db.json");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const upload = multer({ storage: multer.memoryStorage() });

  app.post("/api/extract-pdf", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const data = await pdf(req.file.buffer);
      res.json({ text: data.text });
    } catch (error) {
      console.error("PDF extraction error:", error);
      res.status(500).json({ error: "Failed to extract text from PDF" });
    }
  });

  // API Routes for persistence
  app.get("/api/data", async (req, res) => {
    try {
      const data = await fs.readFile(DB_PATH, "utf-8");
      res.json(JSON.parse(data));
    } catch (error) {
      // If file doesn't exist, return empty data
      res.json({ notes: [], results: [] });
    }
  });

  app.post("/api/data", async (req, res) => {
    try {
      await fs.writeFile(DB_PATH, JSON.stringify(req.body, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save data to local file system" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
