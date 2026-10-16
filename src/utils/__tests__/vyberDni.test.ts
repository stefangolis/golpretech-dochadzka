import { describe, expect, it } from "vitest";
import { obsadeneDni, povolenyRozsah, rozpisNovuZiadost } from "../dochadzkaZiadosti";
import {
  dovodNevolitelnosti,
  jeVolitelnyDen,
  mesiacVRozsahu,
  mriezkaMesiaca,
  posunMesiac,
  prepniDen,
  pridajRozsah,
  type PravidlaVyberu,
} from "../vyberDni";
import { den, DNES, iso, pouziFixnyCas, ROK } from "./fixnyCas";

pouziFixnyCas();

const H = 60;
const prazdne: ReadonlySet<string> = new Set();

function pravidla(
  druh: "SluzobnaCesta" | "HomeOffice" | "SpatnaPritomnost" | "Dovolenka" | "NahradneVolno",
  over: Partial<PravidlaVyberu> = {},
): PravidlaVyberu {
  return {
    ...povolenyRozsah(druh, DNES),
    obsadene: prazdne,
    lenPracovne: druh === "Dovolenka" || druh === "NahradneVolno",
    rozsahLenPracovne: druh === "HomeOffice",
    ...over,
  };
}

describe("výber viacerých dní", () => {
  it("nesúvislé dni: ťuk vyberie / zruší, výsledok je zoradený", () => {
    const p = pravidla("SluzobnaCesta");
    let v: string[] = [];
    for (const d of [den(2), den(-3), den(5), den(-1)]) v = prepniDen(v, d, p);
    expect(v).toEqual([den(-3), den(-1), den(2), den(5)]);
    v = prepniDen(v, den(-1), p);
    expect(v).toEqual([den(-3), den(2), den(5)]);
  });

  it("dovolenka: ťuk ani rozsah cez víkend nevyberie sobotu a nedeľu", () => {
    const p = pravidla("Dovolenka");
    // Pi 9. 10. – Po 12. 10.
    expect(prepniDen([], den(3), p)).toEqual([]);
    expect(dovodNevolitelnosti(den(3), p)).toMatch(/Víkend nebo státní svátek/);
    expect(pridajRozsah([], den(2), den(5), p)).toEqual([den(2), den(5)]);
    // poradie ťukov nerozhoduje
    expect(pridajRozsah([], den(5), den(2), p)).toEqual([den(2), den(5)]);
  });

  it("rozsah cez sviatok 28. 10.", () => {
    const a = `${ROK}-10-27`;
    const b = `${ROK}-10-29`;
    expect(pridajRozsah([], a, b, pravidla("Dovolenka"))).toEqual([a, b]);
    expect(pridajRozsah([], a, b, pravidla("HomeOffice"))).toEqual([a, b]);
    // služobná cesta môže byť aj vo sviatok
    expect(pridajRozsah([], a, b, pravidla("SluzobnaCesta"))).toEqual([a, `${ROK}-10-28`, b]);
    // dovolenka vo sviatok neprejde ani pri zápise
    const r = rozpisNovuZiadost(
      { druh: "Dovolenka", dni: [{ datum: `${ROK}-10-28`, castDna: "Cely" }] },
      { dnes: DNES, nowMs: Date.now(), dennyFondHod: 8, skupinaId: "a", existujuce: [] },
    );
    expect(r.ok).toBe(false);
  });

  it("prekryv: deň s vlastnou aktívnou žiadosťou sa nedá vybrať a rozsah ho preskočí", () => {
    const obsadene = obsadeneDni([
      { druh: "HomeOffice", od: iso(den(1), 8 * H), do: iso(den(1), 16 * H), stav: "Schvalene" },
      { druh: "Dovolenka", od: iso(den(2), 0), do: iso(den(2), 23 * H), stav: "Zrusene" },
    ]);
    const p = pravidla("Dovolenka", { obsadene });
    expect(jeVolitelnyDen(den(1), p)).toBe(false);
    expect(dovodNevolitelnosti(den(1), p)).toMatch(/aktivní žádost/);
    expect(jeVolitelnyDen(den(2), p)).toBe(true);
    expect(prepniDen([], den(1), p)).toEqual([]);
    expect(pridajRozsah([], DNES, den(2), p)).toEqual([DNES, den(2)]);
  });

  it("povolený rozsah: mimo neho sa nedá vybrať, už vybraný deň sa dá zrušiť", () => {
    const sp = pravidla("SpatnaPritomnost");
    expect(jeVolitelnyDen(den(-40), sp)).toBe(true);
    expect(jeVolitelnyDen(den(-41), sp)).toBe(false);
    expect(jeVolitelnyDen(den(1), sp)).toBe(false);
    expect(prepniDen([den(1)], den(1), sp)).toEqual([]);
    expect(jeVolitelnyDen(den(-1), pravidla("Dovolenka"))).toBe(false);
  });
});

describe("mriežka kalendára", () => {
  it("október 2026 začína štvrtkom, víkendy a sviatky označené", () => {
    const m = mriezkaMesiaca(ROK, 10, [den(1)], pravidla("Dovolenka"));
    expect(m.slice(0, 3)).toEqual([null, null, null]);
    expect(m[3]?.datum).toBe(`${ROK}-10-01`);
    expect(m.filter((b) => b !== null)).toHaveLength(31);
    const dni = new Map(m.filter((b) => b !== null).map((b) => [b!.datum, b!]));
    expect(dni.get(`${ROK}-10-10`)?.vikend).toBe(true);
    expect(dni.get(`${ROK}-10-28`)?.sviatok).toBe(true);
    expect(dni.get(`${ROK}-10-28`)?.volitelny).toBe(false);
    expect(dni.get(den(1))?.vybrany).toBe(true);
    expect(dni.get(den(-1))?.volitelny).toBe(false);
  });

  it("posun po mesiacoch a hranice", () => {
    expect(posunMesiac(ROK, 12, 1)).toEqual({ year: ROK + 1, month: 1 });
    expect(posunMesiac(ROK, 1, -1)).toEqual({ year: ROK - 1, month: 12 });
    const p = pravidla("SluzobnaCesta"); // 28. 8. – 5. 1.
    expect(mesiacVRozsahu(ROK, 8, p)).toBe(true);
    expect(mesiacVRozsahu(ROK, 7, p)).toBe(false);
    expect(mesiacVRozsahu(ROK + 1, 1, p)).toBe(true);
    expect(mesiacVRozsahu(ROK + 1, 2, p)).toBe(false);
  });
});
