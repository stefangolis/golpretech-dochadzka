import { describe, expect, it } from "vitest";
import { posunNaPole, prekrytieKlavesnicou } from "../klavesnica";

describe("klávesnica vo formulári", () => {
  it("prekrytie spodku view klávesnicou", () => {
    // obrazovka 800, klávesnica od 500 → formulár 0–800 je prekrytý o 300
    expect(prekrytieKlavesnicou(0, 800, 500)).toBe(300);
    // systém okno zmenšil (formulár končí nad klávesnicou) → bez odsadenia
    expect(prekrytieKlavesnicou(0, 480, 500)).toBe(0);
    expect(prekrytieKlavesnicou(0, 800, null)).toBe(0);
  });

  it("posun na zaostrené pole pod klávesnicou", () => {
    // viditeľných 400 bodov, pole na 600–644 → posun tak, aby spodok + okraj bol na hrane
    expect(posunNaPole({ poleY: 600, poleVyska: 44, offset: 0, viditelnaVyska: 400, okraj: 24 })).toBe(268);
    // pole je viditeľné → netreba posúvať
    expect(posunNaPole({ poleY: 100, poleVyska: 44, offset: 0, viditelnaVyska: 400 })).toBeNull();
    // pole je nad viditeľnou časťou → posun nahor
    expect(posunNaPole({ poleY: 50, poleVyska: 44, offset: 300, viditelnaVyska: 400, okraj: 24 })).toBe(26);
    // pole vyššie ako voľné miesto → zobraz jeho vrch
    expect(posunNaPole({ poleY: 200, poleVyska: 500, offset: 0, viditelnaVyska: 300, okraj: 24 })).toBe(176);
    expect(posunNaPole({ poleY: 0, poleVyska: 44, offset: 0, viditelnaVyska: 0 })).toBeNull();
  });
});
