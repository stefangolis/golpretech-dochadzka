import { describe, expect, it } from "vitest";
import type { UdalostPreVypocet, ZiadostPreVypocet } from "../dochadzkaVypocet";
import { pridajDni } from "../dochadzkaZiadosti";
import {
  formatDni,
  formatHodinySoZnamienkom,
  mesacnyFond,
  vypocitajZostatokDovolenky,
  vypocitajZostatokNadcasov,
} from "../dochadzkaZostatky";
import { den, DNES, iso, MESIAC, pouziFixnyCas, ROK } from "./fixnyCas";

pouziFixnyCas();

const H = 60;

function u(typ: string, datum: string, hh: number, mm = 0): UdalostPreVypocet {
  return { typ, cas: iso(datum, hh * H + mm), stav: "Platna" };
}

/** Celodenná položka (dovolenka / NV): 00:00–23:59. */
function absencia(druh: string, datum: string, hodiny: number, stav = "Schvalene"): ZiadostPreVypocet {
  return { druh, od: iso(datum, 0), do: iso(datum, 23 * H + 59), hodiny, stav };
}

function sCasom(druh: string, datum: string, odMin: number, doMin: number): ZiadostPreVypocet {
  return { druh, od: iso(datum, odMin), do: iso(datum, doMin), stav: "Schvalene" };
}

describe("mesačný fond", () => {
  it("mesiac so sviatkom: október 2026 = 22 pracovných dní − 28. 10. = 21", () => {
    expect(MESIAC).toBe(10);
    expect(mesacnyFond(ROK, MESIAC, 8)).toEqual({ pracovneDni: 21, hodiny: 168 });
    expect(mesacnyFond(ROK, MESIAC, 7.5)).toEqual({ pracovneDni: 21, hodiny: 157.5 });
  });

  it("mesiac bez sviatku a december cez rok", () => {
    // február 2027: 4 celé týždne
    expect(mesacnyFond(ROK + 1, 2, 8).pracovneDni).toBe(20);
    // december 2026: 23 pracovných dní − 24., 25. 12. (Št, Pi) = 21
    expect(mesacnyFond(ROK, 12, 8).pracovneDni).toBe(21);
  });
});

describe("zostatok dovolenky", () => {
  const stavKDatumu = pridajDni(`${ROK}-${String(MESIAC).padStart(2, "0")}-01`, -1);

  it("zostatok − schválené po StavKDatumu, naplánované a čakajúce zvlášť (aj pol dňa)", () => {
    const ziadosti = [
      absencia("Dovolenka", pridajDni(stavKDatumu, -10), 8), // pred StavKDatumu — už v zostatku
      absencia("Dovolenka", stavKDatumu, 8), // v deň StavKDatumu — už v zostatku
      absencia("Dovolenka", den(-2), 8), // vyčerpaná
      absencia("Dovolenka", den(1), 4), // pol dňa, naplánovaná
      absencia("Dovolenka", den(2), 8, "Ziadost"), // čaká
      absencia("Dovolenka", den(3), 8, "Zamietnute"),
      absencia("Dovolenka", den(4), 8, "Zrusene"),
      absencia("NahradneVolno", den(5), 8),
    ];
    const r = vypocitajZostatokDovolenky({
      zostatokHod: 80,
      stavKDatumu,
      dennyFondHod: 8,
      dnes: DNES,
      ziadosti,
    });
    expect(r).toEqual({
      stavKDatumu,
      hodiny: 68,
      dni: 8.5,
      naplanovaneHod: 4,
      naplanovaneDni: 0.5,
      cakaHod: 8,
      cakaDni: 1,
    });
  });

  it("nenastavený zostatok alebo StavKDatumu → null", () => {
    const base = { dennyFondHod: 8, dnes: DNES, ziadosti: [] };
    expect(vypocitajZostatokDovolenky({ ...base, zostatokHod: null, stavKDatumu })).toBeNull();
    expect(vypocitajZostatokDovolenky({ ...base, zostatokHod: 40, stavKDatumu: null })).toBeNull();
    expect(vypocitajZostatokDovolenky({ ...base, zostatokHod: 0, stavKDatumu })?.hodiny).toBe(0);
  });
});

describe("zostatok nadčasov", () => {
  // StavKDatumu = pondelok 28. 9.; dopočet 29. 9. (Ut) – 6. 10. (Ut), dnešok sa nepočíta
  const stavKDatumu = den(-9);
  const vstup = (udalosti: UdalostPreVypocet[], ziadosti: ZiadostPreVypocet[], zostatokHod = 10) =>
    vypocitajZostatokNadcasov({
      zostatokHod,
      stavKDatumu,
      dennyFondHod: 8,
      dnes: DNES,
      nowMs: Date.now(),
      udalosti,
      ziadosti,
    });

  it("víkendová SC, dovolenka pol dňa, NV a bežné dni", () => {
    const udalosti = [
      // den(-8) Ut: 7:00–16:00 = 9 h − 30 min obed = 8,5 h → +0,5 h
      u("Prichod", den(-8), 7),
      u("Odchod", den(-8), 16),
      // den(-7) St: 7:00–15:30 = 8 h → 0
      u("Prichod", den(-7), 7),
      u("Odchod", den(-7), 15, 30),
      // den(-2) Po: pol dňa dovolenky + 7:00–11:00 → fond 4 h, odpracované 4 h → 0
      u("Prichod", den(-2), 7),
      u("Odchod", den(-2), 11),
      // den(-1) Ut: 7:00–15:30 → 0
      u("Prichod", den(-1), 7),
      u("Odchod", den(-1), 15, 30),
      // dnes otvorený príchod sa do konta nepočíta
      u("Prichod", DNES, 6),
    ];
    const ziadosti = [
      absencia("Dovolenka", den(-6), 8), // Št: dovolenka → fond 0 → 0
      absencia("NahradneVolno", den(-5), 8), // Pi: NV čerpá konto → −8 h
      sCasom("SluzobnaCesta", den(-4), 8 * H, 18 * H), // So: SC 10 h, fond 0 → +10 h
      absencia("Dovolenka", den(-2), 4), // Po: pol dňa
    ];
    const r = vstup(udalosti, ziadosti);
    expect(r).toEqual({
      stavKDatumu,
      hodiny: 10 + 0.5 - 8 + 10,
      zaObdobieHod: 2.5,
      od: den(-8),
      do: den(-1),
      dniSChybou: 0,
    });
  });

  it("NV pol dňa: fond −4 h a konto −4 h", () => {
    const udalosti: UdalostPreVypocet[] = [];
    for (let i = -8; i <= -1; i++) {
      const d = den(i);
      if (i === -4 || i === -3) continue; // víkend
      udalosti.push(u("Prichod", d, 7), u("Odchod", d, i === -1 ? 11 : 15, i === -1 ? 0 : 30));
    }
    const r = vstup(udalosti, [absencia("NahradneVolno", den(-1), 4)]);
    // včera 4 h práce + 4 h NV: fond 4 h → 0, NV čerpá −4 h
    expect(r?.zaObdobieHod).toBe(-4);
    expect(r?.hodiny).toBe(6);
  });

  it("chýbajúci odchod sa hlási, neschválené žiadosti sa nepočítajú", () => {
    const r = vstup(
      [u("Prichod", den(-1), 7)],
      [{ ...sCasom("SluzobnaCesta", den(-4), 8 * H, 18 * H), stav: "Ziadost" }],
      0,
    );
    // 6 pracovných dní bez odpracovaného času (−48 h), SC v stave Ziadost sa neráta
    expect(r?.zaObdobieHod).toBe(-48);
    expect(r?.dniSChybou).toBe(1);
  });

  it("StavKDatumu včera → nič sa nedopočítava; nenastavené → null", () => {
    const r = vypocitajZostatokNadcasov({
      zostatokHod: 12.5,
      stavKDatumu: den(-1),
      dennyFondHod: 8,
      dnes: DNES,
      nowMs: Date.now(),
      udalosti: [],
      ziadosti: [],
    });
    expect(r).toMatchObject({ hodiny: 12.5, zaObdobieHod: 0, od: null, do: null });
    expect(
      vypocitajZostatokNadcasov({
        zostatokHod: null,
        stavKDatumu: den(-1),
        dennyFondHod: 8,
        dnes: DNES,
        nowMs: Date.now(),
        udalosti: [],
        ziadosti: [],
      }),
    ).toBeNull();
  });
});

describe("formátovanie", () => {
  it("dni a hodiny so znamienkom", () => {
    expect(formatDni(1)).toBe("1 den");
    expect(formatDni(3)).toBe("3 dny");
    expect(formatDni(5)).toBe("5 dní");
    expect(formatDni(8.5)).toBe("8,5 dne");
    expect(formatHodinySoZnamienkom(12.5)).toBe("+12,5 h");
    expect(formatHodinySoZnamienkom(-3)).toBe("−3 h");
    expect(formatHodinySoZnamienkom(0)).toBe("0 h");
  });
});
