import { describe, expect, it } from "vitest";
import { normalizeTagUid } from "../tagUid";

describe("normalizeTagUid", () => {
  it("veľké písmená, bez dvojbodiek, pomlčiek a medzier", () => {
    expect(normalizeTagUid("04:a1:b2:c3:d4:e5:f6")).toBe("04A1B2C3D4E5F6");
    expect(normalizeTagUid(" 04 a1-b2 ")).toBe("04A1B2");
    expect(normalizeTagUid("04A1B2C3")).toBe("04A1B2C3");
  });
  it("pole bajtov → hex", () => {
    expect(normalizeTagUid([4, 161, 178, 255])).toBe("04A1B2FF");
  });
  it("neplatný vstup → prázdny reťazec", () => {
    expect(normalizeTagUid(undefined)).toBe("");
    expect(normalizeTagUid(null)).toBe("");
  });
});
