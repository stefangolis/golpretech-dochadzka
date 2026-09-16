import type { UkonItem } from "../types/ukon";
import { isValidEntryDate, isEditableEntryDate } from "./dates";

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
  if (!isValidEntryDate(input.dateOnly)) {
    return "Dátum môže byť len dnes alebo max. 2 týždne dozadu (nie v budúcnosti).";
  }
  if (!input.selection) {
    return "Vyberte zákazku alebo objednávku.";
  }
  if (parseMinutes(input.minutesRaw) == null) {
    return "Minúty musia byť celé číslo od 1 do 720.";
  }
  if (!isValidUkonSelection(input.ukon, input.validUkonNames)) {
    return "Vyberte úkon zo zoznamu.";
  }
  if (input.rework && !input.poznamka.trim()) {
    return "Pri Rework je poznámka povinná.";
  }
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
  if (!isEditableEntryDate(input.dateOnly)) {
    return "Dátum môže byť len v rámci posledného týždňa (nie v budúcnosti).";
  }
  if (!input.selection) {
    return "Vyberte zákazku alebo objednávku.";
  }
  if (parseMinutes(input.minutesRaw) == null) {
    return "Minúty musia byť celé číslo od 1 do 720.";
  }
  if (!isValidUkonSelection(input.ukon, input.validUkonNames)) {
    return "Vyberte úkon zo zoznamu.";
  }
  if (input.rework && !input.poznamka.trim()) {
    return "Pri Rework je poznámka povinná.";
  }
  return null;
}

export function isKnownUkon(
  ukony: readonly UkonItem[],
  nazov: string,
): boolean {
  const norm = nazov.trim().toLowerCase();
  return ukony.some((u) => u.nazov.trim().toLowerCase() === norm);
}
