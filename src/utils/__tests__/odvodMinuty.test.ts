import { describe, expect, it } from "vitest";
import {
  formatHodinyMinuty,
  LIMIT_MINUT,
  skontrolujMinuty,
  textUpozorneniaMinut,
} from "../odvodMinuty";
import { den, DNES, pouziFixnyCas } from "./fixnyCas";

pouziFixnyCas();

const okno = { nacitaneOd: den(-6), nacitaneDo: DNES };
const z = (id: string, datum: string, minuty: number) => ({ id, datum, minuty });
const datumText = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
};

describe("kontrola minút pred uložením", () => {
  it("jeden zápis 500 min → upozornenie na zápis (aj súčet, jeden dialóg)", () => {
    const k = skontrolujMinuty({ minuty: 500, datum: DNES, zaznamy: [], ...okno });
    expect(k.nadZapis).toBe(true);
    expect(k.sucetDna).toBe(500);
    expect(textUpozorneniaMinut(k)).toBe(
      "Zapisuješ 500 minut (8 h 20 min), tedy víc než 8 hodin na jeden záznam. " +
        `Po tomto záznamu budeš mít ${datumText(DNES)} odpracováno 500 minut (8 h 20 min). ` +
        "Opravdu uložit?",
    );
  });

  it("dva zápisy 300 + 240 v ten istý deň → upozornenie na súčet dňa zápisu", () => {
    const vcera = den(-1);
    const k = skontrolujMinuty({
      minuty: 240,
      datum: vcera,
      zaznamy: [z("1", vcera, 300), z("2", DNES, 400)],
      ...okno,
    });
    expect(k).toMatchObject({ nadZapis: false, sucetDna: 540, nadDen: true });
    expect(textUpozorneniaMinut(k)).toBe(
      `Po tomto záznamu budeš mít ${datumText(vcera)} odpracováno 540 minut (9 h 0 min). Pokračovat?`,
    );
  });

  it("úprava zápisu nezapočíta jeho pôvodnú hodnotu", () => {
    const zaznamy = [z("1", DNES, 300), z("2", DNES, 120)];
    // zápis 2 zo 120 na 180: 300 + 180 = 480 → bez upozornenia
    const k = skontrolujMinuty({ minuty: 180, datum: DNES, zaznamy, upravovaneId: "2", ...okno });
    expect(k.sucetDna).toBe(480);
    expect(textUpozorneniaMinut(k)).toBeNull();
    // presun zápisu 2 na iný deň: dnešok sa nezvýši
    const presun = skontrolujMinuty({ minuty: 200, datum: den(-1), zaznamy, upravovaneId: "2", ...okno });
    expect(presun.sucetDna).toBe(200);
  });

  it("hranica presne 480 = bez upozornenia", () => {
    expect(LIMIT_MINUT).toBe(480);
    const k = skontrolujMinuty({ minuty: 480, datum: DNES, zaznamy: [], ...okno });
    expect(k).toMatchObject({ nadZapis: false, nadDen: false });
    expect(textUpozorneniaMinut(k)).toBeNull();
    const sucet = skontrolujMinuty({ minuty: 180, datum: DNES, zaznamy: [z("1", DNES, 300)], ...okno });
    expect(textUpozorneniaMinut(sucet)).toBeNull();
  });

  it("deň mimo načítaných dát alebo nenačítané zápisy → súčet sa preskočí", () => {
    const mimo = skontrolujMinuty({ minuty: 300, datum: den(-10), zaznamy: [z("1", den(-10), 400)], ...okno });
    expect(mimo.sucetDna).toBeNull();
    expect(textUpozorneniaMinut(mimo)).toBeNull();
    const nenacitane = skontrolujMinuty({ minuty: 300, datum: DNES, zaznamy: undefined, ...okno });
    expect(nenacitane.sucetDna).toBeNull();
    // kontrola jedného zápisu platí aj bez dát
    const velky = skontrolujMinuty({ minuty: 600, datum: den(-10), zaznamy: undefined, ...okno });
    expect(textUpozorneniaMinut(velky)).toBe(
      "Zapisuješ 600 minut (10 h 0 min), tedy víc než 8 hodin na jeden záznam. Opravdu uložit?",
    );
  });

  it("formát hodín a minút", () => {
    expect(formatHodinyMinuty(500)).toBe("8 h 20 min");
    expect(formatHodinyMinuty(45)).toBe("0 h 45 min");
  });
});
