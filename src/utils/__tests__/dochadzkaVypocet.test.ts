import { describe, expect, it } from "vitest";
import {
  formatMinuty,
  navrhniTyp,
  pragueDateKey,
  pragueDayRangeUtc,
  pragueMonthRangeUtc,
  pragueOffsetMinutes,
  pragueTimeLabel,
  shiftMonth,
  vypocitajDen,
  vypocitajMesiac,
  zaokruhliNadol,
  type UdalostPreVypocet,
} from "../dochadzkaVypocet";
import { pridajDni } from "../dochadzkaZiadosti";
import { den, DNES, iso, MESIAC, pouziFixnyCas, ROK } from "./fixnyCas";

pouziFixnyCas();

/** Udalosti dňa DEN (= DNES z fixného času) v pražskom čase. */
const DEN = DNES;
function u(typ: string, hhmmPraha: string, stav = "Platna"): UdalostPreVypocet {
  const [h, m] = hhmmPraha.split(":").map(Number);
  return { typ, cas: iso(DEN, h * 60 + m), stav };
}
const VECER = Date.parse(iso(DEN, 22 * 60));
const NASLEDUJUCI_DEN = Date.parse(iso(den(1), 12 * 60));

describe("Europe/Prague", () => {
  it("letný a zimný čas podľa pravidiel EÚ", () => {
    expect(pragueOffsetMinutes(Date.UTC(2026, 0, 15))).toBe(60);
    expect(pragueOffsetMinutes(Date.UTC(2026, 6, 15))).toBe(120);
    // 2026: prechod 29. 3. a 25. 10. o 01:00 UTC
    expect(pragueOffsetMinutes(Date.UTC(2026, 2, 29, 0, 59))).toBe(60);
    expect(pragueOffsetMinutes(Date.UTC(2026, 2, 29, 1, 0))).toBe(120);
    expect(pragueOffsetMinutes(Date.UTC(2026, 9, 25, 0, 59))).toBe(120);
    expect(pragueOffsetMinutes(Date.UTC(2026, 9, 25, 1, 0))).toBe(60);
  });

  it("dátum a čas dňa v Prahe", () => {
    expect(pragueDateKey("2026-09-30T22:30:00Z")).toBe("2026-10-01");
    expect(pragueTimeLabel("2026-10-01T05:02:00Z")).toBe("7:02");
    expect(pragueDateKey("2026-12-31T23:30:00Z")).toBe("2027-01-01");
    expect(pragueTimeLabel("2026-12-31T23:30:00Z")).toBe("0:30");
  });

  it("rozsah dňa a mesiaca v UTC", () => {
    expect(pragueDayRangeUtc("2026-10-01")).toEqual({
      od: "2026-09-30T22:00:00.000Z",
      do: "2026-10-01T22:00:00.000Z",
    });
    // deň prechodu na zimný čas má 25 hodín
    expect(pragueDayRangeUtc("2026-10-25")).toEqual({
      od: "2026-10-24T22:00:00.000Z",
      do: "2026-10-25T23:00:00.000Z",
    });
    expect(pragueMonthRangeUtc(2026, 10)).toEqual({
      od: "2026-09-30T22:00:00.000Z",
      do: "2026-10-31T23:00:00.000Z",
    });
    expect(pragueMonthRangeUtc(2026, 12).do).toBe("2026-12-31T23:00:00.000Z");
  });

  it("posun mesiaca cez rok", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 10, -3)).toEqual({ year: 2026, month: 7 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
});

describe("navrhniTyp", () => {
  it("bez udalosti → Príchod", () => {
    expect(navrhniTyp([])).toBe("Prichod");
  });
  it("po príchode → Odchod", () => {
    expect(navrhniTyp([u("Prichod", "7:00")])).toBe("Odchod");
  });
  it("po každom odchodovom type → Príchod", () => {
    for (const typ of [
      "Odchod",
      "SukromnyOdchod",
      "SluzobnyOdchod",
      "Lekar",
      "FajciarskaPrestavka",
    ]) {
      expect(navrhniTyp([u("Prichod", "7:00"), u(typ, "9:00")])).toBe("Prichod");
    }
  });
  it("berie poslednú platnú podľa času, zrušené ignoruje", () => {
    expect(
      navrhniTyp([u("Odchod", "15:00", "Zrusena"), u("Prichod", "7:00")]),
    ).toBe("Odchod");
    expect(navrhniTyp([u("Odchod", "15:00"), u("Prichod", "7:00")])).toBe(
      "Prichod",
    );
  });
});

describe("vypocitajDen", () => {
  it("jednoduchý deň s obedom: 7:00–15:30 = 8,5 h − 30 min = 8 h", () => {
    const d = vypocitajDen([u("Prichod", "7:00"), u("Odchod", "15:30")], DEN, VECER);
    expect(d.odpracovaneMin).toBe(510);
    expect(d.obedOdpocitany).toBe(true);
    expect(d.vysledneMin).toBe(480);
    expect(d.stav).toBe("mimo");
    expect(d.chybaOdchod).toBe(false);
  });

  it("presne 6 h sa obed neodpočítava", () => {
    const d = vypocitajDen([u("Prichod", "7:00"), u("Odchod", "13:00")], DEN, VECER);
    expect(d.obedOdpocitany).toBe(false);
    expect(d.vysledneMin).toBe(360);
  });

  it("6 h 1 min → odpočet obeda a zaokrúhlenie nadol na 15 min", () => {
    const d = vypocitajDen([u("Prichod", "7:00"), u("Odchod", "13:01")], DEN, VECER);
    expect(d.odpracovaneMin).toBe(361);
    expect(d.obedOdpocitany).toBe(true);
    expect(d.vysledneMin).toBe(330);
  });

  it("zaokrúhľuje nadol na 15 min", () => {
    const d = vypocitajDen([u("Prichod", "7:02"), u("Odchod", "11:16")], DEN, VECER);
    expect(d.odpracovaneMin).toBe(254);
    expect(d.vysledneMin).toBe(240);
  });

  it("služobný odchod a lekár sa po návrate rátajú", () => {
    const d = vypocitajDen(
      [
        u("Prichod", "7:00"),
        u("SluzobnyOdchod", "9:00"),
        u("Prichod", "11:00"),
        u("Lekar", "12:00"),
        u("Prichod", "13:00"),
        u("Odchod", "14:00"),
      ],
      DEN,
      VECER,
    );
    expect(d.odpracovaneMin).toBe(7 * 60);
    expect(d.vysledneMin).toBe(7 * 60 - 30);
  });

  it("súkromný odchod a fajčiarska prestávka sa nerátajú", () => {
    const d = vypocitajDen(
      [
        u("Prichod", "7:00"),
        u("FajciarskaPrestavka", "9:00"),
        u("Prichod", "9:15"),
        u("SukromnyOdchod", "10:00"),
        u("Prichod", "11:00"),
        u("Odchod", "12:00"),
      ],
      DEN,
      VECER,
    );
    expect(d.odpracovaneMin).toBe(120 + 45 + 60);
    expect(d.vysledneMin).toBe(225);
  });

  it("neuzavreté služobné prerušenie bez návratu sa neráta", () => {
    const d = vypocitajDen(
      [u("Prichod", "7:00"), u("SluzobnyOdchod", "10:00")],
      DEN,
      VECER,
    );
    expect(d.odpracovaneMin).toBe(180);
    expect(d.stav).toBe("prerusenie");
    expect(d.otvorenyUsek).toBe(false);
  });

  it("dnes otvorený úsek sa počíta do teraz (fixný čas 10:00)", () => {
    const d = vypocitajDen([u("Prichod", "6:30")], DEN);
    expect(d.otvorenyUsek).toBe(true);
    expect(d.stav).toBe("v_praci");
    expect(d.vPraciOd).toBe(u("Prichod", "6:30").cas);
    expect(d.odpracovaneMin).toBe(210);
    expect(d.vysledneMin).toBe(210);
    expect(d.chybaOdchod).toBe(false);
  });

  it("v práci od = prvý príchod dňa aj po prestávke", () => {
    const d = vypocitajDen(
      [u("Prichod", "7:02"), u("FajciarskaPrestavka", "9:00"), u("Prichod", "9:10")],
      DEN,
    );
    expect(d.vPraciOd).toBe(u("Prichod", "7:02").cas);
  });

  it("minulý deň končiaci príchodom = chýba odchod, otvorený úsek sa nepočíta", () => {
    const d = vypocitajDen(
      [u("Prichod", "7:00"), u("Odchod", "11:00"), u("Prichod", "12:00")],
      DEN,
      NASLEDUJUCI_DEN,
    );
    expect(d.chybaOdchod).toBe(true);
    expect(d.otvorenyUsek).toBe(false);
    expect(d.odpracovaneMin).toBe(240);
    expect(d.stav).toBe("mimo");
    expect(d.vPraciOd).toBeNull();
  });

  it("zrušené udalosti a duplicitné príchody ignoruje", () => {
    const d = vypocitajDen(
      [
        u("Prichod", "7:00"),
        u("Prichod", "7:05"),
        u("Odchod", "9:00", "Zrusena"),
        u("Odchod", "11:00"),
        u("Odchod", "11:30"),
      ],
      DEN,
      VECER,
    );
    expect(d.udalosti).toHaveLength(4);
    expect(d.odpracovaneMin).toBe(240);
  });

  it("odchod bez príchodu nič nepripočíta", () => {
    const d = vypocitajDen([u("Odchod", "15:00")], DEN, VECER);
    expect(d.odpracovaneMin).toBe(0);
    expect(d.vysledneMin).toBe(0);
  });
});

describe("vypocitajMesiac", () => {
  it("zoskupí podľa pražského dňa a spočíta mesiac", () => {
    const prvy = `${ROK}-${String(MESIAC).padStart(2, "0")}-01`;
    const druhy = pridajDni(prvy, 1);
    const piaty = pridajDni(prvy, 4);
    const udalosti: UdalostPreVypocet[] = [
      // posledný deň predošlého mesiaca 23:30 Praha patrí ešte do neho
      { typ: "Prichod", cas: iso(pridajDni(prvy, -1), 23 * 60 + 30) },
      { typ: "Prichod", cas: iso(prvy, 7 * 60) },
      { typ: "Odchod", cas: iso(prvy, 15 * 60 + 30) },
      { typ: "Prichod", cas: iso(druhy, 7 * 60) },
      { typ: "Odchod", cas: iso(druhy, 11 * 60) },
      { typ: "Prichod", cas: iso(piaty, 7 * 60) },
    ];
    const m = vypocitajMesiac(udalosti, ROK, MESIAC);
    expect(m.dni.map((d) => d.datum)).toEqual([prvy, druhy, piaty]);
    expect(m.spoluMin).toBe(480 + 240);
    expect(m.dniSChybou).toBe(1);
  });
});

describe("pomocné", () => {
  it("zaokruhliNadol", () => {
    expect(zaokruhliNadol(14)).toBe(0);
    expect(zaokruhliNadol(15)).toBe(15);
    expect(zaokruhliNadol(-5)).toBe(0);
  });
  it("formatMinuty", () => {
    expect(formatMinuty(0)).toBe("0 min");
    expect(formatMinuty(45)).toBe("45 min");
    expect(formatMinuty(120)).toBe("2 h");
    expect(formatMinuty(465)).toBe("7 h 45 min");
  });
});
