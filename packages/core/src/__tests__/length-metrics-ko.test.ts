import { describe, it, expect } from "vitest";
import {
  buildLengthSpec,
  countChapterLength,
  defaultChapterLength,
  formatLengthCount,
  resolveLengthCountingMode,
  DEFAULT_CHAPTER_LENGTH_EN,
  DEFAULT_CHAPTER_LENGTH_KO,
  DEFAULT_CHAPTER_LENGTH_ZH,
} from "../utils/length-metrics.js";

describe("length metrics — Korean", () => {
  it("counts Korean prose as space-stripped characters", () => {
    const sample = "그는 하늘을 바라보았다. 바람이 불었다.";
    const stripped = sample.replace(/\s+/g, "");

    expect(countChapterLength(sample, resolveLengthCountingMode("ko"))).toBe(stripped.length);
    expect(stripped.length).toBe(18);
    expect(countChapterLength(sample, "zh_chars")).toBe(stripped.length);
  });

  it("ignores spaces and markdown chrome the same way zh_chars does", () => {
    const markdownChapter = [
      "---",
      "title: 제1장 귀환",
      "---",
      "",
      "# 제1장 귀환",
      "",
      "그는 하늘을 바라보았다.",
    ].join("\n");

    expect(countChapterLength(markdownChapter, resolveLengthCountingMode("ko"))).toBe(
      "그는하늘을바라보았다.".length,
    );
  });

  it("defaults a Korean chapter to 4000 space-stripped characters", () => {
    expect(defaultChapterLength("ko")).toBe(4000);
    expect(DEFAULT_CHAPTER_LENGTH_KO).toBe(4000);
    expect(resolveLengthCountingMode("ko")).toBe("zh_chars");
    expect(buildLengthSpec(4000, "ko")).toEqual({
      target: 4000,
      countingMode: "zh_chars",
    });
  });

  it("renders a Korean unit label without changing zh or en labels", () => {
    expect(formatLengthCount(4000, "zh_chars", "ko")).toBe("4000자");
    expect(formatLengthCount(3000, "zh_chars")).toBe("3000字");
    expect(formatLengthCount(3000, "zh_chars", "zh")).toBe("3000字");
    expect(formatLengthCount(2000, "en_words")).toBe("2000 words");
    expect(formatLengthCount(2000, "en_words", "en")).toBe("2000 words");
  });

  it("leaves Chinese and English defaults unchanged", () => {
    expect(defaultChapterLength("zh")).toBe(3000);
    expect(defaultChapterLength("en")).toBe(2000);
    expect(defaultChapterLength()).toBe(3000);
    expect(DEFAULT_CHAPTER_LENGTH_ZH).toBe(3000);
    expect(DEFAULT_CHAPTER_LENGTH_EN).toBe(2000);
    expect(resolveLengthCountingMode("zh")).toBe("zh_chars");
    expect(resolveLengthCountingMode("en")).toBe("en_words");
    expect(resolveLengthCountingMode()).toBe("zh_chars");
    expect(countChapterLength("他抬头看天。", "zh_chars")).toBe(6);
    expect(countChapterLength("He looked at the sky.", "en_words")).toBe(5);
  });
});
