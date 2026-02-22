import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

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

  return httpServer;
}