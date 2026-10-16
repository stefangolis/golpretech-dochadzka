import { describe, expect, it } from "vitest";
import { vyberNfcZvuk } from "../nfcZvuk";

describe("vyberNfcZvuk", () => {
  it("priložení se známým přístupem a zapnutým zvukem = krátké pípnutí", () => {
    expect(
      vyberNfcZvuk({ okamzik: "prilozeni", maPristup: true, zvukZapnuty: true }),
    ).toBe("pip");
  });

  it("priložení bez přístupu k Docházce = ticho (jen vibrace mimo tuto funkci)", () => {
    expect(
      vyberNfcZvuk({ okamzik: "prilozeni", maPristup: false, zvukZapnuty: true }),
    ).toBeNull();
  });

  it("priložení se vypnutým zvukem = ticho", () => {
    expect(
      vyberNfcZvuk({ okamzik: "prilozeni", maPristup: true, zvukZapnuty: false }),
    ).toBeNull();
  });

  it("ověření neznámého tagu = dvojité nižší pípnutí", () => {
    expect(
      vyberNfcZvuk({
        okamzik: "overeni",
        maPristup: true,
        zvukZapnuty: true,
        tagZnamy: false,
      }),
    ).toBe("neznamy");
  });

  it("ověření známého tagu = ticho (pípnutí už bylo při přiložení)", () => {
    expect(
      vyberNfcZvuk({
        okamzik: "overeni",
        maPristup: true,
        zvukZapnuty: true,
        tagZnamy: true,
      }),
    ).toBeNull();
  });

  it("ověření neznámého tagu se vypnutým zvukem = ticho", () => {
    expect(
      vyberNfcZvuk({
        okamzik: "overeni",
        maPristup: true,
        zvukZapnuty: false,
        tagZnamy: false,
      }),
    ).toBeNull();
  });

  it("ověření neznámého tagu bez přístupu = ticho", () => {
    expect(
      vyberNfcZvuk({
        okamzik: "overeni",
        maPristup: false,
        zvukZapnuty: true,
        tagZnamy: false,
      }),
    ).toBeNull();
  });

  it("ověření ještě neznámého výsledku = ticho", () => {
    expect(
      vyberNfcZvuk({
        okamzik: "overeni",
        maPristup: true,
        zvukZapnuty: true,
        tagZnamy: null,
      }),
    ).toBeNull();
  });
});
