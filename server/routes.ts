import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

/**
 * Registers all API route handlers on the Express application.
 *
 * Routes:
 * - GET  /api/deepgram/token     — Returns Deepgram API key for client-side speech recognition
 * - GET  /api/translations       — Lists all saved translation history entries
 * - POST /api/translations       — Creates a new translation history entry (validated via Zod)
 * - POST /api/polish-sentence    — Uses DeepSeek LLM to convert raw ASL word sequence to natural English
 * - POST /api/tts                — Generates speech audio from text using OpenAI TTS model
 *
 * @param httpServer - Node.js HTTP server instance
 * @param app - Express application instance
 * @returns The HTTP server (pass-through for chaining)
 */
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  /**
   * GET /api/deepgram/token
   * Returns the Deepgram API key for client-side real-time speech-to-text.
   * In production, this should generate short-lived scoped tokens instead.
   */
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

  /**
   * GET /api/translations
   * Retrieves all translation history entries from storage, ordered by creation time.
   */
  app.get(api.translations.list.path, async (req, res) => {
    try {
      const allTranslations = await storage.getTranslations();
      res.json(allTranslations);
    } catch (err) {
      console.error("Error fetching translations:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * POST /api/translations
   * Creates a new translation record. Request body is validated against
   * the shared Zod schema before persistence.
   */
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

  /**
   * POST /api/polish-sentence
   * Accepts an array of raw ASL sign words and uses the DeepSeek LLM to
   * reconstruct a grammatically correct English sentence, accounting for
   * ASL-to-English word order differences and missing articles/prepositions.
   */
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

  /**
   * POST /api/tts
   * Generates WAV audio from text using OpenAI's audio-capable model.
   * Supports voice selection (alloy, echo, fable, onyx, nova, shimmer).
   * Returns raw audio/wav binary response.
   */
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

      interface AudioChatMessage {
        audio?: { data?: string };
      }
      const audioData = (response.choices[0]?.message as AudioChatMessage)?.audio?.data ?? "";
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