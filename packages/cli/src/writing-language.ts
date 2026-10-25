import { BookConfigSchema } from "@actalk/inkos-core";

// Authored language is independent of the CLI's supported UI locales.
export const LanguageSchema = BookConfigSchema.shape.language;
