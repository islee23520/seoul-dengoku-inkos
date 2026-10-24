import { describe, expect, it } from "vitest";
import { tokenizeSearchText } from "../retrieval/local-search.js";

function sharesToken(query: string, body: string): boolean {
  const bodyTokens = new Set(tokenizeSearchText(body));
  return tokenizeSearchText(query).some((token) => bodyTokens.has(token));
}

describe("Korean search tokenizer", () => {
  it("matches a bare stem against the same name with a trailing particle", () => {
    const body = "신종목은 청와대에서 근무한다";

    expect(sharesToken("신종목", body)).toBe(true);
    expect(sharesToken("청와대", body)).toBe(true);
    expect(sharesToken("신종목", "신종목님의")).toBe(true);
  });

  it("strips a trailing particle only when two Hangul syllables remain", () => {
    expect(tokenizeSearchText("신종목은")).toEqual(expect.arrayContaining(["신종목은", "신종목"]));
    expect(tokenizeSearchText("청와대에서")).toEqual(expect.arrayContaining(["청와대에서", "청와대"]));
    expect(tokenizeSearchText("신종목님의")).toEqual(expect.arrayContaining(["신종목님의", "신종목"]));
    expect(tokenizeSearchText("은는")).not.toContain("은");
    expect(tokenizeSearchText("김에게")).not.toContain("김");
  });

  it("adds adjacent Hangul-syllable bigrams without dropping the word token", () => {
    expect(tokenizeSearchText("신종목")).toEqual(["신종목", "신종", "종목"]);
    expect(tokenizeSearchText("청와대")).toEqual(["청와대", "청와", "와대"]);
  });

  it("keeps Chinese Han bigrams byte-identical", () => {
    expect(tokenizeSearchText("林月必须核对誓令碎片")).toEqual([
      "林",
      "月",
      "必须",
      "核对",
      "誓",
      "令",
      "碎片",
      "林月",
      "誓令",
    ]);
  });

  it("keeps English tokens byte-identical", () => {
    expect(tokenizeSearchText("Mentor Debt guild-route")).toEqual([
      "mentor",
      "debt",
      "guild",
      "route",
      "guild-route",
    ]);
  });
});
