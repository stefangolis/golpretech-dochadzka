import * as Network from "expo-network";
import { cs } from "../i18n/cs";

export class NetworkTimeoutError extends Error {
  constructor(label: string) {
    super(cs.spolecne.casovyLimit(label));
    this.name = "NetworkTimeoutError";
  }
}

/**
 * Výpadok siete alebo dočasná chyba servera (fetch TypeError, timeout, HTTP 5xx / 429).
 * Chyby 4xx (napr. 400, 403) sa za výpadok nepovažujú — opakovanie by nepomohlo.
 */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof NetworkTimeoutError) return true;
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /network request failed|failed to fetch|network ?error|internet|timed? ?out|HTTP (5\d\d|429)/i.test(
    msg,
  );
}

export async function isOffline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return s.isConnected === false || s.isInternetReachable === false;
  } catch {
    return false;
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new NetworkTimeoutError(label)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
