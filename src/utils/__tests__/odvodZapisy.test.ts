import { describe, expect, it } from "vitest";
import { skontrolujMinuty } from "../odvodMinuty";
import {
  nadpisDna,
  nahradZapis,
  orezDni,
  zoskupZapisyPodlaDna,
  type ZapisPreZoznam,
} from "../odvodZapisy";
import { den, DNES, iso, pouziFixnyCas } from "./fixnyCas";

pouziFixnyCas();

/** CasZapisu v SharePointe je len dátum (rovnaký čas pre celý deň), poradie dá Created. */
function zapis(id: string, datum: string, minuty: number, vytvorene: string, minutaVytvorenia = 8 * 60): ZapisPreZoznam {
  return {
    id,
    datum,
    minuty,
    casZapisu: `${vytvorene}T07:00:00Z`,
    created: iso(vytvorene, minutaVytvorenia),
  };
}

describe("moje zápisy zoskupené podľa dňa", () => {
  it("nadpis dňa", () => {
    expect(nadpisDna(DNES)).toBe("St 7. 10.");
    expect(nadpisDna(den(-3))).toBe("Ne 4. 10.");
  });

  it("zápis vytvorený dnes za predvčerajšok je pod predvčerajškom, nie hore", () => {
    const zapisy = [
      zapis("10", den(-1), 120, den(-1)),
      zapis("11", den(-2), 60, DNES, 9 * 60), // vytvorený dnes, odvod za predvčerajšok
      zapis("9", DNES, 30, DNES, 7 * 60),
    ];
    const dni = zoskupZapisyPodlaDna(zapisy);
    expect(dni.map((d) => d.datum)).toEqual([DNES, den(-1), den(-2)]);
    expect(dni[2]!.zapisy.map((z) => z.id)).toEqual(["11"]);
  });

  it("dva zápisy v jeden deň: novší hore, súčet ako pri kontrole 480 minút", () => {
    const zapisy = [
      zapis("20", DNES, 300, DNES, 8 * 60),
      zapis("21", DNES, 240, DNES, 13 * 60),
    ];
    const [dnes] = zoskupZapisyPodlaDna(zapisy);
    expect(dnes!.zapisy.map((z) => z.id)).toEqual(["21", "20"]);
    expect(dnes!.sucetMin).toBe(540);
    expect(dnes!.sucetText).toBe("540 min (9 h 0 min)");
    // rovnaký súčet ako kontrola pri ďalšom zápise 0 minút
    const k = skontrolujMinuty({ minuty: 0, datum: DNES, zaznamy: zapisy, nacitaneOd: den(-6), nacitaneDo: DNES });
    expect(k.sucetDna).toBe(dnes!.sucetMin);
  });

  it("bez Created rozhodne CasZapisu, potom vyššie ID", () => {
    const zapisy: ZapisPreZoznam[] = [
      { id: "5", datum: DNES, minuty: 10, casZapisu: iso(DNES, 9 * 60) },
      { id: "7", datum: DNES, minuty: 10, casZapisu: iso(DNES, 8 * 60) },
      { id: "6", datum: DNES, minuty: 10, casZapisu: iso(DNES, 9 * 60) },
    ];
    expect(zoskupZapisyPodlaDna(zapisy)[0]!.zapisy.map((z) => z.id)).toEqual(["6", "5", "7"]);
  });

  it("zmena dátumu pri úprave presunie zápis pod nový deň a prepočíta súčty", () => {
    const zapisy = [
      zapis("1", DNES, 200, DNES, 8 * 60),
      zapis("2", DNES, 100, DNES, 9 * 60),
      zapis("3", den(-2), 60, den(-2)),
    ];
    const upravene = nahradZapis(zapisy, "2", { datum: den(-2), minuty: 120 });
    const dni = zoskupZapisyPodlaDna(upravene);
    expect(dni.map((d) => [d.datum, d.zapisy.map((z) => z.id), d.sucetMin])).toEqual([
      [DNES, ["1"], 200],
      [den(-2), ["2", "3"], 180],
    ]);
  });

  it("zbalený zoznam: prvé 3 zápisy, súčty za celý deň", () => {
    const zapisy = [
      zapis("1", DNES, 60, DNES, 8 * 60),
      zapis("2", DNES, 60, DNES, 9 * 60),
      zapis("3", den(-1), 60, den(-1), 8 * 60),
      zapis("4", den(-1), 90, den(-1), 9 * 60),
      zapis("5", den(-2), 30, den(-2)),
    ];
    const orez = orezDni(zoskupZapisyPodlaDna(zapisy), 3);
    expect(orez.map((d) => [d.datum, d.zapisy.map((z) => z.id), d.sucetMin])).toEqual([
      [DNES, ["2", "1"], 120],
      [den(-1), ["4"], 150],
    ]);
  });
});
