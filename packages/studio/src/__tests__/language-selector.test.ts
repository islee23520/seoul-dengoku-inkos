import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LanguageSelector } from "../pages/LanguageSelector.js";
it("offers Korean alongside the existing authored languages", () => {
  const markup = renderToStaticMarkup(createElement(LanguageSelector, { onSelect: () => {} }));
  expect(markup.match(/<button/g)).toHaveLength(3);
  expect(markup).toContain("한국어");
  expect(markup).toContain("中文创作");
  expect(markup).toContain("English Writing");
});

