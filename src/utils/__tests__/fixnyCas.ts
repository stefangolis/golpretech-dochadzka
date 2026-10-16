import { afterEach, beforeEach, vi } from "vitest";
import { pragueDateKey, pragueLocalToUtcMs } from "../dochadzkaVypocet";
import { pridajDni } from "../dochadzkaZiadosti";

/** Streda 7. 10. 2026, 10:00 Praha (letný čas). Všetky dátumy v testoch sa odvodzujú od neho. */
export const FIXNY_CAS = new Date("2026-10-07T10:00:00+02:00");

export const DNES = pragueDateKey(FIXNY_CAS);
export const ROK = Number(DNES.slice(0, 4));
export const MESIAC = Number(DNES.slice(5, 7));

/** Pražský dátum posunutý o `n` dní od DNES. */
export function den(n: number): string {
  return pridajDni(DNES, n);
}

/** ISO UTC pre pražský dátum a minútu dňa. */
export function iso(datum: string, minutyDna: number): string {
  return new Date(pragueLocalToUtcMs(datum, minutyDna)).toISOString();
}

/** "8. 10." */
export function denMesiac(datum: string): string {
  const [, m, d] = datum.split("-").map(Number);
  return `${d}. ${m}.`;
}

export function pouziFixnyCas(): void {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXNY_CAS);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}
