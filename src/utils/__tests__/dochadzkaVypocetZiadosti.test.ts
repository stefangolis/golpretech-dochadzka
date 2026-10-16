import { describe, expect, it } from "vitest";
import {
  pragueLocalToUtcMs,
  pragueMinutyDna,
  vypocitajDen,
  vypocitajMesiac,
  type UdalostPreVypocet,
  type ZiadostPreVypocet,
} from "../dochadzkaVypocet";
import { rozpisNovuZiadost, type RozpisKontext } from "../dochadzkaZiadosti";
import { den, DNES, iso, MESIAC, pouziFixnyCas, ROK } from "./fixnyCas";

pouziFixnyCas();

const H = 60;
const VCERA = den(-1);
/** Víkend pred DNES (So, Ne). */
const SOBOTA = den(-4);
const NEDELA = den(-3);

const ctx = (over: Partial<RozpisKontext> = {}): RozpisKontext => ({
  dnes: DNES,
  nowMs: Date.now(),
  dennyFondHod: 8,
  skupinaId: "abc123",
  existujuce: [],
  ...over,
});

function polozky(r: ReturnType<typeof rozpisNovuZiadost>) {
  if (!r.ok) throw new Error(r.chyba);
  return r.polozky;
}

function schvalene<T extends { stav: string }>(arr: T[]): T[] {
  return arr.map((p) => ({ ...p, stav: "Schvalene" }));
}

function u(typ: string, datum: string, hh: number, mm = 0): UdalostPreVypocet {
  return { typ, cas: iso(datum, hh * H + mm), stav: "Platna" };
}

function ziadost(
  druh: string,
  datum: string,
  odMin: number,
  doMin: number,
  hodiny?: number,
): ZiadostPreVypocet {
  return { druh, od: iso(datum, odMin), do: iso(datum, doMin), hodiny, stav: "Schvalene" };
}

describe("Europe/Prague → UTC", () => {
  it("letný aj zimný čas, aj deň prechodu", () => {
    expect(new Date(pragueLocalToUtcMs("2026-10-01", 8 * H)).toISOString()).toBe(
      "2026-10-01T06:00:00.000Z",
    );
    expect(new Date(pragueLocalToUtcMs("2026-12-01", 8 * H)).toISOString()).toBe(
      "2026-12-01T07:00:00.000Z",
    );
    // 25. 10. 2026: 8:00 už zimný čas
    expect(new Date(pragueLocalToUtcMs("2026-10-25", 8 * H)).toISOString()).toBe(
      "2026-10-25T07:00:00.000Z",
    );
    expect(pragueMinutyDna("2026-12-01T07:30:00.000Z")).toBe(8 * H + 30);
  });
});

describe("výpočet so žiadosťami", () => {
  it("služobná cesta cez víkend 8–18: 10 h denne, bez obeda", () => {
    const sc = polozky(
      rozpisNovuZiadost(
        {
          druh: "SluzobnaCesta",
          poznamka: "Brno",
          dni: [
            { datum: SOBOTA, odMin: 8 * H, doMin: 18 * H },
            { datum: NEDELA, odMin: 8 * H, doMin: 18 * H },
          ],
        },
        ctx(),
      ),
    );
    expect(sc).toHaveLength(2);
    expect(sc.every((p) => p.stav === "Schvalene" && p.schvalilEmail === "auto")).toBe(true);
    expect(sc[0].od).toBe(`${SOBOTA}T06:00:00.000Z`);
    expect(sc[0].do).toBe(`${SOBOTA}T16:00:00.000Z`);
    expect(sc[0].poznamka).toBe("Brno");
    expect(sc[0].title).toBe("Služební cesta 3.–4. 10. (2 dny) #abc123");

    const m = vypocitajMesiac([], ROK, MESIAC, Date.now(), sc);
    expect(m.dni.map((d) => d.datum)).toEqual([SOBOTA, NEDELA]);
    for (const d of m.dni) {
      expect(d.sluzobnaCestaMin).toBe(600);
      expect(d.obedOdpocitany).toBe(false);
      expect(d.vysledneMin).toBe(600);
    }
    expect(m.spoluMin).toBe(1200);
  });

  it("home office 8–16:30: 8,5 h − 30 min obed = 8 h", () => {
    const ho = ziadost("HomeOffice", VCERA, 8 * H, 16 * H + 30);
    const d = vypocitajDen([], VCERA, Date.now(), [ho]);
    expect(d.pritomnostMin).toBe(510);
    expect(d.obedOdpocitany).toBe(true);
    expect(d.vysledneMin).toBe(480);
  });

  it("dnešný home office sa ráta len do teraz (10:00)", () => {
    const ho = ziadost("HomeOffice", DNES, 8 * H, 16 * H + 30);
    const d = vypocitajDen([], DNES, Date.now(), [ho]);
    expect(d.pritomnostMin).toBe(120);
    expect(d.vysledneMin).toBe(120);
  });

  it("udalosti + služobná cesta: prekryv sa neráta dvakrát, SC bez obeda", () => {
    const udalosti = [u("Prichod", VCERA, 7), u("SluzobnyOdchod", VCERA, 10)];
    const sc = ziadost("SluzobnaCesta", VCERA, 9 * H, 18 * H);
    const d = vypocitajDen(udalosti, VCERA, Date.now(), [sc]);
    // prítomnosť 7–10 (3 h, bez obeda) + SC 10–18 (8 h)
    expect(d.pritomnostMin).toBe(180);
    expect(d.sluzobnaCestaMin).toBe(480);
    expect(d.obedOdpocitany).toBe(false);
    expect(d.vysledneMin).toBe(660);
  });

  it("spätná prítomnosť = úsek príchod–odchod", () => {
    const sp = ziadost("SpatnaPritomnost", VCERA, 7 * H, 15 * H + 30);
    expect(vypocitajDen([], VCERA, Date.now(), [sp]).vysledneMin).toBe(8 * H);
  });

  it("neschválená žiadosť sa nepočíta", () => {
    const ho = { ...ziadost("HomeOffice", VCERA, 8 * H, 16 * H), stav: "Ziadost" };
    const d = vypocitajDen([], VCERA, Date.now(), [ho]);
    expect(d.vysledneMin).toBe(0);
    expect(d.ziadosti).toHaveLength(0);
  });

  it("dovolenka cez Vianoce: len pracovné dni × fond", () => {
    // 23. 12. 2026 (St) prac., 24.–26. sviatky, 27. nedeľa, 28. (Po) prac.
    const od = `${ROK}-12-23`;
    const doKey = `${ROK}-12-28`;
    const dov = polozky(
      rozpisNovuZiadost(
        {
          druh: "Dovolenka",
          dni: [
            { datum: od, castDna: "Cely" },
            { datum: doKey, castDna: "Cely" },
          ],
        },
        ctx(),
      ),
    );
    expect(dov.map((p) => p.od)).toEqual([iso(od, 0), iso(doKey, 0)]);
    expect(dov[0].do).toBe(iso(od, 23 * H + 59));
    expect(dov.every((p) => p.hodiny === 8 && p.stav === "Ziadost")).toBe(true);

    const m = vypocitajMesiac([], ROK, 12, Date.now(), schvalene(dov));
    expect(m.absenciaMin).toBe(16 * H);
    expect(m.spoluMin).toBe(0);
    expect(m.dni.map((d) => d.datum)).toEqual([od, doKey]);
  });

  it("pol dňa dovolenky = polovica fondu", () => {
    const zajtra = den(1);
    const dov = polozky(
      rozpisNovuZiadost(
        { druh: "Dovolenka", dni: [{ datum: zajtra, castDna: "Dopoludnie" }] },
        ctx(),
      ),
    );
    expect(dov).toHaveLength(1);
    expect(dov[0].hodiny).toBe(4);
    expect(dov[0].castDna).toBe("Dopoludnie");
    const d = vypocitajDen([], zajtra, Date.now(), schvalene(dov));
    expect(d.absenciaMin).toBe(240);
    expect(d.vysledneMin).toBe(0);
  });
});
