/** DochadzkaOpravnenia — čisté vyhodnotenie (bez React Native závislostí). */
import { pragueDateKey } from "./dochadzkaVypocet";
import { DEFAULT_DENNY_FOND_HOD } from "./dochadzkaZiadosti";

export type OpravnenieZaznam = {
  email: string;
  zapisBezNalepky: boolean;
  nadriadenyEmail: string;
  jeHR: boolean;
  dennyFondHod: number;
  /** Zostatok dovolenky k StavKDatumu (h); null = nevyplnené */
  dovolenkaZostatokHod: number | null;
  /** Zostatok nadčasov k StavKDatumu (h); null = nevyplnené */
  prescasZostatokHod: number | null;
  /** YYYY-MM-DD; null = nevyplnené */
  stavKDatumu: string | null;
};

export type MojeOpravnenia = {
  zapisBezNalepky: boolean;
  /** null = nadriadený nie je nastavený (žiadosť sa nedá odoslať) */
  nadriadenyEmail: string | null;
  jeHR: boolean;
  dennyFondHod: number;
  /** HR alebo niekomu nadriadený (aj sám sebe) — vidí „Na schválenie“ */
  jeSchvalovatel: boolean;
  /** Má vlastný riadok v DochadzkaOpravnenia (modul Docházka). */
  vSezname: boolean;
  dovolenkaZostatokHod: number | null;
  prescasZostatokHod: number | null;
  stavKDatumu: string | null;
};

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "");
}

/** Voľba Ano/Nie: len Ano/Áno/Yes/true/1 je áno; prázdne alebo iné = Nie. */
export function parseAnoNie(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === 1) return true;
  if (typeof v !== "string") return false;
  return ["ano", "yes", "true", "1"].includes(fold(v));
}

/** Číslo zo SharePointu ("7,5" aj 7.5); prázdne alebo neplatné = null. Záporné je povolené. */
export function parseCisloAleboNull(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const n = Number(v.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** DennyFondHod: prázdne, neplatné alebo ≤ 0 = 8 h. Akceptuje aj "7,5". */
export function parseDennyFond(v: unknown): number {
  const n = parseCisloAleboNull(v);
  return n !== null && n > 0 ? n : DEFAULT_DENNY_FOND_HOD;
}

/**
 * Stĺpec typu Dátum → YYYY-MM-DD. Dátum bez času (YYYY-MM-DD alebo polnoc UTC) sa berie
 * doslovne, dátum s časom podľa Europe/Prague.
 */
export function parseDatumKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}(T00:00:00(\.0+)?Z)?$/.test(s)) return s.slice(0, 10);
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? pragueDateKey(ms) : null;
}

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Prístup k modulu Docházka: riadok v DochadzkaOpravnenia s rovnakým e-mailom
 * (bez ohľadu na veľkosť písmen). Chýbajúci zoznam / e-mail = bez prístupu.
 */
export function maPristupKDochadzce(
  zaznamy: readonly OpravnenieZaznam[] | null | undefined,
  email: string | null | undefined,
): boolean {
  if (!zaznamy || !email?.trim()) return false;
  const ja = normEmail(email);
  return zaznamy.some((z) => normEmail(z.email) === ja);
}

export function vyhodnotOpravnenia(
  zaznamy: OpravnenieZaznam[],
  email: string,
): MojeOpravnenia {
  const ja = normEmail(email);
  const moj = zaznamy.find((z) => normEmail(z.email) === ja);
  /** Aj sám sebe nadriadený (NadriadenyEmail = vlastný email) — schvaľuje si sám. */
  const jeNadriadeny = zaznamy.some((z) => normEmail(z.nadriadenyEmail) === ja);
  const jeHR = moj?.jeHR ?? false;
  return {
    zapisBezNalepky: moj?.zapisBezNalepky ?? false,
    nadriadenyEmail: moj?.nadriadenyEmail.trim() ? moj.nadriadenyEmail.trim() : null,
    jeHR,
    dennyFondHod: moj ? moj.dennyFondHod : DEFAULT_DENNY_FOND_HOD,
    jeSchvalovatel: jeHR || jeNadriadeny,
    vSezname: !!moj,
    dovolenkaZostatokHod: moj?.dovolenkaZostatokHod ?? null,
    prescasZostatokHod: moj?.prescasZostatokHod ?? null,
    stavKDatumu: moj?.stavKDatumu ?? null,
  };
}
