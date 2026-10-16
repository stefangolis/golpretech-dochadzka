/**
 * Výpočet dochádzky — čistý modul bez React Native závislostí (použije ho aj sync služba).
 * Všetky časy sú ISO UTC, deň sa určuje v pásme Europe/Prague.
 */
import { cs } from "../i18n/cs";

export const DOCHADZKA_TYPY = [
  "Prichod",
  "Odchod",
  "SukromnyOdchod",
  "SluzobnyOdchod",
  "Lekar",
  "FajciarskaPrestavka",
] as const;

export type DochadzkaTyp = (typeof DOCHADZKA_TYPY)[number];

export const DOCHADZKA_TYP_LABEL: Record<DochadzkaTyp, string> = cs.dochazka.typ;

/** Typy, ktoré ukončujú pobyt v práci. */
export const ODCHODOVE_TYPY: ReadonlySet<string> = new Set<DochadzkaTyp>([
  "Odchod",
  "SukromnyOdchod",
  "SluzobnyOdchod",
  "Lekar",
  "FajciarskaPrestavka",
]);

/** Prerušenie, ktoré sa po návrate (Príchod) počíta do odpracovaného času. */
export const PRERUSENIE_RATA_SA: ReadonlySet<string> = new Set<DochadzkaTyp>([
  "SluzobnyOdchod",
  "Lekar",
]);

export const OBED_PRAH_MIN = 6 * 60;
export const OBED_ODPOCET_MIN = 30;
export const ZAOKRUHLENIE_MIN = 15;

export type UdalostPreVypocet = {
  typ: string;
  /** ISO UTC */
  cas: string;
  /** Platna / Zrusena; prázdne = platná */
  stav?: string | null;
};

export function isDochadzkaTyp(v: string): v is DochadzkaTyp {
  return (DOCHADZKA_TYPY as readonly string[]).includes(v);
}

export function typLabel(typ: string): string {
  return isDochadzkaTyp(typ) ? DOCHADZKA_TYP_LABEL[typ] : typ;
}

// ---------------------------------------------------------------------------
// Europe/Prague (CET/CEST podľa pravidiel EÚ: letný čas od poslednej nedele
// v marci 01:00 UTC do poslednej nedele v októbri 01:00 UTC).

function lastSundayUtcMs(year: number, monthIndex: number): number {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const day = lastDay.getUTCDate() - lastDay.getUTCDay();
  return Date.UTC(year, monthIndex, day, 1, 0, 0);
}

export function pragueOffsetMinutes(utcMs: number): number {
  const year = new Date(utcMs).getUTCFullYear();
  const summerStart = lastSundayUtcMs(year, 2);
  const summerEnd = lastSundayUtcMs(year, 9);
  return utcMs >= summerStart && utcMs < summerEnd ? 120 : 60;
}

function pragueParts(utcMs: number) {
  const local = new Date(utcMs + pragueOffsetMinutes(utcMs) * 60_000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

function toMs(value: string | number | Date): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  return Date.parse(value);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISO UTC orezané na sekundy (SharePoint DateTime milisekundy neukladá). */
export function isoNaSekundy(ms: number = Date.now()): string {
  return new Date(Math.floor(ms / 1000) * 1000).toISOString();
}

/** Pražský dátum YYYY-MM-DD */
export function pragueDateKey(value: string | number | Date): string {
  const p = pragueParts(toMs(value));
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Pražský čas H:mm (napr. 7:02) */
export function pragueTimeLabel(value: string | number | Date): string {
  const p = pragueParts(toMs(value));
  return `${p.hour}:${pad2(p.minute)}`;
}

/** UTC ms začiatku pražského dňa (polnoc miestneho času). */
export function pragueDayStartUtcMs(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const localMidnightAsUtc = Date.UTC(y, m - 1, d);
  // Prechody času sú o 01:00 UTC, polnoc teda leží vždy pred prechodom v ten deň.
  const offset = pragueOffsetMinutes(localMidnightAsUtc - 120 * 60_000);
  return localMidnightAsUtc - offset * 60_000;
}

/** UTC ms pre pražský dátum a minútu dňa (0–1440). */
export function pragueLocalToUtcMs(dateKey: string, minutyDna: number): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const local = Date.UTC(y, m - 1, d) + minutyDna * 60_000;
  const leto = local - 120 * 60_000;
  return pragueOffsetMinutes(leto) === 120 ? leto : local - 60 * 60_000;
}

/** Minúta dňa v Prahe (napr. 8:30 → 510). */
export function pragueMinutyDna(value: string | number | Date): number {
  const p = pragueParts(toMs(value));
  return p.hour * 60 + p.minute;
}

/** Rozsah [od, do) mesiaca v UTC ISO pre server-side filter. */
export function pragueMonthRangeUtc(
  year: number,
  month: number,
): { od: string; do: string } {
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return {
    od: new Date(pragueDayStartUtcMs(`${year}-${pad2(month)}-01`)).toISOString(),
    do: new Date(
      pragueDayStartUtcMs(`${next.y}-${pad2(next.m)}-01`),
    ).toISOString(),
  };
}

/** Rozsah [od, do) jedného pražského dňa v UTC ISO. */
export function pragueDayRangeUtc(dateKey: string): { od: string; do: string } {
  const start = pragueDayStartUtcMs(dateKey);
  const nextKey = pragueDateKey(start + 36 * 3_600_000);
  return {
    od: new Date(start).toISOString(),
    do: new Date(pragueDayStartUtcMs(nextKey)).toISOString(),
  };
}

/** Rok a mesiac posunutý o `delta` mesiacov. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

// ---------------------------------------------------------------------------

export function jePlatna(u: UdalostPreVypocet): boolean {
  const stav = (u.stav ?? "").trim().toLowerCase();
  return stav !== "zrusena" && Number.isFinite(Date.parse(u.cas));
}

/** Platné udalosti zoradené podľa času. */
export function zoradPlatne<T extends UdalostPreVypocet>(udalosti: T[]): T[] {
  return udalosti
    .filter(jePlatna)
    .sort((a, b) => Date.parse(a.cas) - Date.parse(b.cas));
}

/**
 * Navrhovaná udalosť: bez dnešnej udalosti alebo po odchodovom type → Príchod, inak Odchod.
 */
export function navrhniTyp(udalostiDna: UdalostPreVypocet[]): DochadzkaTyp {
  const platne = zoradPlatne(udalostiDna);
  const posledna = platne[platne.length - 1];
  if (!posledna || ODCHODOVE_TYPY.has(posledna.typ)) return "Prichod";
  return "Odchod";
}

export type DenStav = "v_praci" | "mimo" | "prerusenie";

/** Schválená žiadosť pre výpočet (DochadzkaZiadosti, jedna položka = jeden deň). */
export type ZiadostPreVypocet = {
  druh: string;
  /** ISO UTC */
  od: string;
  /** ISO UTC */
  do: string;
  hodiny?: number | null;
  stav: string;
};

/** Druhy žiadostí, ktoré sú odpracovaným časom od–do (obed podľa pravidla > 6 h). */
const ZIADOST_PRITOMNOST: ReadonlySet<string> = new Set([
  "HomeOffice",
  "SpatnaPritomnost",
]);
const ZIADOST_SLUZOBNA_CESTA = "SluzobnaCesta";
/** Absencia v hodinách (stĺpec Hodiny). */
const ZIADOST_ABSENCIA: ReadonlySet<string> = new Set([
  "Dovolenka",
  "NahradneVolno",
]);

export type DenVysledok<
  T extends UdalostPreVypocet = UdalostPreVypocet,
  Z extends ZiadostPreVypocet = ZiadostPreVypocet,
> = {
  datum: string;
  udalosti: T[];
  /** Schválené žiadosti, ktoré zasahujú do dňa */
  ziadosti: Z[];
  /** Prítomnosť (udalosti + home office + spätná prítomnosť) pred odpočtom obeda (min) */
  pritomnostMin: number;
  /** Služobná cesta mimo prítomnosti (min) — bez obeda a bez stravenky */
  sluzobnaCestaMin: number;
  /** pritomnostMin + sluzobnaCestaMin */
  odpracovaneMin: number;
  obedOdpocitany: boolean;
  /** Po odpočte obeda, zaokrúhlené nadol na 15 min */
  vysledneMin: number;
  /** Dovolenka / náhradné voľno (min) */
  absenciaMin: number;
  /** Dnešný otvorený úsek sa počíta do `now` */
  otvorenyUsek: boolean;
  /** Minulý deň končí príchodom — chýba odchod (otvorený úsek sa nepočíta) */
  chybaOdchod: boolean;
  stav: DenStav;
  /** Prvý príchod dňa, ak je človek práve v práci */
  vPraciOd: string | null;
};

export function zaokruhliNadol(min: number, krok = ZAOKRUHLENIE_MIN): number {
  if (min <= 0) return 0;
  return Math.floor(min / krok) * krok;
}

export function odpocitajObed(min: number): { min: number; odpocitany: boolean } {
  if (min > OBED_PRAH_MIN) {
    return { min: min - OBED_ODPOCET_MIN, odpocitany: true };
  }
  return { min, odpocitany: false };
}

type Interval = [number, number];

/** Zjednotenie intervalov [od, do) — prekryvy sa nerátajú dvakrát. */
export function zjednotIntervaly(intervaly: Interval[]): Interval[] {
  const sorted = intervaly
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function dlzkaMs(intervaly: Interval[]): number {
  return zjednotIntervaly(intervaly).reduce((s, [a, b]) => s + (b - a), 0);
}

function orezNaDen(iv: Interval, den: Interval): Interval | null {
  const a = Math.max(iv[0], den[0]);
  const b = Math.min(iv[1], den[1]);
  return b > a ? [a, b] : null;
}

function schvaleneZiadostiDna<Z extends ZiadostPreVypocet>(
  ziadosti: Z[],
  datum: string,
  den: Interval,
): Z[] {
  return ziadosti.filter((z) => {
    if (z.stav !== "Schvalene") return false;
    const od = Date.parse(z.od);
    const doMs = Date.parse(z.do);
    if (!Number.isFinite(od) || !Number.isFinite(doMs)) return false;
    if (ZIADOST_ABSENCIA.has(z.druh)) return pragueDateKey(od) === datum;
    return orezNaDen([od, doMs], den) !== null;
  });
}

/**
 * Úseky: Príchod → najbližší odchodový typ. Služobný odchod / Lekár → Príchod sa ráta,
 * Súkromný odchod / Fajčiarska prestávka → Príchod nie. Schválený home office a spätná
 * prítomnosť sa pridajú k prítomnosti (bez dvojitého rátania prekryvov). Nad 6 h prítomnosti
 * −30 min obed. Služobná cesta sa pripočíta bez obeda. Žiadosti sa rátajú len do `nowMs`.
 * Výsledok zaokrúhlený nadol na 15 min.
 * Dovolenka a náhradné voľno sú absencia v hodinách, do odpracovaného času sa nerátajú.
 */
export function vypocitajDen<
  T extends UdalostPreVypocet,
  Z extends ZiadostPreVypocet = ZiadostPreVypocet,
>(
  udalosti: T[],
  datum: string,
  nowMs: number = Date.now(),
  ziadosti: Z[] = [],
): DenVysledok<T, Z> {
  const platne = zoradPlatne(udalosti);
  const jeDnes = datum === pragueDateKey(nowMs);
  const denStart = pragueDayStartUtcMs(datum);
  const den: Interval = [
    denStart,
    pragueDayStartUtcMs(pragueDateKey(denStart + 36 * 3_600_000)),
  ];

  let stav: DenStav = "mimo";
  let usekOd = 0;
  let prerusenieOd = 0;
  let prvyPrichod: string | null = null;
  const pritomnost: Interval[] = [];

  for (const u of platne) {
    const ms = Date.parse(u.cas);
    if (u.typ === "Prichod") {
      if (stav === "v_praci") continue;
      if (stav === "prerusenie") pritomnost.push([prerusenieOd, ms]);
      prvyPrichod = prvyPrichod ?? u.cas;
      stav = "v_praci";
      usekOd = ms;
    } else if (ODCHODOVE_TYPY.has(u.typ)) {
      if (stav !== "v_praci") continue;
      pritomnost.push([usekOd, ms]);
      if (PRERUSENIE_RATA_SA.has(u.typ)) {
        stav = "prerusenie";
        prerusenieOd = ms;
      } else {
        stav = "mimo";
      }
    }
  }

  let otvorenyUsek = false;
  let chybaOdchod = false;
  if (stav === "v_praci") {
    if (jeDnes) {
      otvorenyUsek = true;
      pritomnost.push([usekOd, Math.max(usekOd, nowMs)]);
    } else {
      chybaOdchod = true;
    }
  }

  const ziadostiDna = schvaleneZiadostiDna(ziadosti, datum, den);
  const sluzobna: Interval[] = [];
  let absenciaMin = 0;
  for (const z of ziadostiDna) {
    if (ZIADOST_ABSENCIA.has(z.druh)) {
      absenciaMin += Math.max(0, Math.round((z.hodiny ?? 0) * 60));
      continue;
    }
    const iv = orezNaDen([Date.parse(z.od), Math.min(Date.parse(z.do), nowMs)], den);
    if (!iv) continue;
    if (z.druh === ZIADOST_SLUZOBNA_CESTA) sluzobna.push(iv);
    else if (ZIADOST_PRITOMNOST.has(z.druh)) pritomnost.push(iv);
  }

  const pritomnostMs = dlzkaMs(pritomnost);
  const sluzobnaMs = dlzkaMs([...pritomnost, ...sluzobna]) - pritomnostMs;
  const pritomnostMin = Math.floor(pritomnostMs / 60_000);
  const sluzobnaCestaMin = Math.floor(sluzobnaMs / 60_000);
  const obed = odpocitajObed(pritomnostMin);

  return {
    datum,
    udalosti: platne,
    ziadosti: ziadostiDna,
    pritomnostMin,
    sluzobnaCestaMin,
    odpracovaneMin: pritomnostMin + sluzobnaCestaMin,
    obedOdpocitany: obed.odpocitany,
    vysledneMin: zaokruhliNadol(obed.min + sluzobnaCestaMin),
    absenciaMin,
    otvorenyUsek,
    chybaOdchod,
    stav: jeDnes ? stav : "mimo",
    vPraciOd: jeDnes && stav === "v_praci" ? prvyPrichod : null,
  };
}

/** Zoskupí udalosti podľa pražského dňa. */
export function zoskupPodlaDna<T extends UdalostPreVypocet>(
  udalosti: T[],
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const u of udalosti) {
    if (!Number.isFinite(Date.parse(u.cas))) continue;
    const key = pragueDateKey(u.cas);
    const arr = out.get(key);
    if (arr) arr.push(u);
    else out.set(key, [u]);
  }
  return out;
}

/** Pražské dni, do ktorých zasahuje schválená žiadosť. */
function dniZiadosti(z: ZiadostPreVypocet): string[] {
  const od = Date.parse(z.od);
  const doMs = Date.parse(z.do);
  if (!Number.isFinite(od) || !Number.isFinite(doMs)) return [];
  const first = pragueDateKey(od);
  if (ZIADOST_ABSENCIA.has(z.druh)) return [first];
  const last = pragueDateKey(Math.max(od, doMs - 1));
  const out: string[] = [];
  let key = first;
  for (let i = 0; i < 400 && key <= last; i++) {
    out.push(key);
    key = pragueDateKey(pragueDayStartUtcMs(key) + 36 * 3_600_000);
  }
  return out;
}

export type MesiacVysledok<
  T extends UdalostPreVypocet = UdalostPreVypocet,
  Z extends ZiadostPreVypocet = ZiadostPreVypocet,
> = {
  /** Dni s platnou udalosťou alebo schválenou žiadosťou, vzostupne */
  dni: DenVysledok<T, Z>[];
  spoluMin: number;
  absenciaMin: number;
  dniSChybou: number;
};

export function vypocitajMesiac<
  T extends UdalostPreVypocet,
  Z extends ZiadostPreVypocet = ZiadostPreVypocet,
>(
  udalosti: T[],
  year: number,
  month: number,
  nowMs: number = Date.now(),
  ziadosti: Z[] = [],
): MesiacVysledok<T, Z> {
  const prefix = `${year}-${pad2(month)}-`;
  const groups = zoskupPodlaDna(udalosti);
  const keys = new Set([...groups.keys()]);
  const schvalene = ziadosti.filter((z) => z.stav === "Schvalene");
  for (const z of schvalene) for (const k of dniZiadosti(z)) keys.add(k);

  const dni: DenVysledok<T, Z>[] = [];
  for (const key of [...keys].sort()) {
    if (!key.startsWith(prefix)) continue;
    const d = vypocitajDen(groups.get(key) ?? [], key, nowMs, schvalene);
    if (d.udalosti.length || d.ziadosti.length) dni.push(d);
  }
  return {
    dni,
    spoluMin: dni.reduce((s, d) => s + d.vysledneMin, 0),
    absenciaMin: dni.reduce((s, d) => s + d.absenciaMin, 0),
    dniSChybou: dni.filter((d) => d.chybaOdchod).length,
  };
}

/** "7 h 45 min", "45 min", "0 min" */
export function formatMinuty(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
