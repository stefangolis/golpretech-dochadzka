/**
 * Žiadosti dochádzky (DochadzkaZiadosti) — čistý modul bez React Native závislostí.
 * Jedna položka v SharePointe = jeden deň; viacdenná žiadosť drží skupinu v Title ("#id").
 */
import { cs, pocetDni } from "../i18n/cs";
import { formatDatumKratce, formatDenKratce, formatRozsahDni } from "../i18n/datum";
import {
  pragueDateKey,
  pragueLocalToUtcMs,
  pragueMinutyDna,
} from "./dochadzkaVypocet";

export const ZIADOST_DRUHY = [
  "SluzobnaCesta",
  "HomeOffice",
  "SpatnaPritomnost",
  "Dovolenka",
  "NahradneVolno",
] as const;
export type ZiadostDruh = (typeof ZIADOST_DRUHY)[number];

export const ZIADOST_DRUH_LABEL: Record<ZiadostDruh, string> = cs.zadosti.druh;

export const ZIADOST_STAVY = ["Ziadost", "Schvalene", "Zamietnute", "Zrusene"] as const;
export type ZiadostStav = (typeof ZIADOST_STAVY)[number];

export const ZIADOST_STAV_LABEL: Record<ZiadostStav, string> = cs.zadosti.stav;

export const CAST_DNA = ["Cely", "Dopoludnie", "Popoludnie"] as const;
export type CastDna = (typeof CAST_DNA)[number];

export const CAST_DNA_LABEL: Record<CastDna, string> = cs.zadosti.castDna;

/** Služobná cesta a home office sa schvaľujú automaticky. */
export const AUTO_SCHVALENE_DRUHY: ReadonlySet<ZiadostDruh> = new Set([
  "SluzobnaCesta",
  "HomeOffice",
]);
export const SCHVALIL_AUTO = "auto";
export const DEFAULT_DENNY_FOND_HOD = 8;
/** Služobná cesta, home office a spätná prítomnosť: najviac toľko dní dozadu. */
export const SPATNY_ZAPIS_MAX_DNI = 40;
/** Služobná cesta a home office: najviac toľko dní dopredu. */
export const ZIADOST_DOPREDU_MAX_DNI = 90;
/** Dovolenka a náhradné voľno: najviac toľko dní dopredu (spätne nie). */
export const ABSENCIA_DOPREDU_MAX_DNI = 365;
export const MAX_DNI_ZIADOSTI = 31;
export const MAX_DNI_DOVOLENKY = 60;
export const PREDVOLENY_CAS_OD = 8 * 60;
export const PREDVOLENY_CAS_DO = 16 * 60 + 30;

export function ziadostDruhLabel(druh: string): string {
  return (ZIADOST_DRUH_LABEL as Record<string, string>)[druh] ?? druh;
}

export function ziadostStavLabel(stav: string): string {
  return (ZIADOST_STAV_LABEL as Record<string, string>)[stav] ?? stav;
}

export function jeAktivnaZiadost(stav: string): boolean {
  return stav === "Ziadost" || stav === "Schvalene";
}

// ---------------------------------------------------------------------------
// Kalendár (dátumy YYYY-MM-DD, bez časových pásiem)

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function keyFromUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function utcFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function pridajDni(key: string, dni: number): string {
  const d = utcFromKey(key);
  d.setUTCDate(d.getUTCDate() + dni);
  return keyFromUtc(d);
}

/** Všetky dni od–do vrátane (prázdne pole, ak od > do). */
export function dniVRozsahu(od: string, doKey: string): string[] {
  const out: string[] = [];
  for (let k = od; k <= doKey && out.length < 400; k = pridajDni(k, 1)) out.push(k);
  return out;
}

/** Veľkonočná nedeľa (gregoriánsky kalendár, anonymný algoritmus). */
export function velkonocnaNedela(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

const sviatkyCache = new Map<number, ReadonlySet<string>>();

/** Štátne sviatky a dni pracovného pokoja v ČR vrátane Veľkého piatku a Veľkonočného pondelka. */
export function statneSviatkyCR(year: number): ReadonlySet<string> {
  const cached = sviatkyCache.get(year);
  if (cached) return cached;
  const nedela = velkonocnaNedela(year);
  const pevne = [
    "01-01",
    "05-01",
    "05-08",
    "07-05",
    "07-06",
    "09-28",
    "10-28",
    "11-17",
    "12-24",
    "12-25",
    "12-26",
  ].map((md) => `${year}-${md}`);
  const set = new Set([...pevne, pridajDni(nedela, -2), pridajDni(nedela, 1)]);
  sviatkyCache.set(year, set);
  return set;
}

export function jeStatnySviatokCR(key: string): boolean {
  return statneSviatkyCR(Number(key.slice(0, 4))).has(key);
}

export function jeVikend(key: string): boolean {
  const dow = utcFromKey(key).getUTCDay();
  return dow === 0 || dow === 6;
}

export function jePracovnyDen(key: string): boolean {
  return !jeVikend(key) && !jeStatnySviatokCR(key);
}

export function pracovneDni(od: string, doKey: string): string[] {
  return dniVRozsahu(od, doKey).filter(jePracovnyDen);
}

export function hodinyCastiDna(castDna: CastDna, dennyFondHod: number): number {
  return castDna === "Cely" ? dennyFondHod : dennyFondHod / 2;
}

/** Hodiny dovolenky: súčet za pracovné dni, celý deň = denný fond, pol dňa = polovica. */
export function hodinyDovolenky(dni: readonly DenDovolenky[], dennyFondHod: number): number {
  return dni
    .filter((d) => jePracovnyDen(d.datum))
    .reduce((s, d) => s + hodinyCastiDna(d.castDna, dennyFondHod), 0);
}

// ---------------------------------------------------------------------------
// Povolený rozsah dní pre výber v kalendári

export type PovolenyRozsah = { min: string; max: string };

export function povolenyRozsah(druh: ZiadostDruh, dnes: string): PovolenyRozsah {
  switch (druh) {
    case "SluzobnaCesta":
    case "HomeOffice":
      return {
        min: pridajDni(dnes, -SPATNY_ZAPIS_MAX_DNI),
        max: pridajDni(dnes, ZIADOST_DOPREDU_MAX_DNI),
      };
    case "SpatnaPritomnost":
      return { min: pridajDni(dnes, -SPATNY_ZAPIS_MAX_DNI), max: dnes };
    case "Dovolenka":
    case "NahradneVolno":
      return { min: dnes, max: pridajDni(dnes, ABSENCIA_DOPREDU_MAX_DNI) };
  }
}

/** Dovolenka a náhradné voľno len v pracovné dni. */
export function lenPracovneDniDruhu(druh: ZiadostDruh): boolean {
  return druh === "Dovolenka" || druh === "NahradneVolno";
}

export function maxDniDruhu(druh: ZiadostDruh): number {
  return druh === "Dovolenka" ? MAX_DNI_DOVOLENKY : MAX_DNI_ZIADOSTI;
}

// ---------------------------------------------------------------------------
// Čas H:MM

/** "8:00", "08:30", "8.30", "830" → minúty dňa; neplatné → null. */
export function parseCasHHMM(raw: string): number | null {
  const s = raw.trim().replace(".", ":");
  let h: number;
  let m: number;
  const match = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (match) {
    h = Number(match[1]);
    m = Number(match[2]);
  } else if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, s.length - 2));
    m = Number(s.slice(-2));
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s);
    m = 0;
  } else {
    return null;
  }
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
}

export function formatCasHHMM(min: number): string {
  return `${Math.floor(min / 60)}:${pad2(min % 60)}`;
}

export function formatHodiny(h: number): string {
  const r = Math.round(h * 100) / 100;
  return `${String(r).replace(".", ",")} h`;
}

// ---------------------------------------------------------------------------
// Skupina v Title: "Dovolená 4.–9. 10. (4 dny) #<id>" (staršie: "<Druh> <od>–<do> #<id>")

export function novaSkupinaId(rand: () => number = Math.random): string {
  let s = "";
  while (s.length < 6) s += Math.floor(rand() * 36).toString(36);
  return s.slice(0, 6);
}

function zoradeneJedinecne(datumy: readonly string[]): string[] {
  return [...new Set(datumy)].sort();
}

/** "4.–9. 10. (4 dny)" — prvý–posledný deň a počet vybraných dní. */
export function popisVybranychDni(datumy: readonly string[]): string {
  const dni = zoradeneJedinecne(datumy);
  if (!dni.length) return "";
  return `${formatRozsahDni(dni[0], dni[dni.length - 1])} (${pocetDni(dni.length)})`;
}

export function buildZiadostTitle(
  druh: ZiadostDruh,
  datumy: readonly string[],
  skupinaId: string,
): string {
  return `${ZIADOST_DRUH_LABEL[druh]} ${popisVybranychDni(datumy)} #${skupinaId}`;
}

export function parseSkupinaId(title: string): string | null {
  const m = /#([a-z0-9]+)\s*$/i.exec(title.trim());
  return m ? m[1].toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Nová žiadosť → položky po dňoch

/** SC/HO: čas od–do; spätná prítomnosť: príchod–odchod. */
export type DenCasu = { datum: string; odMin: number; doMin: number };
export type DenDovolenky = { datum: string; castDna: CastDna };
export type DenNahradnehoVolna = { datum: string; celyDen: boolean; hodiny: number };

export type NovaZiadostVstup =
  | { druh: "SluzobnaCesta"; dni: DenCasu[]; poznamka?: string }
  | { druh: "HomeOffice"; dni: DenCasu[] }
  | { druh: "SpatnaPritomnost"; dni: DenCasu[]; dovod: string }
  | { druh: "Dovolenka"; dni: DenDovolenky[] }
  | { druh: "NahradneVolno"; dni: DenNahradnehoVolna[] };

export type ZiadostPolozkaNova = {
  title: string;
  druh: ZiadostDruh;
  /** ISO UTC */
  od: string;
  /** ISO UTC */
  do: string;
  castDna: CastDna | null;
  hodiny: number;
  poznamka: string;
  stav: ZiadostStav;
  schvalilEmail: string | null;
  schvalenieCas: string | null;
};

/** Existujúca žiadosť pre kontrolu prekrytia. */
export type ZiadostPreKontrolu = {
  druh: string;
  od: string;
  do: string;
  castDna?: string | null;
  stav: string;
};

export type RozpisKontext = {
  /** Dnešný pražský dátum */
  dnes: string;
  nowMs: number;
  dennyFondHod: number;
  skupinaId: string;
  existujuce: ZiadostPreKontrolu[];
};

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Od = 00:00, Do = 23:59 v Prahe (dovolenka, náhradné voľno). */
function celyDenIso(datum: string): { od: string; do: string } {
  return {
    od: iso(pragueLocalToUtcMs(datum, 0)),
    do: iso(pragueLocalToUtcMs(datum, 23 * 60 + 59)),
  };
}

/** Interval na kontrolu prekrytia; pol dňa dovolenky = 0–12 / 12–24 h. */
export function intervalPrekrytia(z: ZiadostPreKontrolu): [number, number] {
  const od = Date.parse(z.od);
  const doMs = Date.parse(z.do);
  if (z.druh === "Dovolenka" && (z.castDna === "Dopoludnie" || z.castDna === "Popoludnie")) {
    const datum = pragueDateKey(od);
    const poludnie = pragueLocalToUtcMs(datum, 12 * 60);
    return z.castDna === "Dopoludnie"
      ? [pragueLocalToUtcMs(datum, 0), poludnie]
      : [poludnie, pragueLocalToUtcMs(datum, 24 * 60)];
  }
  if (z.druh === "Dovolenka" || z.druh === "NahradneVolno") {
    const datum = pragueDateKey(od);
    return [pragueLocalToUtcMs(datum, 0), pragueLocalToUtcMs(datum, 24 * 60)];
  }
  return [od, doMs];
}

export function najdiPrekrytie(
  nove: ZiadostPreKontrolu[],
  existujuce: ZiadostPreKontrolu[],
): ZiadostPreKontrolu | null {
  const aktivne = existujuce.filter((e) => jeAktivnaZiadost(e.stav));
  for (const n of nove) {
    const [a, b] = intervalPrekrytia(n);
    for (const e of aktivne) {
      const [c, d] = intervalPrekrytia(e);
      if (a < d && c < b) return e;
    }
  }
  return null;
}

function popisPrekrytia(e: ZiadostPreKontrolu): string {
  return `${ziadostDruhLabel(e.druh)} ${formatDatumKratce(pragueDateKey(e.od))} (${ziadostStavLabel(e.stav).toLowerCase()})`;
}

/** Dni (pražské), na ktoré už existuje vlastná aktívna žiadosť — v kalendári sa nedajú vybrať. */
export function obsadeneDni(existujuce: readonly ZiadostPreKontrolu[]): Set<string> {
  const out = new Set<string>();
  for (const e of existujuce) {
    if (jeAktivnaZiadost(e.stav)) out.add(pragueDateKey(e.od));
  }
  return out;
}

export type RozpisVysledok =
  | { ok: true; polozky: ZiadostPolozkaNova[] }
  | { ok: false; chyba: string };

function chyba(text: string): RozpisVysledok {
  return { ok: false, chyba: text };
}

/**
 * Spoločné pravidlá výberu dní: aspoň jeden, bez duplicít, max. počet,
 * povolený rozsah podľa druhu (40 dní dozadu / 90 dopredu…), pri absenciách len pracovné dni.
 */
export function overVybraneDni(
  druh: ZiadostDruh,
  datumy: readonly string[],
  dnes: string,
): string | null {
  const ch = cs.zadosti.chyby;
  if (!datumy.length) return ch.vyberteDen;
  const videne = new Set<string>();
  for (const d of datumy) {
    if (videne.has(d)) return ch.denDvakrat(formatDatumKratce(d));
    videne.add(d);
  }
  const max = maxDniDruhu(druh);
  if (datumy.length > max) return ch.maxDni(max);
  const { min, max: maxDatum } = povolenyRozsah(druh, dnes);
  const label = ZIADOST_DRUH_LABEL[druh];
  for (const d of zoradeneJedinecne(datumy)) {
    if (d < min) {
      return lenPracovneDniDruhu(druh) ? ch.neZpetne(label) : ch.zpetneNejvys(label, SPATNY_ZAPIS_MAX_DNI);
    }
    if (d > maxDatum) {
      if (druh === "SpatnaPritomnost") return ch.zpetnaNeDoBudoucna;
      return ch.dopreduNejvys(
        label,
        lenPracovneDniDruhu(druh) ? ABSENCIA_DOPREDU_MAX_DNI : ZIADOST_DOPREDU_MAX_DNI,
      );
    }
    if (lenPracovneDniDruhu(druh) && !jePracovnyDen(d)) {
      return ch.nepracovniDen(formatDenKratce(d));
    }
  }
  return null;
}

function hodinyIntervalu(odMs: number, doMs: number): number {
  return Math.round(((doMs - odMs) / 3_600_000) * 100) / 100;
}

function zoradPodlaDatumu<T extends { datum: string }>(dni: readonly T[]): T[] {
  return [...dni].sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
}

function rozpisDni(
  vstup: { druh: "SluzobnaCesta" | "HomeOffice"; dni: DenCasu[] },
  poznamka: string,
  ctx: RozpisKontext,
): RozpisVysledok {
  const dni = zoradPodlaDatumu(vstup.dni);
  for (const d of dni) {
    if (d.doMin <= d.odMin) return chyba(cs.zadosti.chyby.casDoPozdeji(formatDatumKratce(d.datum)));
  }
  const title = buildZiadostTitle(vstup.druh, dni.map((d) => d.datum), ctx.skupinaId);
  const schvalenieCas = iso(ctx.nowMs);
  return {
    ok: true,
    polozky: dni.map((d) => {
      const od = pragueLocalToUtcMs(d.datum, d.odMin);
      const doMs = pragueLocalToUtcMs(d.datum, d.doMin);
      return {
        title,
        druh: vstup.druh,
        od: iso(od),
        do: iso(doMs),
        castDna: null,
        hodiny: hodinyIntervalu(od, doMs),
        poznamka,
        stav: "Schvalene",
        schvalilEmail: SCHVALIL_AUTO,
        schvalenieCas,
      };
    }),
  };
}

/**
 * Rozpíše novú žiadosť na položky po dňoch a overí pravidlá (rozsah, časy, dôvod, prekrytie).
 */
export function rozpisNovuZiadost(
  vstup: NovaZiadostVstup,
  ctx: RozpisKontext,
): RozpisVysledok {
  const fond = ctx.dennyFondHod > 0 ? ctx.dennyFondHod : DEFAULT_DENNY_FOND_HOD;
  const ch = cs.zadosti.chyby;
  const chybaDni = overVybraneDni(
    vstup.druh,
    vstup.dni.map((d) => d.datum),
    ctx.dnes,
  );
  if (chybaDni) return chyba(chybaDni);
  let vysledok: RozpisVysledok;

  switch (vstup.druh) {
    case "SluzobnaCesta":
      vysledok = rozpisDni(vstup, vstup.poznamka?.trim() ?? "", ctx);
      break;
    case "HomeOffice":
      vysledok = rozpisDni(vstup, "", ctx);
      break;
    case "SpatnaPritomnost": {
      const dovod = vstup.dovod.trim();
      if (!dovod) return chyba(ch.vyplnteDuvod);
      const dni = zoradPodlaDatumu(vstup.dni);
      const title = buildZiadostTitle(vstup.druh, dni.map((d) => d.datum), ctx.skupinaId);
      const polozky: ZiadostPolozkaNova[] = [];
      for (const d of dni) {
        const den = formatDatumKratce(d.datum);
        if (d.doMin <= d.odMin) return chyba(ch.odchodPozdeji(den));
        const od = pragueLocalToUtcMs(d.datum, d.odMin);
        const doMs = pragueLocalToUtcMs(d.datum, d.doMin);
        if (doMs > ctx.nowMs) return chyba(ch.odchodVBudoucnu(den));
        polozky.push({
          title,
          druh: vstup.druh,
          od: iso(od),
          do: iso(doMs),
          castDna: null,
          hodiny: hodinyIntervalu(od, doMs),
          poznamka: dovod,
          stav: "Ziadost",
          schvalilEmail: null,
          schvalenieCas: null,
        });
      }
      vysledok = { ok: true, polozky };
      break;
    }
    case "Dovolenka": {
      const dni = zoradPodlaDatumu(vstup.dni);
      const title = buildZiadostTitle(vstup.druh, dni.map((d) => d.datum), ctx.skupinaId);
      vysledok = {
        ok: true,
        polozky: dni.map((d) => ({
          title,
          druh: vstup.druh,
          ...celyDenIso(d.datum),
          castDna: d.castDna,
          hodiny: hodinyCastiDna(d.castDna, fond),
          poznamka: "",
          stav: "Ziadost",
          schvalilEmail: null,
          schvalenieCas: null,
        })),
      };
      break;
    }
    case "NahradneVolno": {
      const dni = zoradPodlaDatumu(vstup.dni);
      const title = buildZiadostTitle(vstup.druh, dni.map((d) => d.datum), ctx.skupinaId);
      const polozky: ZiadostPolozkaNova[] = [];
      for (const d of dni) {
        const hodiny = d.celyDen ? fond : d.hodiny;
        if (!(hodiny > 0) || hodiny > fond) {
          return chyba(ch.hodinyMezi(formatDatumKratce(d.datum), String(fond).replace(".", ",")));
        }
        polozky.push({
          title,
          druh: vstup.druh,
          ...celyDenIso(d.datum),
          castDna: d.celyDen ? "Cely" : null,
          hodiny,
          poznamka: "",
          stav: "Ziadost",
          schvalilEmail: null,
          schvalenieCas: null,
        });
      }
      vysledok = { ok: true, polozky };
      break;
    }
  }

  if (!vysledok.ok) return vysledok;
  const prekryva = najdiPrekrytie(vysledok.polozky, ctx.existujuce);
  if (prekryva) return chyba(ch.prekryv(popisPrekrytia(prekryva)));
  return vysledok;
}

// ---------------------------------------------------------------------------
// Zoskupenie a zrušenie

export type ZiadostZaznam = {
  id: string;
  title: string;
  zamestnanecEmail: string;
  druh: string;
  od: string;
  do: string;
  castDna: string;
  hodiny: number | null;
  poznamka: string;
  stav: string;
  schvalovatelEmail: string;
  schvalilEmail: string;
  schvalenieCas: string;
  dovodZamietnutia: string;
};

export type ZiadostSkupina<T extends ZiadostZaznam = ZiadostZaznam> = {
  key: string;
  druh: string;
  zamestnanecEmail: string;
  /** Najskorší Od (ISO) */
  od: string;
  /** Najneskorší Do (ISO) */
  do: string;
  stav: string;
  hodiny: number;
  poznamka: string;
  dovodZamietnutia: string;
  polozky: T[];
};

function spolocnyStav(stavy: string[]): string {
  if (stavy.every((s) => s === stavy[0])) return stavy[0] ?? "";
  if (stavy.includes("Ziadost")) return "Ziadost";
  if (stavy.includes("Schvalene")) return "Schvalene";
  return stavy[0] ?? "";
}

/** Položky s rovnakým #id v Title (a rovnakým zamestnancom) tvoria jednu žiadosť. */
export function zoskupZiadosti<T extends ZiadostZaznam>(polozky: T[]): ZiadostSkupina<T>[] {
  const map = new Map<string, T[]>();
  for (const p of polozky) {
    const sid = parseSkupinaId(p.title);
    const key = sid ? `${p.zamestnanecEmail.toLowerCase()}#${sid}` : `id:${p.id}`;
    const arr = map.get(key);
    if (arr) arr.push(p);
    else map.set(key, [p]);
  }
  const out: ZiadostSkupina<T>[] = [];
  for (const [key, arr] of map) {
    arr.sort((a, b) => Date.parse(a.od) - Date.parse(b.od));
    out.push({
      key,
      druh: arr[0].druh,
      zamestnanecEmail: arr[0].zamestnanecEmail,
      od: arr[0].od,
      do: arr.reduce((m, p) => (Date.parse(p.do) > Date.parse(m) ? p.do : m), arr[0].do),
      stav: spolocnyStav(arr.map((p) => p.stav)),
      hodiny: Math.round(arr.reduce((s, p) => s + (p.hodiny ?? 0), 0) * 100) / 100,
      poznamka: arr.find((p) => p.poznamka)?.poznamka ?? "",
      dovodZamietnutia: arr.find((p) => p.dovodZamietnutia)?.dovodZamietnutia ?? "",
      polozky: arr,
    });
  }
  return out.sort((a, b) => Date.parse(b.od) - Date.parse(a.od));
}

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Smie `email` schváliť/zamietnuť žiadosť? Vlastnú len vtedy, ak je sám sebe schvaľovateľom
 * (NadriadenyEmail = vlastný email). Cudziu schvaľovateľ zo SchvalovatelEmail alebo HR.
 */
export function smieRozhodnut(
  z: Pick<ZiadostZaznam, "zamestnanecEmail" | "schvalovatelEmail">,
  email: string,
  jeHR: boolean,
): boolean {
  const ja = normEmail(email);
  if (!ja) return false;
  const schvalovatel = normEmail(z.schvalovatelEmail);
  if (normEmail(z.zamestnanecEmail) === ja) return schvalovatel === ja;
  return jeHR || schvalovatel === ja;
}

/**
 * Deň žiadosti (ľubovoľný druh, stav Ziadost aj Schvalene) sa dá zrušiť, len kým nenastal —
 * jeho začiatok (Od) je ešte v budúcnosti.
 */
export function mozeZrusitDen(p: { od: string; stav: string }, nowMs: number): boolean {
  return jeAktivnaZiadost(p.stav) && Date.parse(p.od) > nowMs;
}

/** Rozdelí aktívne dni skupiny na tie, ktoré sa zrušia, a tie, ktoré ostanú platné. */
export function rozdelPreZrusenie<T extends { od: string; stav: string }>(
  polozky: readonly T[],
  nowMs: number,
): { zrusit: T[]; ostava: T[] } {
  const zrusit: T[] = [];
  const ostava: T[] = [];
  for (const p of polozky) {
    if (!jeAktivnaZiadost(p.stav)) continue;
    (mozeZrusitDen(p, nowMs) ? zrusit : ostava).push(p);
  }
  return { zrusit, ostava };
}

export function mozeZrusitSkupinu(
  s: { polozky: readonly { od: string; stav: string }[] },
  nowMs: number,
): boolean {
  return s.polozky.some((p) => mozeZrusitDen(p, nowMs));
}

const DRUHY_S_CASOM: ReadonlySet<string> = new Set([
  "SluzobnaCesta",
  "HomeOffice",
  "SpatnaPritomnost",
]);

/** "St 14. 10. 8:00–16:30" / "St 14. 10. dopoledne" / "St 14. 10. 4 h" / "St 14. 10." */
export function popisDnaZiadosti(p: {
  druh: string;
  od: string;
  do: string;
  castDna?: string | null;
  hodiny?: number | null;
}): string {
  const den = formatDenKratce(pragueDateKey(p.od));
  if (DRUHY_S_CASOM.has(p.druh)) {
    return `${den} ${formatCasHHMM(pragueMinutyDna(p.od))}–${formatCasHHMM(pragueMinutyDna(p.do))}`;
  }
  if (p.castDna === "Dopoludnie" || p.castDna === "Popoludnie") {
    return `${den} ${CAST_DNA_LABEL[p.castDna].toLowerCase()}`;
  }
  if (p.druh === "NahradneVolno" && p.castDna !== "Cely" && p.hodiny != null) {
    return `${den} ${formatHodiny(p.hodiny)}`;
  }
  return den;
}

/** "14. 10. 8:00–16:30" (jeden deň) / "4.–9. 10. (4 dny)" pre nadpis skupiny. */
export function popisTerminu(s: {
  druh: string;
  od: string;
  do: string;
  polozky: readonly { od: string }[];
}): string {
  const dni = s.polozky.map((p) => pragueDateKey(p.od));
  const jedinecne = zoradeneJedinecne(dni.length ? dni : [pragueDateKey(s.od)]);
  if (jedinecne.length === 1) {
    const den = formatDatumKratce(jedinecne[0]);
    return DRUHY_S_CASOM.has(s.druh)
      ? `${den} ${formatCasHHMM(pragueMinutyDna(s.od))}–${formatCasHHMM(pragueMinutyDna(s.do))}`
      : den;
  }
  return popisVybranychDni(jedinecne);
}
