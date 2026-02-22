import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// We're keeping things simple: no auth needed for MVP unless requested.
// We'll store basic translation history so it feels like a real app.

export const translations = pgTable("translations", {
  id: serial("id").primaryKey(),
  originalText: text("original_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTranslationSchema = createInsertSchema(translations).pick({
  originalText: true,
});

export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
export type Translation = typeof translations.$inferSelect;

// Request types
export type CreateTranslationRequest = InsertTranslation;

// Response types
export type TranslationResponse = Translation;
export type TranslationsListResponse = Translation[];
