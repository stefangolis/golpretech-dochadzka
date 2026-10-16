import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NovaUdalost } from "../api/dochadzkaFields";

const FRONTA_KEY = "@dochadzka/fronta/v1";
const POSLEDNY_ZAPIS_KEY = "@dochadzka/posledny-zapis/v1";

export type FrontaPolozka = NovaUdalost & {
  /** Lokálne ID — zabraňuje duplicitám pri opakovanom odoslaní */
  localId: string;
  zaradene: number;
  pokusy: number;
  chyba?: string;
};

export type PoslednyZapis = {
  zamestnanecEmail: string;
  typ: NovaUdalost["typ"];
  cas: string;
  /** Date.now() pri uložení */
  zapisaneAt: number;
  voFronte: boolean;
};

let chain: Promise<unknown> = Promise.resolve();

/** Zápisy do fronty idú postupne, aby sa súbežné úpravy neprepísali. */
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function readAll(): Promise<FrontaPolozka[]> {
  try {
    const raw = await AsyncStorage.getItem(FRONTA_KEY);
    const parsed = raw ? (JSON.parse(raw) as FrontaPolozka[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items: FrontaPolozka[]): Promise<void> {
  await AsyncStorage.setItem(FRONTA_KEY, JSON.stringify(items));
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function novyLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Položky fronty používateľa zoradené podľa času udalosti. */
export async function nacitajFrontu(email: string): Promise<FrontaPolozka[]> {
  const all = await readAll();
  return all
    .filter((p) => sameEmail(p.zamestnanecEmail, email))
    .sort((a, b) => Date.parse(a.cas) - Date.parse(b.cas));
}

export function pridajDoFronty(polozka: FrontaPolozka): Promise<void> {
  return serialized(async () => {
    const all = await readAll();
    if (all.some((p) => p.localId === polozka.localId)) return;
    all.push(polozka);
    await writeAll(all);
  });
}

export function odstranZFronty(localId: string): Promise<void> {
  return serialized(async () => {
    const all = await readAll();
    await writeAll(all.filter((p) => p.localId !== localId));
  });
}

export function oznacChybuVoFronte(localId: string, chyba: string): Promise<void> {
  return serialized(async () => {
    const all = await readAll();
    await writeAll(
      all.map((p) =>
        p.localId === localId ? { ...p, pokusy: p.pokusy + 1, chyba } : p,
      ),
    );
  });
}

export async function ulozPoslednyZapis(z: PoslednyZapis): Promise<void> {
  await AsyncStorage.setItem(POSLEDNY_ZAPIS_KEY, JSON.stringify(z)).catch(
    () => undefined,
  );
}

export async function nacitajPoslednyZapis(
  email: string,
): Promise<PoslednyZapis | null> {
  try {
    const raw = await AsyncStorage.getItem(POSLEDNY_ZAPIS_KEY);
    if (!raw) return null;
    const z = JSON.parse(raw) as PoslednyZapis;
    return z && sameEmail(z.zamestnanecEmail, email) ? z : null;
  } catch {
    return null;
  }
}
