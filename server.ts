import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { createRequire } from "module";
import { bedrockGenerate, bedrockEmbed, bedrockChat, bedrockChatStream } from "./bedrock.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "db.json");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

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
      console.log(`Received data sync request, body size: ${JSON.stringify(req.body).length} bytes`);
      await fs.writeFile(DB_PATH, JSON.stringify(req.body, null, 2));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save data:", error);
      res.status(500).json({ error: "Failed to save data to local file system" });
    }
  });

  // Bedrock AI API routes (only active when AI_PROVIDER=bedrock)
  if (process.env.AI_PROVIDER === "bedrock") {
    // Embedding endpoint
    app.post("/api/ai/embed", async (req, res) => {
      try {
        const { text } = req.body;
        if (!text) {
          return res.status(400).json({ error: "Missing 'text' parameter" });
        }
        const embedding = await bedrockEmbed(text);
        res.json({ embedding });
      } catch (error) {
        console.error("Bedrock embed error:", error);
        res.status(500).json({ error: "Failed to generate embedding" });
      }
    });

    // Text generation endpoint
    app.post("/api/ai/generate", async (req, res) => {
      try {
        const { prompt, systemPrompt, jsonMode, image } = req.body;
        if (!prompt) {
          return res.status(400).json({ error: "Missing 'prompt' parameter" });
        }
        const text = await bedrockGenerate(prompt, systemPrompt, jsonMode);
        res.json({ text });
      } catch (error) {
        console.error("Bedrock generate error:", error);
        res.status(500).json({ error: "Failed to generate content" });
      }
    });

    // Streaming chat endpoint with tool use
    app.post("/api/ai/chat", async (req, res) => {
      try {
        const { messages, systemPrompt, notes, tools } = req.body;

        // Set up SSE response
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");

        // Convert messages to Bedrock format
        const bedrockMessages = (messages || []).map((msg: any) => ({
          role: msg.role || "user",
          content: [{ text: typeof msg.content === 'string' ? msg.content : (msg.content?.[0]?.text || "") }],
        }));

        try {
          const { text, toolCalls } = await bedrockChat(
            bedrockMessages,
            systemPrompt,
            notes,
            tools,
            (token: string) => {
              res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n`);
            }
          );

          // Stream tool calls (UI-affecting ones that need client-side handling)
          for (const toolCall of toolCalls) {
            res.write(`data: ${JSON.stringify({ type: "tool_call", name: toolCall.name, args: toolCall.args })}\n`);
          }

          res.write(`data: ${JSON.stringify({ type: "done", text })}\n`);
          res.write("data: [DONE]\n");
          res.end();
        } catch (chatError) {
          console.error("Chat error:", chatError);
          res.write(`data: ${JSON.stringify({ type: "error", message: "Chat failed" })}\n`);
          res.end();
        }
      } catch (error) {
        console.error("Chat endpoint error:", error);
        res.status(500).json({ error: "Chat endpoint error" });
      }
    });
  }

  // Streaming organize endpoint
  if (process.env.AI_PROVIDER === "bedrock") {
    app.post("/api/ai/organize-stream", async (req, res) => {
      try {
        const { text, systemPrompt, availableModules } = req.body;

        // Set up SSE response
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");

        const result = await bedrockGenerate(
          `Organize this note: ${text}`,
          systemPrompt,
          true
        );

        try {
          const data = JSON.parse(result);
          const notes = data.notes || [];

          // Stream each note as it's parsed
          for (const note of notes) {
            res.write(`data: ${JSON.stringify({ type: "note", data: note })}\n\n`);
          }
        } catch (parseError) {
          console.error("Parse error in organize-stream:", parseError);
          res.write(`data: ${JSON.stringify({ type: "error", message: "Failed to parse notes" })}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
      } catch (error) {
        console.error("Organize stream error:", error);
        res.write(`data: ${JSON.stringify({ type: "error", message: "Failed to organize notes" })}\n\n`);
        res.end();
      }
    });
  }

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

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
