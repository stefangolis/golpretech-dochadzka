import { useEffect, useMemo } from "react";
import { AppState } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DOCHADZKA_CACHE_TTL_MS,
  fetchMojeUdalosti,
  nacitajMojeOpravnenia,
} from "../api/dochadzkaData";
import {
  fetchMojeZiadosti,
  fetchZiadostiNaSchvalenie,
  schvalitZiadost,
  vytvorZiadost,
  zamietnutZiadost,
  zrusitZiadost,
} from "../api/dochadzkaZiadostiData";
import { useAuth } from "../auth/AuthContext";
import { cs } from "../i18n/cs";
import { pragueDayStartUtcMs } from "../utils/dochadzkaVypocet";
import {
  novaSkupinaId,
  pridajDni,
  rozpisNovuZiadost,
  zoskupZiadosti,
  type NovaZiadostVstup,
} from "../utils/dochadzkaZiadosti";
import {
  vypocitajZostatokDovolenky,
  vypocitajZostatokNadcasov,
} from "../utils/dochadzkaZostatky";
import { useDochadzkaFronta, usePragueToday } from "./useDochadzka";

const QK = "dochadzka";
const ZIADOSTI_KEY = [QK, "ziadosti"] as const;

/** Zoznam ukazuje 60 dní dozadu; výpočet mesiaca potrebuje aj predošlý mesiac. */
export const ZIADOSTI_ZOZNAM_DNI = 60;
const ZIADOSTI_NACITAT_DNI = 100;

export function useMojeOpravnenia() {
  const { getValidAccessToken, user } = useAuth();
  const email = user?.email ?? "";
  return useQuery({
    queryKey: [QK, "opravnenia", email],
    enabled: !!email,
    staleTime: DOCHADZKA_CACHE_TTL_MS,
    networkMode: "always",
    queryFn: async () => {
      const token = await getValidAccessToken();
      return nacitajMojeOpravnenia(token, email);
    },
  });
}

/** Moje žiadosti (všetky stavy), ktoré končia najviac ~100 dní dozadu, aj budúce. */
export function useMojeZiadosti() {
  const { getValidAccessToken, user } = useAuth();
  const email = user?.email ?? "";
  const dnes = usePragueToday();
  const odIso = useMemo(
    () => new Date(pragueDayStartUtcMs(pridajDni(dnes, -ZIADOSTI_NACITAT_DNI))).toISOString(),
    [dnes],
  );
  return useQuery({
    queryKey: [...ZIADOSTI_KEY, "moje", email, odIso],
    enabled: !!email,
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return fetchMojeZiadosti(token, email, odIso);
    },
  });
}

/** Schválené žiadosti pre výpočet (Dnes, Môj mesiac). */
export function useSchvaleneZiadosti() {
  const q = useMojeZiadosti();
  const data = useMemo(() => (q.data ?? []).filter((z) => z.stav === "Schvalene"), [q.data]);
  return { ...q, schvalene: data };
}

/**
 * Žiadosti čakajúce na moje schválenie (zoskupené). Len pre nadriadeného alebo HR;
 * obnovuje sa pri návrate appky do popredia.
 */
export function useNaSchvalenie() {
  const { getValidAccessToken, user } = useAuth();
  const email = user?.email ?? "";
  const opravnenia = useMojeOpravnenia();
  const vSezname = opravnenia.data?.vSezname === true;
  const jeSchvalovatel = vSezname && !!opravnenia.data?.jeSchvalovatel;
  const jeHR = vSezname && !!opravnenia.data?.jeHR;
  const query = useQuery({
    queryKey: [...ZIADOSTI_KEY, "naSchvalenie", email, jeHR],
    enabled: !!email && jeSchvalovatel,
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return fetchZiadostiNaSchvalenie(token, email, jeHR);
    },
  });

  const { refetch } = query;
  useEffect(() => {
    if (!jeSchvalovatel) return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void refetch();
    });
    return () => sub.remove();
  }, [jeSchvalovatel, refetch]);

  const skupiny = useMemo(() => zoskupZiadosti(query.data ?? []), [query.data]);
  return {
    ...query,
    jeSchvalovatel,
    jeHR,
    skupiny,
    pocet: jeSchvalovatel ? skupiny.length : 0,
  };
}

/**
 * Zostatok dovolenky a nadčasov: stav k StavKDatumu z DochadzkaOpravnenia + dopočet
 * z udalostí (do včera) a žiadostí po tomto dátume. null = zostatok nie je nastavený.
 */
export function useMojeZostatky() {
  const { getValidAccessToken, user } = useAuth();
  const email = user?.email ?? "";
  const dnes = usePragueToday();
  const opravnenia = useMojeOpravnenia();
  const fronta = useDochadzkaFronta();
  const o = opravnenia.data;
  const odKey = o?.stavKDatumu ? pridajDni(o.stavKDatumu, 1) : null;

  const query = useQuery({
    queryKey: [...ZIADOSTI_KEY, "zostatky", email, odKey, dnes],
    enabled: !!email && !!odKey,
    staleTime: 60_000,
    queryFn: async () => {
      const token = await getValidAccessToken();
      const odIso = new Date(pragueDayStartUtcMs(odKey ?? dnes)).toISOString();
      const doIso = new Date(pragueDayStartUtcMs(dnes)).toISOString();
      const [udalosti, ziadosti] = await Promise.all([
        odKey && odKey < dnes ? fetchMojeUdalosti(token, email, odIso, doIso) : Promise.resolve([]),
        fetchMojeZiadosti(token, email, odIso),
      ]);
      return { udalosti, ziadosti };
    },
  });

  const vysledok = useMemo(() => {
    if (!o) return null;
    const ziadosti = query.data?.ziadosti ?? [];
    const odMs = odKey ? pragueDayStartUtcMs(odKey) : 0;
    const doMs = pragueDayStartUtcMs(dnes);
    const zFronty = (fronta.data ?? []).filter((p) => {
      const ms = Date.parse(p.cas);
      return ms >= odMs && ms < doMs;
    });
    const udalosti = [...(query.data?.udalosti ?? []), ...zFronty];
    return {
      dovolenka: vypocitajZostatokDovolenky({
        zostatokHod: o.dovolenkaZostatokHod,
        stavKDatumu: o.stavKDatumu,
        dennyFondHod: o.dennyFondHod,
        dnes,
        ziadosti,
      }),
      nadcasy: vypocitajZostatokNadcasov({
        zostatokHod: o.prescasZostatokHod,
        stavKDatumu: o.stavKDatumu,
        dennyFondHod: o.dennyFondHod,
        dnes,
        nowMs: Date.now(),
        udalosti,
        ziadosti,
      }),
    };
  }, [dnes, fronta.data, o, odKey, query.data]);

  return {
    opravnenia,
    query,
    nacitava: opravnenia.isLoading || (!!odKey && query.isLoading),
    dovolenka: query.data ? (vysledok?.dovolenka ?? null) : null,
    nadcasy: query.data ? (vysledok?.nadcasy ?? null) : null,
    nastavene: !!o?.stavKDatumu,
  };
}

export const CHYBA_BEZ_NADRIADENEHO = cs.zadosti.api.bezNadrizeneho;

/** Overí žiadosť, rozpíše ju po dňoch a zapíše do SharePointu. */
export function useVytvorZiadost() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { vstup: NovaZiadostVstup; dnes: string }) => {
      if (!user) throw new Error(cs.spolecne.nejstePrihlasen);
      const token = await getValidAccessToken();
      const opravnenia = await nacitajMojeOpravnenia(token, user.email);
      const schvalovatel = opravnenia.nadriadenyEmail?.trim();
      if (!schvalovatel) throw new Error(CHYBA_BEZ_NADRIADENEHO);

      const odIso = new Date(
        pragueDayStartUtcMs(pridajDni(input.dnes, -ZIADOSTI_NACITAT_DNI)),
      ).toISOString();
      const existujuce = await fetchMojeZiadosti(token, user.email, odIso);
      const rozpis = rozpisNovuZiadost(input.vstup, {
        dnes: input.dnes,
        nowMs: Date.now(),
        dennyFondHod: opravnenia.dennyFondHod,
        skupinaId: novaSkupinaId(),
        existujuce,
      });
      if (!rozpis.ok) throw new Error(rozpis.chyba);
      await vytvorZiadost(token, {
        zamestnanecEmail: user.email,
        schvalovatelEmail: schvalovatel,
        polozky: rozpis.polozky,
      });
      return rozpis.polozky;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ZIADOSTI_KEY });
    },
  });
}

export function useZrusitZiadost() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error(cs.spolecne.nejstePrihlasen);
      const token = await getValidAccessToken();
      return zrusitZiadost(token, user.email, ids);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ZIADOSTI_KEY });
    },
  });
}

export function useRozhodnutZiadost() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { ids: string[]; schvalit: true } | { ids: string[]; schvalit: false; dovod: string },
    ) => {
      if (!user) throw new Error(cs.spolecne.nejstePrihlasen);
      const token = await getValidAccessToken();
      const { jeHR } = await nacitajMojeOpravnenia(token, user.email);
      if (input.schvalit) await schvalitZiadost(token, user.email, jeHR, input.ids);
      else await zamietnutZiadost(token, user.email, jeHR, input.ids, input.dovod);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ZIADOSTI_KEY });
    },
  });
}
