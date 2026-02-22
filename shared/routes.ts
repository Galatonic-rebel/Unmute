import { z } from 'zod';
import { insertTranslationSchema, translations } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  translations: {
    list: {
      method: 'GET' as const,
      path: '/api/translations' as const,
      responses: {
        200: z.array(z.custom<typeof translations.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/translations' as const,
      input: insertTranslationSchema,
      responses: {
        201: z.custom<typeof translations.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  deepgram: {
    // We'll proxy requests or return a temporary token for the client to use
    // For this implementation we will issue temporary tokens for the frontend to connect directly
    token: {
      method: 'GET' as const,
      path: '/api/deepgram/token' as const,
      responses: {
        200: z.object({
          key: z.string(),
        }),
        500: errorSchemas.internal,
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type TranslationInput = z.infer<typeof api.translations.create.input>;
export type TranslationResponse = z.infer<typeof api.translations.create.responses[201]>;
export type TranslationsListResponse = z.infer<typeof api.translations.list.responses[200]>;
