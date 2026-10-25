import { describe, expect, it } from "vitest";
import { normalizeStudioLanguage, normalizeWorkLanguage, resolveStudioAgentLanguage } from "./language.js";

describe("Studio authored language and UI locale", () => {
  it.each(["zh", "en", "ko"] as const)("preserves %s for new work and agent execution", (language) => {
    expect(normalizeWorkLanguage(language)).toBe(language);
    expect(resolveStudioAgentLanguage(language, undefined, undefined)).toBe(language);
    expect(resolveStudioAgentLanguage("zh", undefined, language)).toBe(language);
    expect(resolveStudioAgentLanguage("en", language, undefined)).toBe(language);
  });

  it("keeps the committed work language ahead of a creation request", () => {
    expect(resolveStudioAgentLanguage("zh", "ko", "en")).toBe("ko");
    expect(resolveStudioAgentLanguage("ko", "en", "zh")).toBe("en");
  });

  it("falls back only for unsupported or missing stored languages", () => {
    expect(normalizeWorkLanguage(undefined)).toBe("zh");
    expect(normalizeWorkLanguage("fr", "ko")).toBe("ko");
    expect(resolveStudioAgentLanguage("ko", "fr", undefined)).toBe("ko");
  });

  it("uses existing Studio copy without changing Korean authored language", () => {
    const language = resolveStudioAgentLanguage("zh", undefined, "ko");
    expect(normalizeStudioLanguage(language)).toBe("zh");
    expect(language).toBe("ko");
    expect(normalizeStudioLanguage("en")).toBe("en");
    expect(normalizeStudioLanguage("zh")).toBe("zh");
  });
});
