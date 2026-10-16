import { describe, expect, it } from "vitest";
import {
  buildZiadostTitle,
  hodinyDovolenky,
  jePracovnyDen,
  mozeZrusitDen,
  mozeZrusitSkupinu,
  novaSkupinaId,
  obsadeneDni,
  parseCasHHMM,
  parseSkupinaId,
  popisDnaZiadosti,
  popisTerminu,
  popisVybranychDni,
  povolenyRozsah,
  pracovneDni,
  pridajDni,
  rozdelPreZrusenie,
  rozpisNovuZiadost,
  smieRozhodnut,
  statneSviatkyCR,
  velkonocnaNedela,
  zoskupZiadosti,
  type NovaZiadostVstup,
  type RozpisKontext,
  type ZiadostPreKontrolu,
  type ZiadostZaznam,
} from "../dochadzkaZiadosti";
import { den, denMesiac, DNES, iso, pouziFixnyCas, ROK } from "./fixnyCas";

pouziFixnyCas();

const H = 60;
/** DNES je streda 7. 10. → +1 Št, +2 Pi, +3 So, +4 Ne, +5 Po 12. 10. */
const ZAJTRA = den(1);
const POZAJTRA = den(2);
const SOBOTA = den(3);
const NEDELA = den(4);
const PONDELOK = den(5);
/** 28. 10. 2026 (streda) je štátny sviatok. */
const SVIATOK = `${ROK}-10-28`;

const ctx = (over: Partial<RozpisKontext> = {}): RozpisKontext => ({
  dnes: DNES,
  nowMs: Date.now(),
  dennyFondHod: 8,
  skupinaId: "x1y2z3",
  existujuce: [],
  ...over,
});

function chyba(r: ReturnType<typeof rozpisNovuZiadost>): string {
  return r.ok ? "" : r.chyba;
}

const dovolenka = (...datumy: string[]): NovaZiadostVstup => ({
  druh: "Dovolenka",
  dni: datumy.map((datum) => ({ datum, castDna: "Cely" as const })),
});

const ho = (...datumy: string[]): NovaZiadostVstup => ({
  druh: "HomeOffice",
  dni: datumy.map((datum) => ({ datum, odMin: 8 * H, doMin: 16 * H + 30 })),
});

describe("sviatky ČR a pracovné dni", () => {
  it("Veľká noc", () => {
    expect(velkonocnaNedela(2025)).toBe("2025-04-20");
    expect(velkonocnaNedela(2026)).toBe("2026-04-05");
    expect(velkonocnaNedela(2027)).toBe("2027-03-28");
  });

  it("Veľký piatok a Veľkonočný pondelok + pevné sviatky", () => {
    const s = statneSviatkyCR(ROK);
    const nedela = velkonocnaNedela(ROK);
    expect(s.has(pridajDni(nedela, -2))).toBe(true);
    expect(s.has(pridajDni(nedela, 1))).toBe(true);
    expect(s.has(nedela)).toBe(false);
    for (const md of ["01-01", "05-01", "05-08", "07-05", "07-06", "09-28", "10-28", "11-17", "12-24", "12-25", "12-26"]) {
      expect(s.has(`${ROK}-${md}`)).toBe(true);
    }
    expect(s.size).toBe(13);
  });

  it("pracovné dni bez víkendov a sviatkov", () => {
    expect(jePracovnyDen(DNES)).toBe(true);
    expect(jePracovnyDen(SOBOTA)).toBe(false);
    expect(jePracovnyDen(NEDELA)).toBe(false);
    expect(jePracovnyDen(SVIATOK)).toBe(false);
    // 2026: 21.–23. 12. Po–St, 24.–26. sviatky, 27. Ne, 28.–31. Po–Št, 1. 1. sviatok, 2.–3. 1. víkend
    expect(pracovneDni(`${ROK}-12-21`, `${ROK + 1}-01-03`)).toEqual([
      `${ROK}-12-21`,
      `${ROK}-12-22`,
      `${ROK}-12-23`,
      `${ROK}-12-28`,
      `${ROK}-12-29`,
      `${ROK}-12-30`,
      `${ROK}-12-31`,
    ]);
  });

  it("hodiny dovolenky = súčet po dňoch podľa fondu", () => {
    expect(
      hodinyDovolenky(
        [
          { datum: ZAJTRA, castDna: "Cely" },
          { datum: POZAJTRA, castDna: "Popoludnie" },
          { datum: SOBOTA, castDna: "Cely" },
        ],
        7.5,
      ),
    ).toBe(11.25);
  });
});

describe("čas H:MM", () => {
  it("parsuje bežné zápisy", () => {
    expect(parseCasHHMM("8:00")).toBe(8 * H);
    expect(parseCasHHMM("16:30")).toBe(16 * H + 30);
    expect(parseCasHHMM("8.30")).toBe(8 * H + 30);
    expect(parseCasHHMM("830")).toBe(8 * H + 30);
    expect(parseCasHHMM("8")).toBe(8 * H);
    expect(parseCasHHMM("24:00")).toBe(24 * H);
    expect(parseCasHHMM("25:00")).toBeNull();
    expect(parseCasHHMM("8:75")).toBeNull();
    expect(parseCasHHMM("")).toBeNull();
  });
});

describe("skupina v Title", () => {
  it("Title: český druh, prvý–posledný deň, počet dní, #id", () => {
    const t = buildZiadostTitle(
      "Dovolenka",
      [`${ROK}-10-09`, `${ROK}-10-04`, `${ROK}-10-06`, `${ROK}-10-07`],
      "k3m9q0",
    );
    expect(t).toBe("Dovolená 4.–9. 10. (4 dny) #k3m9q0");
    expect(parseSkupinaId(t)).toBe("k3m9q0");
    expect(parseSkupinaId(`HomeOffice ${ZAJTRA}–${POZAJTRA} #ab12cd`)).toBe("ab12cd");
    expect(parseSkupinaId("bez id")).toBeNull();
    expect(novaSkupinaId(() => 0.5)).toMatch(/^[a-z0-9]{6}$/);
  });

  it("rozsah cez mesiac a rok, 1 / 5 dní", () => {
    expect(popisVybranychDni([`${ROK}-09-30`, `${ROK}-10-02`])).toBe("30. 9.–2. 10. (2 dny)");
    expect(popisVybranychDni([`${ROK}-12-31`, `${ROK + 1}-01-04`])).toBe(
      `31. 12. ${ROK}–4. 1. ${ROK + 1} (2 dny)`,
    );
    expect(popisVybranychDni([ZAJTRA])).toBe("8. 10. (1 den)");
    expect(popisVybranychDni([den(5), den(6), den(7), den(8), den(9)])).toBe(
      "12.–16. 10. (5 dní)",
    );
  });
});

describe("spätný zápis a dopredu (bod 2)", () => {
  it("povolený rozsah podľa druhu", () => {
    expect(povolenyRozsah("SluzobnaCesta", DNES)).toEqual({ min: den(-40), max: den(90) });
    expect(povolenyRozsah("HomeOffice", DNES)).toEqual({ min: den(-40), max: den(90) });
    expect(povolenyRozsah("SpatnaPritomnost", DNES)).toEqual({ min: den(-40), max: DNES });
    expect(povolenyRozsah("Dovolenka", DNES).min).toBe(DNES);
    expect(povolenyRozsah("NahradneVolno", DNES).min).toBe(DNES);
  });

  it("SC a HO: 40 dní dozadu áno, 41 nie; 90 dopredu áno, 91 nie", () => {
    // den(-40) = 28. 8. (Pi), den(-41) = 27. 8. (Št)
    expect(rozpisNovuZiadost(ho(den(-40)), ctx()).ok).toBe(true);
    expect(chyba(rozpisNovuZiadost(ho(den(-41)), ctx()))).toMatch(/40 dní zpětně/);
    const sc = (datum: string): NovaZiadostVstup => ({
      druh: "SluzobnaCesta",
      dni: [{ datum, odMin: 8 * H, doMin: 16 * H }],
    });
    expect(rozpisNovuZiadost(sc(den(90)), ctx()).ok).toBe(true);
    expect(chyba(rozpisNovuZiadost(sc(den(91)), ctx()))).toMatch(/90 dní dopředu/);
  });

  it("dovolenka a NV bez spätného zadania", () => {
    expect(chyba(rozpisNovuZiadost(dovolenka(den(-1)), ctx()))).toMatch(/nelze zadat zpětně/);
    expect(
      chyba(
        rozpisNovuZiadost(
          { druh: "NahradneVolno", dni: [{ datum: den(-1), celyDen: true, hodiny: 0 }] },
          ctx(),
        ),
      ),
    ).toMatch(/nelze zadat zpětně/);
  });
});

describe("rozpis novej žiadosti — pravidlá", () => {
  it("služobná cesta: poznámka nepovinná, časy musia byť platné", () => {
    const dni = [{ datum: ZAJTRA, odMin: 8 * H, doMin: 16 * H + 30 }];
    const bez = rozpisNovuZiadost({ druh: "SluzobnaCesta", dni }, ctx());
    expect(bez.ok && bez.polozky[0].poznamka).toBe("");
    const s = rozpisNovuZiadost({ druh: "SluzobnaCesta", dni, poznamka: " Brno " }, ctx());
    expect(s.ok && s.polozky[0].poznamka).toBe("Brno");
    expect(
      chyba(
        rozpisNovuZiadost(
          { druh: "HomeOffice", dni: [{ datum: ZAJTRA, odMin: 16 * H, doMin: 8 * H }] },
          ctx(),
        ),
      ),
    ).toMatch(/čas do/);
    expect(chyba(rozpisNovuZiadost({ druh: "HomeOffice", dni: [] }, ctx()))).toMatch(/alespoň jeden/);
    expect(chyba(rozpisNovuZiadost(ho(ZAJTRA, ZAJTRA), ctx()))).toMatch(/dvakrát/);
  });

  it("home office: jedna položka na deň, schválené automaticky", () => {
    const r = rozpisNovuZiadost(
      {
        druh: "HomeOffice",
        dni: [
          { datum: ZAJTRA, odMin: 8 * H, doMin: 16 * H + 30 },
          { datum: POZAJTRA, odMin: 9 * H, doMin: 17 * H },
        ],
      },
      ctx(),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.polozky).toHaveLength(2);
    expect(r.polozky[1].od).toBe(iso(POZAJTRA, 9 * H));
    expect(r.polozky[0].hodiny).toBe(8.5);
    expect(new Set(r.polozky.map((p) => p.title)).size).toBe(1);
    expect(r.polozky.every((p) => p.stav === "Schvalene" && p.schvalilEmail === "auto")).toBe(true);
  });

  it("spätná prítomnosť: viac dní, každý vlastný príchod/odchod, spoločný dôvod", () => {
    const sp = (dni: { datum: string; odMin: number; doMin: number }[], dovod = "zabudol som") =>
      rozpisNovuZiadost({ druh: "SpatnaPritomnost", dni, dovod }, ctx());
    const den1 = { datum: den(-2), odMin: 7 * H, doMin: 15 * H };
    const den2 = { datum: den(-40), odMin: 6 * H + 30, doMin: 14 * H };
    expect(chyba(sp([{ ...den1, datum: den(-41) }]))).toMatch(/40 dní/);
    expect(chyba(sp([{ ...den1, datum: ZAJTRA }]))).toMatch(/budoucnosti/);
    expect(chyba(sp([den1], " "))).toMatch(/důvod/i);
    // dnes je 10:00, odchod 15:00 ešte nenastal
    expect(chyba(sp([{ ...den1, datum: DNES }]))).toMatch(/budoucnosti/);
    expect(chyba(sp([{ ...den1, doMin: 6 * H }]))).toMatch(/odchodu/);
    const ok = sp([den1, den2]);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.polozky.map((p) => p.od)).toEqual([iso(den(-40), 6 * H + 30), iso(den(-2), 7 * H)]);
    expect(ok.polozky.every((p) => p.stav === "Ziadost" && p.poznamka === "zabudol som")).toBe(true);
    expect(ok.polozky[0].title).toBe("Zpětná přítomnost 28. 8.–5. 10. (2 dny) #x1y2z3");
  });

  it("dovolenka: nesúvislé dni, každý deň celý / dopoludnie / popoludnie", () => {
    const r = rozpisNovuZiadost(
      {
        druh: "Dovolenka",
        dni: [
          { datum: den(9), castDna: "Cely" },
          { datum: PONDELOK, castDna: "Dopoludnie" },
          { datum: den(7), castDna: "Popoludnie" },
        ],
      },
      ctx({ dennyFondHod: 7.5 }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.polozky.map((p) => [p.od, p.castDna, p.hodiny])).toEqual([
      [iso(PONDELOK, 0), "Dopoludnie", 3.75],
      [iso(den(7), 0), "Popoludnie", 3.75],
      [iso(den(9), 0), "Cely", 7.5],
    ]);
    expect(r.polozky[0].title).toBe("Dovolená 12.–16. 10. (3 dny) #x1y2z3");
  });

  it("dovolenka: víkend ani sviatok sa nedá zadať", () => {
    expect(chyba(rozpisNovuZiadost(dovolenka(POZAJTRA, SOBOTA, PONDELOK), ctx()))).toMatch(
      /So 10\. 10\. není pracovní den/,
    );
    expect(chyba(rozpisNovuZiadost(dovolenka(SVIATOK), ctx()))).toMatch(/St 28\. 10\. není pracovní/);
  });

  it("náhradné voľno: viac dní, celý deň alebo hodiny v rozsahu fondu", () => {
    const zle = rozpisNovuZiadost(
      {
        druh: "NahradneVolno",
        dni: [
          { datum: ZAJTRA, celyDen: true, hodiny: 0 },
          { datum: POZAJTRA, celyDen: false, hodiny: 9 },
        ],
      },
      ctx(),
    );
    expect(chyba(zle)).toMatch(/9\. 10\.: počet hodin musí být mezi 0 a 8/);
    const ok = rozpisNovuZiadost(
      {
        druh: "NahradneVolno",
        dni: [
          { datum: ZAJTRA, celyDen: true, hodiny: 0 },
          { datum: POZAJTRA, celyDen: false, hodiny: 3 },
        ],
      },
      ctx({ dennyFondHod: 7.5 }),
    );
    expect(ok.ok && ok.polozky.map((p) => [p.castDna, p.hodiny])).toEqual([
      ["Cely", 7.5],
      [null, 3],
    ]);
    expect(
      chyba(
        rozpisNovuZiadost(
          { druh: "NahradneVolno", dni: [{ datum: SOBOTA, celyDen: true, hodiny: 0 }] },
          ctx(),
        ),
      ),
    ).toMatch(/pracovní/);
  });

  it("prekryv s existujúcou vlastnou aktívnou žiadosťou", () => {
    const hoZajtra: ZiadostPreKontrolu = {
      druh: "HomeOffice",
      od: iso(ZAJTRA, 8 * H),
      do: iso(ZAJTRA, 16 * H + 30),
      stav: "Schvalene",
    };
    const dopoludnie: ZiadostPreKontrolu = {
      druh: "Dovolenka",
      od: iso(POZAJTRA, 0),
      do: iso(POZAJTRA, 23 * H + 59),
      castDna: "Dopoludnie",
      stav: "Ziadost",
    };
    expect(
      chyba(
        rozpisNovuZiadost(
          { druh: "Dovolenka", dni: [{ datum: ZAJTRA, castDna: "Popoludnie" }, { datum: PONDELOK, castDna: "Cely" }] },
          ctx({ existujuce: [hoZajtra] }),
        ),
      ),
    ).toContain(`Překrývá se s tvou žádostí: Home office ${denMesiac(ZAJTRA)} (schváleno)`);
    // dopoludnie + popoludnie toho istého dňa sa neprekrývajú
    expect(
      rozpisNovuZiadost(
        { druh: "Dovolenka", dni: [{ datum: POZAJTRA, castDna: "Popoludnie" }] },
        ctx({ existujuce: [dopoludnie] }),
      ).ok,
    ).toBe(true);
    // zrušená žiadosť neblokuje
    expect(
      rozpisNovuZiadost(ho(ZAJTRA), ctx({ existujuce: [{ ...hoZajtra, stav: "Zrusene" }] })).ok,
    ).toBe(true);
    // v kalendári je obsadený len deň s aktívnou žiadosťou
    expect([...obsadeneDni([hoZajtra, dopoludnie, { ...hoZajtra, od: iso(PONDELOK, 8 * H), stav: "Zamietnute" }])]).toEqual([
      ZAJTRA,
      POZAJTRA,
    ]);
  });
});

function zaznam(over: Partial<ZiadostZaznam>): ZiadostZaznam {
  return {
    id: "1",
    title: "",
    zamestnanecEmail: "jan@firma.cz",
    druh: "Dovolenka",
    od: iso(ZAJTRA, 0),
    do: iso(ZAJTRA, 23 * H + 59),
    castDna: "Cely",
    hodiny: 8,
    poznamka: "",
    stav: "Ziadost",
    schvalovatelEmail: "sef@firma.cz",
    schvalilEmail: "",
    schvalenieCas: "",
    dovodZamietnutia: "",
    ...over,
  };
}

describe("kto smie schváliť", () => {
  const cudzia = { zamestnanecEmail: "jan@firma.cz", schvalovatelEmail: "sef@firma.cz" };
  it("schvaľovateľ a HR cudziu žiadosť", () => {
    expect(smieRozhodnut(cudzia, "Sef@firma.cz", false)).toBe(true);
    expect(smieRozhodnut(cudzia, "hr@firma.cz", true)).toBe(true);
    expect(smieRozhodnut(cudzia, "eva@firma.cz", false)).toBe(false);
  });
  it("vlastnú len sám sebe nadriadený — ani HR nie", () => {
    const sebe = { zamestnanecEmail: "sef@firma.cz", schvalovatelEmail: "SEF@firma.cz " };
    expect(smieRozhodnut(sebe, "sef@firma.cz", false)).toBe(true);
    const hrVlastna = { zamestnanecEmail: "hr@firma.cz", schvalovatelEmail: "sef@firma.cz" };
    expect(smieRozhodnut(hrVlastna, "hr@firma.cz", true)).toBe(false);
    expect(smieRozhodnut(hrVlastna, "sef@firma.cz", false)).toBe(true);
  });
});

describe("zoskupenie a zobrazenie po dňoch", () => {
  it("zoskupí podľa #id a zamestnanca", () => {
    const tretiDen = den(3);
    const t = `Dovolená 8.–10. 10. (3 dny) #aaa111`;
    const skupiny = zoskupZiadosti([
      zaznam({ id: "2", title: t, od: iso(POZAJTRA, 0), do: iso(POZAJTRA, 23 * H + 59) }),
      zaznam({ id: "1", title: t }),
      zaznam({ id: "3", title: t, od: iso(tretiDen, 0), do: iso(tretiDen, 23 * H + 59) }),
      zaznam({ id: "4", title: t, zamestnanecEmail: "eva@firma.cz" }),
      zaznam({ id: "5", title: "bez skupiny" }),
    ]);
    expect(skupiny).toHaveLength(3);
    const jan = skupiny.find((s) => s.key === "jan@firma.cz#aaa111")!;
    expect(jan.polozky.map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(jan.hodiny).toBe(24);
    expect(jan.od).toBe(iso(ZAJTRA, 0));
    expect(jan.do).toBe(iso(tretiDen, 23 * H + 59));
    expect(skupiny.some((s) => s.key === "id:5")).toBe(true);
  });

  it("vypíše konkrétne dni, nie len rozsah", () => {
    const t = "Dovolená 8.–12. 10. (3 dny) #bbb222";
    const [s] = zoskupZiadosti([
      zaznam({ id: "1", title: t }),
      zaznam({ id: "2", title: t, od: iso(POZAJTRA, 0), castDna: "Dopoludnie", hodiny: 4 }),
      zaznam({ id: "3", title: t, od: iso(PONDELOK, 0) }),
    ]);
    expect(popisTerminu(s)).toBe("8.–12. 10. (3 dny)");
    expect(s.polozky.map(popisDnaZiadosti)).toEqual(["Čt 8. 10.", "Pá 9. 10. dopoledne", "Po 12. 10."]);
    const hoDen = zaznam({ druh: "HomeOffice", od: iso(ZAJTRA, 8 * H), do: iso(ZAJTRA, 16 * H + 30) });
    expect(popisDnaZiadosti(hoDen)).toBe("Čt 8. 10. 8:00–16:30");
    expect(popisTerminu({ ...hoDen, polozky: [hoDen] })).toBe("8. 10. 8:00–16:30");
    expect(
      popisDnaZiadosti(zaznam({ druh: "NahradneVolno", castDna: "", hodiny: 3.5 })),
    ).toBe("Čt 8. 10. 3,5 h");
  });
});

describe("zrušenie žiadosti — len dni, ktoré ešte nenastali (bod 3)", () => {
  const teraz = () => Date.now();

  it("zajtrajší HO sa dá zrušiť", () => {
    const p = zaznam({ druh: "HomeOffice", stav: "Schvalene", od: iso(ZAJTRA, 8 * H), do: iso(ZAJTRA, 16 * H) });
    expect(mozeZrusitDen(p, teraz())).toBe(true);
  });

  it("dnešný HO od 8:00 o 10:00 sa zrušiť nedá", () => {
    const p = zaznam({ druh: "HomeOffice", stav: "Schvalene", od: iso(DNES, 8 * H), do: iso(DNES, 16 * H) });
    expect(mozeZrusitDen(p, teraz())).toBe(false);
    const [s] = zoskupZiadosti([{ ...p, title: "HO #c1" }]);
    expect(mozeZrusitSkupinu(s, teraz())).toBe(false);
  });

  it("skupina 3 dní s jedným minulým: zruší sa len budúca časť", () => {
    const t = "Home office 6.–9. 10. (3 dny) #ddd444";
    const dni = [den(-1), ZAJTRA, POZAJTRA].map((d, i) =>
      zaznam({ id: String(i + 1), title: t, druh: "HomeOffice", stav: "Schvalene", od: iso(d, 8 * H), do: iso(d, 16 * H) }),
    );
    const [s] = zoskupZiadosti(dni);
    expect(mozeZrusitSkupinu(s, teraz())).toBe(true);
    const { zrusit, ostava } = rozdelPreZrusenie(s.polozky, teraz());
    expect(zrusit.map((p) => p.id)).toEqual(["2", "3"]);
    expect(ostava.map((p) => p.id)).toEqual(["1"]);
  });

  it("schválená dovolenka budúci týždeň sa dá zrušiť", () => {
    const t = "Dovolená 12.–13. 10. (2 dny) #eee555";
    const [s] = zoskupZiadosti([
      zaznam({ id: "1", title: t, stav: "Schvalene", od: iso(PONDELOK, 0) }),
      zaznam({ id: "2", title: t, stav: "Schvalene", od: iso(den(6), 0) }),
    ]);
    expect(rozdelPreZrusenie(s.polozky, teraz()).zrusit).toHaveLength(2);
  });

  it("dnešná dovolenka (od 0:00) ani neaktívne dni sa zrušiť nedajú", () => {
    expect(mozeZrusitDen(zaznam({ od: iso(DNES, 0) }), teraz())).toBe(false);
    const buduca = { od: iso(ZAJTRA, 0) };
    expect(mozeZrusitDen({ ...buduca, stav: "Zamietnute" }, teraz())).toBe(false);
    expect(mozeZrusitDen({ ...buduca, stav: "Zrusene" }, teraz())).toBe(false);
    expect(mozeZrusitDen({ ...buduca, stav: "Ziadost" }, teraz())).toBe(true);
    expect(rozdelPreZrusenie([{ ...buduca, stav: "Zrusene" }], teraz())).toEqual({ zrusit: [], ostava: [] });
  });
});
