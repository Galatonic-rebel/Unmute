import { db } from "./db";
import {
  translations,
  type CreateTranslationRequest,
  type TranslationResponse
} from "@shared/schema";

export interface IStorage {
  getTranslations(): Promise<TranslationResponse[]>;
  createTranslation(translation: CreateTranslationRequest): Promise<TranslationResponse>;
}

export class DatabaseStorage implements IStorage {
  async getTranslations(): Promise<TranslationResponse[]> {
    return await db.select().from(translations).orderBy(translations.createdAt);
  }

  async createTranslation(translation: CreateTranslationRequest): Promise<TranslationResponse> {
    const [created] = await db.insert(translations)
      .values(translation)
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();