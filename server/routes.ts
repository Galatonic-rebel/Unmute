import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Deepgram Token Route
  // In a real app, we proxy to deepgram or use a secure temporary key mechanism
  // For the MVP, we use the env variable and give it directly (with a short-lived key if possible)
  app.get(api.deepgram.token.path, async (req, res) => {
    try {
      const apiKey = process.env.DEEPGRAM_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Deepgram API key not configured" });
      }
      
      // Optionally we could generate a temporary token using the Deepgram SDK here
      // But passing the key directly to frontend for MVP simplicity
      res.json({ key: apiKey });
    } catch (error) {
      console.error("Error issuing deepgram token:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.translations.list.path, async (req, res) => {
    try {
      const allTranslations = await storage.getTranslations();
      res.json(allTranslations);
    } catch (err) {
      console.error("Error fetching translations:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.translations.create.path, async (req, res) => {
    try {
      const input = api.translations.create.input.parse(req.body);
      const created = await storage.createTranslation(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      console.error("Error creating translation:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/polish-sentence", async (req, res) => {
    try {
      const schema = z.object({ words: z.array(z.string()).min(1) });
      const { words } = schema.parse(req.body);

      const deepseek = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com",
      });

      const completion = await deepseek.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are an ASL to English translator. Given a sequence of ASL signs (words), form a natural, grammatically correct English sentence. ASL grammar differs from English — signs may be in a different order and lack articles/prepositions. Output ONLY the polished sentence, nothing else.",
          },
          {
            role: "user",
            content: `ASL signs in order: ${words.join(" ")}`,
          },
        ],
        max_tokens: 256,
      });

      const sentence = completion.choices[0]?.message?.content?.trim() || words.join(" ");
      res.json({ sentence });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input: words array required" });
      }
      console.error("Error polishing sentence:", err);
      res.status(500).json({ message: "Failed to polish sentence" });
    }
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const schema = z.object({
        text: z.string().min(1),
        voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).default("nova"),
      });
      const { text, voice } = schema.parse(req.body);

      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-audio",
        modalities: ["text", "audio"],
        audio: { voice, format: "wav" },
        messages: [
          { role: "system", content: "You are a text-to-speech assistant. Repeat the user's text exactly as given, with natural intonation." },
          { role: "user", content: text },
        ],
      });

      const audioData = (response.choices[0]?.message as any)?.audio?.data ?? "";
      if (!audioData) {
        return res.status(500).json({ message: "No audio generated" });
      }

      const audioBuffer = Buffer.from(audioData, "base64");
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", audioBuffer.length);
      res.send(audioBuffer);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input: text required" });
      }
      console.error("Error generating TTS:", err);
      res.status(500).json({ message: "Failed to generate speech" });
    }
  });

  return httpServer;
}