import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ImportManager } from "./ImportManager";

const fixture = vi.hoisted(() => ({ language: "ko" }));
vi.mock("../hooks/use-api", () => ({
  useApi: (path: string) => ({ data: path === "/project" ? { language: fixture.language } : { books: [] } }),
}));

describe("import authored language", () => {
  it.each(["zh", "en", "ko"])("defaults fanfic and imitation forms to %s rather than UI copy language", (language) => {
    fixture.language = language;
    for (const initialTab of ["fanfic", "imitation"] as const) {
      const markup = renderToStaticMarkup(createElement(ImportManager, {
        nav: { toDashboard() {}, toBook() {} }, theme: "dark", t: (key: string) => key, initialTab,
      }));
      expect(markup).toContain(`value="${language}" selected=""`);
      expect(markup).toContain('value="ko"');
    }
  });
});
