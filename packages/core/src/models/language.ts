import { z } from "zod";

export const LanguageSchema = z.enum(["zh", "en", "ko"]);
export type Language = z.infer<typeof LanguageSchema>;

/** A stored work language is free text; only the supported set reaches typed consumers. */
export function asLanguage(value: string | undefined, fallback: Language = "zh"): Language {
  const parsed = LanguageSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}
