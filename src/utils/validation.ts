import type { UkonItem } from "../types/ukon";
import { cs } from "../i18n/cs";
import { isValidEntryDate, isEditableEntryDate } from "./dates";

const T = cs.odvod.validace;

export type EntrySelection =
  | { kind: "zakazka"; zakazkaId: string; cisloObjednavky: "" }
  | { kind: "objednavka"; zakazkaId: string; cisloObjednavky: string };

export function parseMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 720) return null;
  return n;
}

function isValidUkonSelection(
  ukon: string | null,
  validUkonNames: readonly string[] | undefined,
): boolean {
  if (!ukon) return false;
  if (!validUkonNames || validUkonNames.length === 0) return true;
  return validUkonNames.includes(ukon);
}

export function validateTimeEntry(input: {
  selection: EntrySelection | null;
  minutesRaw: string;
  dateOnly: string;
  ukon: string | null;
  validUkonNames?: readonly string[];
  rework: boolean;
  poznamka: string;
}): string | null {
  if (!isValidEntryDate(input.dateOnly)) return T.datumNovy;
  if (!input.selection) return T.vyberteZakazku;
  if (parseMinutes(input.minutesRaw) == null) return T.minuty;
  if (!isValidUkonSelection(input.ukon, input.validUkonNames)) return T.vyberteUkon;
  if (input.rework && !input.poznamka.trim()) return T.reworkPoznamka;
  return null;
}

export function validateTimeEntryEdit(input: {
  selection: EntrySelection | null;
  dateOnly: string;
  minutesRaw: string;
  ukon: string | null;
  validUkonNames?: readonly string[];
  rework: boolean;
  poznamka: string;
}): string | null {
  if (!isEditableEntryDate(input.dateOnly)) return T.datumUprava;
  if (!input.selection) return T.vyberteZakazku;
  if (parseMinutes(input.minutesRaw) == null) return T.minuty;
  if (!isValidUkonSelection(input.ukon, input.validUkonNames)) return T.vyberteUkon;
  if (input.rework && !input.poznamka.trim()) return T.reworkPoznamka;
  return null;
}

export function isKnownUkon(
  ukony: readonly UkonItem[],
  nazov: string,
): boolean {
  const norm = nazov.trim().toLowerCase();
  return ukony.some((u) => u.nazov.trim().toLowerCase() === norm);
}
