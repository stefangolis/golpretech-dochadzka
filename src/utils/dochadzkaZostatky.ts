/**
 * Môj mesiac — fond, zostatok dovolenky a nadčasov. Čistý modul (bez React Native).
 * Zostatky vychádzajú z DochadzkaOpravnenia (stav k StavKDatumu) a od nasledujúceho dňa
 * sa dopočítavajú orientačne; uzávierku robí HR.
 */
import {
  pragueDateKey,
  vypocitajDen,
  zoskupPodlaDna,
  type UdalostPreVypocet,
  type ZiadostPreVypocet,
} from "./dochadzkaVypocet";
import { dniVRozsahu, jePracovnyDen, pracovneDni, pridajDni } from "./dochadzkaZiadosti";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rozsahMesiaca(year: number, month: number): { od: string; do: string } {
  const od = `${year}-${pad2(month)}-01`;
  const nasl = month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`;
  return { od, do: pridajDni(nasl, -1) };
}

export type MesacnyFond = { pracovneDni: number; hodiny: number };

/** Pracovné dni mesiaca (bez víkendov a sviatkov ČR) × denný fond. */
export function mesacnyFond(year: number, month: number, dennyFondHod: number): MesacnyFond {
  const { od, do: doKey } = rozsahMesiaca(year, month);
  const dni = pracovneDni(od, doKey).length;
  return { pracovneDni: dni, hodiny: r2(dni * dennyFondHod) };
}

export type ZostatokDovolenky = {
  stavKDatumu: string;
  /** DovolenkaZostatokHod − schválené dovolenky po StavKDatumu */
  hodiny: number;
  dni: number;
  /** Z toho schválené budúce (po dnešku) */
  naplanovaneHod: number;
  naplanovaneDni: number;
  /** Čaká na schválenie (neodpočítava sa) */
  cakaHod: number;
  cakaDni: number;
};

/** null = StavKDatumu alebo DovolenkaZostatokHod nie je nastavený. */
export function vypocitajZostatokDovolenky(input: {
  zostatokHod: number | null;
  stavKDatumu: string | null;
  dennyFondHod: number;
  dnes: string;
  ziadosti: readonly ZiadostPreVypocet[];
}): ZostatokDovolenky | null {
  const { zostatokHod, stavKDatumu, dennyFondHod, dnes } = input;
  if (zostatokHod === null || !stavKDatumu) return null;
  let cerpaneHod = 0;
  let naplanovaneHod = 0;
  let cakaHod = 0;
  for (const z of input.ziadosti) {
    if (z.druh !== "Dovolenka") continue;
    const datum = pragueDateKey(z.od);
    if (!(datum > stavKDatumu)) continue;
    const h = z.hodiny ?? 0;
    if (z.stav === "Schvalene") {
      cerpaneHod += h;
      if (datum > dnes) naplanovaneHod += h;
    } else if (z.stav === "Ziadost") {
      cakaHod += h;
    }
  }
  const fond = dennyFondHod > 0 ? dennyFondHod : 8;
  const hodiny = r2(zostatokHod - cerpaneHod);
  return {
    stavKDatumu,
    hodiny,
    dni: r2(hodiny / fond),
    naplanovaneHod: r2(naplanovaneHod),
    naplanovaneDni: r2(naplanovaneHod / fond),
    cakaHod: r2(cakaHod),
    cakaDni: r2(cakaHod / fond),
  };
}

export type ZostatokNadcasov = {
  stavKDatumu: string;
  /** PrescasZostatokHod + dopočítané obdobie */
  hodiny: number;
  /** Zmena za obdobie od–do (h) */
  zaObdobieHod: number;
  /** Prvý a posledný dopočítaný deň; null, ak obdobie je prázdne */
  od: string | null;
  do: string | null;
  /** Dni s chýbajúcim odchodom (otvorený úsek sa nerátal) */
  dniSChybou: number;
};

/**
 * Za každý deň po StavKDatumu do včera: odpracované (vysledneMin, vrátane SC/HO/spätnej
 * prítomnosti) − denný fond pracovného dňa. Dovolenka a NV znižujú fond, NV zároveň čerpá konto.
 */
export function vypocitajZostatokNadcasov(input: {
  zostatokHod: number | null;
  stavKDatumu: string | null;
  dennyFondHod: number;
  dnes: string;
  nowMs: number;
  udalosti: readonly UdalostPreVypocet[];
  ziadosti: readonly ZiadostPreVypocet[];
}): ZostatokNadcasov | null {
  const { zostatokHod, stavKDatumu, dennyFondHod, dnes, nowMs } = input;
  if (zostatokHod === null || !stavKDatumu) return null;
  const od = pridajDni(stavKDatumu, 1);
  const doKey = pridajDni(dnes, -1);
  const dni = dniVRozsahu(od, doKey);
  const fondMin = Math.round((dennyFondHod > 0 ? dennyFondHod : 8) * 60);
  const groups = zoskupPodlaDna([...input.udalosti]);
  const schvalene = input.ziadosti.filter((z) => z.stav === "Schvalene");

  let deltaMin = 0;
  let dniSChybou = 0;
  for (const datum of dni) {
    const den = vypocitajDen(groups.get(datum) ?? [], datum, nowMs, schvalene);
    let dovolenkaMin = 0;
    let nvMin = 0;
    for (const z of den.ziadosti) {
      const min = Math.max(0, Math.round((z.hodiny ?? 0) * 60));
      if (z.druh === "Dovolenka") dovolenkaMin += min;
      else if (z.druh === "NahradneVolno") nvMin += min;
    }
    const fondDna = Math.max(0, (jePracovnyDen(datum) ? fondMin : 0) - dovolenkaMin - nvMin);
    deltaMin += den.vysledneMin - fondDna - nvMin;
    if (den.chybaOdchod) dniSChybou++;
  }

  const zaObdobieHod = r2(deltaMin / 60);
  return {
    stavKDatumu,
    hodiny: r2(zostatokHod + zaObdobieHod),
    zaObdobieHod,
    od: dni.length ? od : null,
    do: dni.length ? doKey : null,
    dniSChybou,
  };
}

/** "4,5 dne", "1 den", "3 dny", "5 dní" */
export function formatDni(dni: number): string {
  const r = r2(dni);
  const text = String(r).replace(".", ",").replace("-", "−");
  if (!Number.isInteger(r)) return `${text} dne`;
  const abs = Math.abs(r);
  if (abs === 1) return `${text} den`;
  if (abs >= 2 && abs <= 4) return `${text} dny`;
  return `${text} dní`;
}

/** "+12,5 h", "−3 h", "0 h" */
export function formatHodinySoZnamienkom(h: number): string {
  const r = r2(h);
  const abs = String(Math.abs(r)).replace(".", ",");
  if (r > 0) return `+${abs} h`;
  if (r < 0) return `−${abs} h`;
  return "0 h";
}
