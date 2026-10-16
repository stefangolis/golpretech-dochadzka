/**
 * České formátování dat (locale cs-CZ). Čistý modul bez React Native.
 * Pokud Intl na zařízení cs-CZ nezná, použije se vlastní tabulka se stejným výsledkem.
 */

const LOCALE = "cs-CZ";
const DNY = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const MESICE = [
  "Leden",
  "Únor",
  "Březen",
  "Duben",
  "Květen",
  "Červen",
  "Červenec",
  "Srpen",
  "Září",
  "Říjen",
  "Listopad",
  "Prosinec",
];

/** Po … Ne (pondělí první) — záhlaví kalendáře */
export const DNY_TYDNE_OD_PONDELI = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

function velkePrvni(s: string): string {
  return s ? s[0]!.toLocaleUpperCase(LOCALE) + s.slice(1) : s;
}

function utcZKlice(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function intl(datum: Date, opts: Intl.DateTimeFormatOptions): string | null {
  try {
    return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...opts }).format(datum);
  } catch {
    return null;
  }
}

/** "St" z YYYY-MM-DD */
export function denTydneKratce(key: string): string {
  const d = utcZKlice(key);
  const zIntl = intl(d, { weekday: "short" });
  const kratce = zIntl ? velkePrvni(zIntl.replace(".", "")) : null;
  return kratce && DNY.includes(kratce) ? kratce : DNY[d.getUTCDay()]!;
}

/** "14. 10." */
export function formatDatumKratce(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d}. ${m}.`;
}

/** "St 14. 10." */
export function formatDenKratce(key: string): string {
  return `${denTydneKratce(key)} ${formatDatumKratce(key)}`;
}

/** "14. 10. 2026" */
export function formatDatumPlny(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d}. ${m}. ${y}`;
}

/** "St 14. 10. 2026" */
export function formatDenPlny(key: string): string {
  return `${denTydneKratce(key)} ${formatDatumPlny(key)}`;
}

/** "Říjen 2026" — 1. pád; Intl na Androidu vrací podle verze i 2. pád („října"), proto tabulka. */
export function formatMesicRok(year: number, month: number): string {
  return `${MESICE[month - 1]} ${year}`;
}

/**
 * Rozsah dní: "4. 10." / "4.–9. 10." / "28. 9.–2. 10." / "30. 12. 2026–2. 1. 2027".
 */
export function formatRozsahDni(od: string, doKey: string): string {
  if (od === doKey) return formatDatumKratce(od);
  const [y1, m1, d1] = od.split("-").map(Number);
  const [y2, m2, d2] = doKey.split("-").map(Number);
  if (y1 !== y2) return `${d1}. ${m1}. ${y1}–${d2}. ${m2}. ${y2}`;
  if (m1 !== m2) return `${d1}. ${m1}.–${d2}. ${m2}.`;
  return `${d1}.–${d2}. ${m2}.`;
}
