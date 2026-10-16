import { describe, expect, it } from "vitest";
import type { UdalostPreVypocet } from "../dochadzkaVypocet";
import {
  AUTO_POTVRDENIE_MS,
  relevantneTypy,
  stavPreZapis,
  TYPY_V_PRACI,
} from "../dochadzkaZapis";
import { DNES, iso, pouziFixnyCas } from "./fixnyCas";

pouziFixnyCas();

function u(typ: string, hh: number, mm = 0, stav = "Platna"): UdalostPreVypocet {
  return { typ, cas: iso(DNES, hh * 60 + mm), stav };
}

describe("relevantné tlačidlá na Zápise", () => {
  it("bez dnešného záznamu → len Príchod", () => {
    expect(relevantneTypy([])).toEqual({ stav: "mimo", navrh: "Prichod", typy: ["Prichod"] });
  });

  it("po Odchode → len Príchod", () => {
    const r = relevantneTypy([u("Prichod", 7), u("Odchod", 9)]);
    expect(r.stav).toBe("mimo");
    expect(r.typy).toEqual(["Prichod"]);
  });

  it("v práci → Odchod (navrhnutý) a prerušenia", () => {
    const r = relevantneTypy([u("Prichod", 7)]);
    expect(r.stav).toBe("v_praci");
    expect(r.navrh).toBe("Odchod");
    expect(r.typy).toEqual([
      "Odchod",
      "SukromnyOdchod",
      "SluzobnyOdchod",
      "Lekar",
      "FajciarskaPrestavka",
    ]);
    expect(r.typy).not.toContain("Prichod");
  });

  it("preč (každé prerušenie) → len Príchod = návrat", () => {
    for (const typ of TYPY_V_PRACI.filter((t) => t !== "Odchod")) {
      const r = relevantneTypy([u("Prichod", 7), u(typ, 9)]);
      expect(r.stav).toBe("prec");
      expect(r.navrh).toBe("Prichod");
      expect(r.typy).toEqual(["Prichod"]);
    }
  });

  it("rozhoduje posledný platný záznam podľa času, zrušené a neznáme typy ignoruje", () => {
    expect(stavPreZapis([u("Odchod", 9, 0, "Zrusena"), u("Prichod", 7)])).toBe("v_praci");
    expect(stavPreZapis([u("Odchod", 9), u("Prichod", 7)])).toBe("mimo");
    expect(stavPreZapis([u("Prichod", 7), u("Lekar", 9), u("Prichod", 10)])).toBe("v_praci");
    expect(stavPreZapis([u("Prichod", 7), u("Neznamy", 9)])).toBe("v_praci");
  });

  it("automatické potvrdenie 10 s", () => {
    expect(AUTO_POTVRDENIE_MS).toBe(10_000);
  });
});
