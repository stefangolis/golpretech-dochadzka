import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DOCHADZKA_CACHE_TTL_MS,
  fetchMojeUdalosti,
  maZapisBezNalepky,
  odosliFrontu,
  overNfcTag,
  vytvorUdalost,
} from "../api/dochadzkaData";
import type {
  DochadzkaUdalost,
  DochadzkaZdroj,
  NovaUdalost,
} from "../api/dochadzkaFields";
import { useAuth } from "../auth/AuthContext";
import { cs } from "../i18n/cs";
import {
  nacitajFrontu,
  nacitajPoslednyZapis,
  novyLocalId,
  pridajDoFronty,
  ulozPoslednyZapis,
  type FrontaPolozka,
  type PoslednyZapis,
} from "../utils/dochadzkaFronta";
import {
  pragueDateKey,
  pragueDayRangeUtc,
  pragueMonthRangeUtc,
  type DochadzkaTyp,
} from "../utils/dochadzkaVypocet";
import { nacitajHlasZapnuty, povedzPotvrdenie, ulozHlasZapnuty } from "../utils/hlas";
import { isNetworkError, isOffline } from "../utils/network";
import {
  nastavListenerStavuNfc,
  zistiNfcStav,
  type NfcStav,
} from "../utils/nfc";

const QK = "dochadzka";

/** Udalosť na zobrazenie — zo SharePointu alebo z offline fronty. */
export type ZobrazenaUdalost = {
  key: string;
  typ: string;
  cas: string;
  stav: string;
  zdroj: string;
  caka: boolean;
};

function udalostKey(typ: string, cas: string): string {
  return `${typ}|${Math.floor(Date.parse(cas) / 1000)}`;
}

function zlucUdalosti(
  datum: string,
  server: DochadzkaUdalost[] | undefined,
  fronta: FrontaPolozka[],
  posledny: PoslednyZapis | null,
): ZobrazenaUdalost[] {
  const out = new Map<string, ZobrazenaUdalost>();
  for (const u of server ?? []) {
    const key = udalostKey(u.typ, u.cas);
    out.set(key, { key, typ: u.typ, cas: u.cas, stav: u.stav, zdroj: u.zdroj, caka: false });
  }
  for (const p of fronta) {
    if (pragueDateKey(p.cas) !== datum) continue;
    const key = udalostKey(p.typ, p.cas);
    if (!out.has(key)) {
      out.set(key, { key, typ: p.typ, cas: p.cas, stav: "Platna", zdroj: p.zdroj, caka: true });
    }
  }
  if (posledny && !posledny.voFronte && pragueDateKey(posledny.cas) === datum) {
    const key = udalostKey(posledny.typ, posledny.cas);
    if (!out.has(key)) {
      out.set(key, { key, typ: posledny.typ, cas: posledny.cas, stav: "Platna", zdroj: "", caka: false });
    }
  }
  return [...out.values()].sort((a, b) => Date.parse(a.cas) - Date.parse(b.cas));
}

/** Aktuálny pražský dátum; prepne sa aj cez polnoc pri otvorenej appke. */
export function usePragueToday(): string {
  const [dnes, setDnes] = useState(() => pragueDateKey(Date.now()));
  useEffect(() => {
    const t = setInterval(() => setDnes(pragueDateKey(Date.now())), 60_000);
    return () => clearInterval(t);
  }, []);
  return dnes;
}

export function useDochadzkaFronta() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  return useQuery({
    queryKey: [QK, "fronta", email],
    enabled: !!email,
    staleTime: 0,
    networkMode: "always",
    queryFn: () => nacitajFrontu(email),
  });
}

export function usePoslednyZapis() {
  const { user } = useAuth();
  const email = user?.email ?? "";
  return useQuery({
    queryKey: [QK, "poslednyZapis", email],
    enabled: !!email,
    staleTime: 0,
    networkMode: "always",
    queryFn: () => nacitajPoslednyZapis(email),
  });
}

function useMojeUdalostiVRozsahu(
  rangeKey: string,
  range: { od: string; do: string },
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();
  const email = user?.email ?? "";
  return useQuery({
    queryKey: [QK, "udalosti", email, rangeKey],
    enabled: !!email && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return fetchMojeUdalosti(token, email, range.od, range.do);
    },
  });
}

/** Dnešné udalosti (SharePoint + fronta) — podklad pre Dnes aj návrh typu. */
export function useDochadzkaDnes() {
  const dnes = usePragueToday();
  const range = useMemo(() => pragueDayRangeUtc(dnes), [dnes]);
  const server = useMojeUdalostiVRozsahu(`den-${dnes}`, range);
  const fronta = useDochadzkaFronta();
  const posledny = usePoslednyZapis();

  const udalosti = useMemo(
    () => zlucUdalosti(dnes, server.data, fronta.data ?? [], posledny.data ?? null),
    [dnes, server.data, fronta.data, posledny.data],
  );

  return {
    dnes,
    udalosti,
    server,
    vofronte: fronta.data?.length ?? 0,
    fronta: fronta.data ?? [],
  };
}

export function useDochadzkaMesiac(year: number, month: number) {
  const range = useMemo(() => pragueMonthRangeUtc(year, month), [year, month]);
  const key = `mesiac-${year}-${String(month).padStart(2, "0")}`;
  const server = useMojeUdalostiVRozsahu(key, range);
  const fronta = useDochadzkaFronta();

  const udalosti = useMemo(() => {
    const out = new Map<string, ZobrazenaUdalost>();
    for (const u of server.data ?? []) {
      const k = udalostKey(u.typ, u.cas);
      out.set(k, { key: k, typ: u.typ, cas: u.cas, stav: u.stav, zdroj: u.zdroj, caka: false });
    }
    const odMs = Date.parse(range.od);
    const doMs = Date.parse(range.do);
    for (const p of fronta.data ?? []) {
      const ms = Date.parse(p.cas);
      if (ms < odMs || ms >= doMs) continue;
      const k = udalostKey(p.typ, p.cas);
      if (!out.has(k)) {
        out.set(k, { key: k, typ: p.typ, cas: p.cas, stav: "Platna", zdroj: p.zdroj, caka: true });
      }
    }
    return [...out.values()];
  }, [server.data, fronta.data, range]);

  return { server, udalosti };
}

export function useZapisBezNalepky() {
  const { getValidAccessToken, user } = useAuth();
  const email = user?.email ?? "";
  return useQuery({
    queryKey: [QK, "zapisBezNalepky", email],
    enabled: !!email,
    staleTime: DOCHADZKA_CACHE_TTL_MS,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return maZapisBezNalepky(token, email);
    },
  });
}

/**
 * Overenie nálepky. Neznámy výsledok (null) sa necachuje — overí sa znova pri každom
 * novom ťuknutí (`tuknutie` = čas priloženia), aby novo pridaná nálepka fungovala hneď.
 */
export function useOverNfcTag(uid: string | null, tuknutie: string | null = null) {
  const { getValidAccessToken, user } = useAuth();
  const query = useQuery({
    queryKey: [QK, "nfcTag", uid],
    enabled: !!user && !!uid,
    staleTime: (q) => (q.state.data ? DOCHADZKA_CACHE_TTL_MS : 0),
    retry: false,
    networkMode: "always",
    queryFn: async () => {
      const token = await getValidAccessToken();
      return overNfcTag(token, uid ?? "");
    },
  });

  const predosle = useRef(tuknutie);
  const { refetch, isSuccess, data } = query;
  useEffect(() => {
    if (predosle.current === tuknutie) return;
    predosle.current = tuknutie;
    if (isSuccess && !data) void refetch();
  }, [tuknutie, isSuccess, data, refetch]);

  return query;
}

export type ZapisInput = {
  typ: DochadzkaTyp;
  cas: string;
  zdroj: DochadzkaZdroj;
  tagId: string | null;
  poloha: string | null;
};

export type ZapisVysledok = {
  typ: DochadzkaTyp;
  cas: string;
  voFronte: boolean;
};

/**
 * Zápis udalosti. Pri výpadku siete sa udalosť uloží do offline fronty s pôvodným Cas.
 */
export function useZapisUdalost() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: "always",
    mutationFn: async (input: ZapisInput): Promise<ZapisVysledok> => {
      if (!user) throw new Error(cs.spolecne.nejstePrihlasen);
      const udalost: NovaUdalost = {
        zamestnanecEmail: user.email,
        displayName: user.displayName,
        typ: input.typ,
        cas: input.cas,
        zdroj: input.zdroj,
        tagId: input.tagId,
        poloha: input.poloha,
        offline: false,
      };

      let voFronte = false;
      try {
        const token = await getValidAccessToken();
        if ((await nacitajFrontu(user.email)).length) {
          await odosliFrontu(async () => token, user.email).catch(() => undefined);
        }
        await vytvorUdalost(token, udalost);
      } catch (err) {
        if (!isNetworkError(err) && !(await isOffline())) throw err;
        await pridajDoFronty({
          ...udalost,
          offline: true,
          localId: novyLocalId(),
          zaradene: Date.now(),
          pokusy: 0,
        });
        voFronte = true;
      }

      await ulozPoslednyZapis({
        zamestnanecEmail: user.email,
        typ: input.typ,
        cas: input.cas,
        zapisaneAt: Date.now(),
        voFronte,
      });
      return { typ: input.typ, cas: input.cas, voFronte };
    },
    onSuccess: (r) => {
      void povedzPotvrdenie(r.typ);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [QK] });
    },
  });
}

/**
 * Odoslanie offline fronty: pri štarte, po obnovení siete a pri návrate appky do popredia.
 */
export function useDochadzkaFrontaSync() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const email = user?.email ?? "";

  const flush = useCallback(async () => {
    if (!email) return;
    try {
      const r = await odosliFrontu(getValidAccessToken, email);
      if (r.odoslane) {
        void queryClient.invalidateQueries({ queryKey: [QK] });
      }
    } catch (err) {
      if (!isNetworkError(err)) console.warn("[dochadzka] odoslanie fronty zlyhalo", err);
    } finally {
      void queryClient.invalidateQueries({ queryKey: [QK, "fronta"] });
    }
  }, [email, getValidAccessToken, queryClient]);

  useEffect(() => {
    if (!email) return;
    void flush();
    const netSub = Network.addNetworkStateListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) void flush();
    });
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void flush();
    });
    return () => {
      netSub.remove();
      appSub.remove();
    };
  }, [email, flush]);

  return flush;
}

export function useOdoslatFrontu() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: async () => {
      if (!user) return { odoslane: 0, zostava: 0 };
      return odosliFrontu(getValidAccessToken, user.email);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [QK] });
    },
  });
}

/** Hlasové potvrdenie zápisu (lokálne nastavenie, predvolene zapnuté). */
export function useHlasZapnuty(): { zapnuty: boolean; nastav: (v: boolean) => void } {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: [QK, "hlas"],
    staleTime: Infinity,
    networkMode: "always",
    queryFn: nacitajHlasZapnuty,
  });
  const nastav = useCallback(
    (v: boolean) => {
      queryClient.setQueryData([QK, "hlas"], v);
      void ulozHlasZapnuty(v);
    },
    [queryClient],
  );
  return { zapnuty: q.data ?? true, nastav };
}

/** Stav NFC (podpora / zapnutie), obnovuje sa pri návrate do appky a zmene v systéme. */
export function useNfcStav(): { stav: NfcStav | null; obnovit: () => void } {
  const [stav, setStav] = useState<NfcStav | null>(null);
  const obnovit = useCallback(() => {
    void zistiNfcStav().then(setStav);
  }, []);

  useEffect(() => {
    obnovit();
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") obnovit();
    });
    const off = nastavListenerStavuNfc(obnovit);
    return () => {
      appSub.remove();
      off();
    };
  }, [obnovit]);

  return { stav, obnovit };
}
