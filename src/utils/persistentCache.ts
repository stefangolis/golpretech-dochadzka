import AsyncStorage from "@react-native-async-storage/async-storage";
import { isNetworkError } from "./network";

type Entry<T> = { at: number; value: T };

const memory = new Map<string, Entry<unknown>>();

async function readEntry<T>(key: string): Promise<Entry<T> | null> {
  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem) return mem;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry<T>;
    if (typeof parsed?.at !== "number") return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Hodnota s TTL v pamäti aj v AsyncStorage. Pri výpadku siete vráti poslednú známu hodnotu
 * (aj po TTL), aby appka fungovala offline.
 */
export async function cachedValue<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options?: { force?: boolean },
): Promise<{ value: T; fromCache: boolean }> {
  const entry = await readEntry<T>(key);
  if (!options?.force && entry && Date.now() - entry.at < ttlMs) {
    return { value: entry.value, fromCache: true };
  }
  try {
    const value = await loader();
    const fresh: Entry<T> = { at: Date.now(), value };
    memory.set(key, fresh);
    AsyncStorage.setItem(key, JSON.stringify(fresh)).catch(() => undefined);
    return { value, fromCache: false };
  } catch (err) {
    if (entry && isNetworkError(err)) {
      console.warn(`[cache] ${key}: sieť nedostupná, použijem uloženú hodnotu.`);
      return { value: entry.value, fromCache: true };
    }
    throw err;
  }
}
