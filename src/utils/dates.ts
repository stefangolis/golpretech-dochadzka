/** Počet dní dozadu vrátane dneška (7 = posledný týždeň) — nový zápis */
export const ENTRY_DAYS_BACK = 7;

/** Moje záznamy: posledný týždeň vrátane dneška (= ENTRY_DAYS_BACK) */
export const MY_ENTRIES_DAYS_BACK = ENTRY_DAYS_BACK;

/** Lokálny dátum ako YYYY-MM-DD */
export function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayDateOnly(): string {
  return toDateOnly(new Date());
}

export function daysAgoDateOnly(days: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return toDateOnly(d);
}

/** Dátum o N dní dopredu od dnes (0 = dnes) */
export function daysAheadDateOnly(days: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return toDateOnly(d);
}

/** Nasledujúci kalendárny deň (YYYY-MM-DD) */
export function dayAfterDateOnly(dateOnly: string): string {
  const d = parseDateOnly(dateOnly);
  d.setDate(d.getDate() + 1);
  return toDateOnly(d);
}

/** Dátum posunutý o N kalendárnych dní (YYYY-MM-DD) */
export function addDaysDateOnly(dateOnly: string, days: number): string {
  const d = parseDateOnly(dateOnly);
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

/** Počet kalendárnych dní vrátane krajných (Od–Do) */
export function inclusiveDayCount(od: string, doDate: string): number {
  const a = parseDateOnly(od).getTime();
  const b = parseDateOnly(doDate).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

/** Najstarší dátum pre nový zápis (YYYY-MM-DD) */
export function minEntryDateOnly(): string {
  return daysAgoDateOnly(ENTRY_DAYS_BACK - 1);
}

/** Najstarší dátum v sekcii Moje záznamy */
export function myEntriesMinDateOnly(): string {
  return daysAgoDateOnly(MY_ENTRIES_DAYS_BACK - 1);
}

/** Záznam starší ako týždeň nie je editovateľný */
export function isEditableEntryDate(dateOnly: string): boolean {
  const today = todayDateOnly();
  const min = myEntriesMinDateOnly();
  return dateOnly <= today && dateOnly >= min;
}

/** SharePoint DateTime stĺpec očakáva ISO reťazec s časom */
export function toSharePointDateTime(dateOnly: string): string {
  return `${dateOnly}T12:00:00Z`;
}

export function formatDateSk(dateOnly: string): string {
  const d = parseDateOnly(dateOnly);
  return d.toLocaleDateString("sk-SK", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/** Kompaktný dátum pre tlačidlá (napr. 22. 8.) */
export function formatDateShort(dateOnly: string): string {
  const d = parseDateOnly(dateOnly);
  return d.toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "numeric",
  });
}

/** Nie budúcnosť, max. 7 dní dozadu */
export function isValidEntryDate(dateOnly: string): boolean {
  const today = todayDateOnly();
  const min = minEntryDateOnly();
  return dateOnly <= today && dateOnly >= min;
}

/** Parsuje manuálny vstup RRRR-MM-DD; vráti null ak formát/ rozsah nie je OK. */
export function parseManualDateOnly(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return null;
  }
  if (!isValidEntryDate(trimmed)) return null;
  return trimmed;
}
