import { expect, it } from "vitest";
import { resolveCliLanguage, formatWriteNextResultLines, formatBookCreateNextStep } from "../localization.js";
it("recognizes explicit and environment Korean locales and counts characters", () => {
  expect(resolveCliLanguage("ko")).toBe("ko");
  expect(resolveCliLanguage(undefined, { LANG: "ko_KR.UTF-8" })).toBe("ko");
  const output = formatWriteNextResultLines("ko", { chapterNumber: 1, title: "도착", wordCount: 1552, observations: [] }).join("\n");
  expect(output).toContain("1552자");
  expect(output).not.toMatch(/words|字|Length|Chapter/);
  expect(formatBookCreateNextStep("ko", "book-test")).toContain("inkos write next book-test");
});
