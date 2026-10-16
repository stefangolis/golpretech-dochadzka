import { describe, expect, it } from "vitest";
import {
  maPristupKDochadzce,
  parseAnoNie,
  parseCisloAleboNull,
  parseDatumKey,
  parseDennyFond,
  vyhodnotOpravnenia,
  type OpravnenieZaznam,
} from "../dochadzkaOpravnenia";

function z(over: Partial<OpravnenieZaznam>): OpravnenieZaznam {
  return {
    email: "jan@firma.cz",
    zapisBezNalepky: false,
    nadriadenyEmail: "",
    jeHR: false,
    dennyFondHod: 8,
    dovolenkaZostatokHod: null,
    prescasZostatokHod: null,
    stavKDatumu: null,
    ...over,
  };
}

describe("DochadzkaOpravnenia", () => {
  it("Ano/Nie: prázdne = Nie", () => {
    expect(parseAnoNie("Ano")).toBe(true);
    expect(parseAnoNie("Áno")).toBe(true);
    expect(parseAnoNie(true)).toBe(true);
    expect(parseAnoNie("Nie")).toBe(false);
    expect(parseAnoNie("")).toBe(false);
    expect(parseAnoNie(undefined)).toBe(false);
  });

  it("DennyFondHod: prázdne = 8, akceptuje desatinnú čiarku", () => {
    expect(parseDennyFond(undefined)).toBe(8);
    expect(parseDennyFond("")).toBe(8);
    expect(parseDennyFond(0)).toBe(8);
    expect(parseDennyFond("abc")).toBe(8);
    expect(parseDennyFond(6)).toBe(6);
    expect(parseDennyFond("7,5")).toBe(7.5);
  });

  it("nadriadený, HR a schvaľovateľ", () => {
    const zaznamy = [
      z({ email: "jan@firma.cz", nadriadenyEmail: " Sef@Firma.cz ", dennyFondHod: 7.5 }),
      z({ email: "sef@firma.cz", nadriadenyEmail: "" }),
      z({ email: "hr@firma.cz", jeHR: true }),
    ];
    const jan = vyhodnotOpravnenia(zaznamy, "JAN@firma.cz");
    expect(jan.nadriadenyEmail).toBe("Sef@Firma.cz");
    expect(jan.dennyFondHod).toBe(7.5);
    expect(jan.jeSchvalovatel).toBe(false);

    const sef = vyhodnotOpravnenia(zaznamy, "sef@firma.cz");
    expect(sef.nadriadenyEmail).toBeNull();
    expect(sef.jeSchvalovatel).toBe(true);

    const hr = vyhodnotOpravnenia(zaznamy, "hr@firma.cz");
    expect(hr.jeHR).toBe(true);
    expect(hr.jeSchvalovatel).toBe(true);

    const neznamy = vyhodnotOpravnenia(zaznamy, "novy@firma.cz");
    expect(neznamy).toEqual({
      zapisBezNalepky: false,
      nadriadenyEmail: null,
      jeHR: false,
      dennyFondHod: 8,
      dovolenkaZostatokHod: null,
      prescasZostatokHod: null,
      stavKDatumu: null,
      jeSchvalovatel: false,
      vSezname: false,
    });
    expect(jan.vSezname).toBe(true);
    expect(sef.vSezname).toBe(true);
  });

  it("zostatky a StavKDatumu sa prenášajú", () => {
    const r = vyhodnotOpravnenia(
      [z({ dovolenkaZostatokHod: 120, prescasZostatokHod: -3.5, stavKDatumu: "2026-09-30" })],
      "jan@firma.cz",
    );
    expect(r).toMatchObject({
      dovolenkaZostatokHod: 120,
      prescasZostatokHod: -3.5,
      stavKDatumu: "2026-09-30",
    });
  });

  it("číslo alebo null: prázdne = null, záporné a čiarka OK", () => {
    expect(parseCisloAleboNull(undefined)).toBeNull();
    expect(parseCisloAleboNull("")).toBeNull();
    expect(parseCisloAleboNull("abc")).toBeNull();
    expect(parseCisloAleboNull(0)).toBe(0);
    expect(parseCisloAleboNull(-2.5)).toBe(-2.5);
    expect(parseCisloAleboNull("7,5")).toBe(7.5);
  });

  it("StavKDatumu: len dátum doslovne, dátum s časom podľa Prahy", () => {
    expect(parseDatumKey("2026-09-30")).toBe("2026-09-30");
    expect(parseDatumKey("2026-09-30T00:00:00Z")).toBe("2026-09-30");
    // SharePoint dátum v lokálnom čase uložený ako 22:00 UTC predchádzajúceho dňa
    expect(parseDatumKey("2026-09-29T22:00:00Z")).toBe("2026-09-30");
    expect(parseDatumKey("")).toBeNull();
    expect(parseDatumKey(null)).toBeNull();
  });

  it("maPristupKDochadzce: v zozname, mimo zoznamu, veľkosť písmen, chýbajúce dáta", () => {
    const zaznamy = [z({ email: "Jan@Firma.cz" })];
    expect(maPristupKDochadzce(zaznamy, "jan@firma.cz")).toBe(true);
    expect(maPristupKDochadzce(zaznamy, "JAN@FIRMA.CZ")).toBe(true);
    expect(maPristupKDochadzce(zaznamy, "  jan@firma.cz  ")).toBe(true);
    expect(maPristupKDochadzce(zaznamy, "novy@firma.cz")).toBe(false);
    expect(maPristupKDochadzce([], "jan@firma.cz")).toBe(false);
    expect(maPristupKDochadzce(null, "jan@firma.cz")).toBe(false);
    expect(maPristupKDochadzce(undefined, "jan@firma.cz")).toBe(false);
    expect(maPristupKDochadzce(zaznamy, "")).toBe(false);
    expect(maPristupKDochadzce(zaznamy, "   ")).toBe(false);
    expect(maPristupKDochadzce(zaznamy, null)).toBe(false);
    expect(maPristupKDochadzce(zaznamy, undefined)).toBe(false);
  });

  it("sám sebe nadriadený je schvaľovateľ (schvaľuje si sám)", () => {
    const r = vyhodnotOpravnenia([z({ email: "a@f.cz", nadriadenyEmail: "A@f.cz" })], "a@f.cz");
    expect(r.nadriadenyEmail).toBe("A@f.cz");
    expect(r.jeSchvalovatel).toBe(true);
  });
});
