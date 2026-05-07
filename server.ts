import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '10mb' }));

  const apiKey = process.env.GEMINI_API_KEY || "";
  const genAI = new GoogleGenAI(apiKey as any) as any;

  // --- API Routes ---

  app.post("/api/analyze", async (req, res) => {
    try {
      const { image } = req.body;
      const model = (genAI as any).getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Analyze this image as a Vision Transformer (ViT). 
      Provide the primary classification label, a confidence score (0-1), a brief explanation of why the model might classify it this way, and the top 3 alternative classes.
      Return as JSON.`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: image.split(',')[1], mimeType: "image/jpeg" } }
      ]);
      
      const text = result.response.text();
      const cleaned = text.replace(/^```json\n?/, '').replace(/n?```$/, '').trim();
      res.json(JSON.parse(cleaned));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Analysis failed" });
    }
  });

  app.post("/api/attention", async (req, res) => {
    try {
      const { image } = req.body;
      const model = (genAI as any).getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Divide this image into an 8x8 grid of patches. For each patch, estimate its 'attention importance' (0 to 1) for the classification of the main object.
      Return a flat array of 64 patch objects with x, y coordinates and importance values.
      Also provide a brief summary of which regions the ViT is 'attending' to most.
      Return as JSON.`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: image.split(',')[1], mimeType: "image/jpeg" } }
      ]);
      
      const text = result.response.text();
      const cleaned = text.replace(/^```json\n?/, '').replace(/n?```$/, '').trim();
      res.json(JSON.parse(cleaned));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Attention map generation failed" });
    }
  });

  app.post("/api/attack", async (req, res) => {
    try {
      const { image, attackType, epsilon } = req.body;
      const model = (genAI as any).getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Simulate an adversarial attack (${attackType}) on this image with epsilon=${epsilon}.
      How would a Vision Transformer's classification change? 
      Give me the new label, the new confidence, and an explanation of the adversarial effect.
      Return as JSON.`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: image.split(',')[1], mimeType: "image/jpeg" } }
      ]);
      
      const text = result.response.text();
      const cleaned = text.replace(/^```json\n?/, '').replace(/n?```$/, '').trim();
      res.json(JSON.parse(cleaned));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Attack simulation failed" });
    }
  });

  // --- Vite & Static Handling ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
