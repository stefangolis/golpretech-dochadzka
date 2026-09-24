import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRezervacia,
  fetchMojeRezervacie,
  fetchPoslednyOdovzdanyKm,
  fetchRezervacieVRozsahu,
  odovzdatRezervaciu,
  overitOdovzdanie,
  overitPrevzatie,
  prevziatRezervaciu,
  upravitRezervaciu,
  zmenitKoniecRezervacie,
  zrusitRezervaciu,
  type OdovzdanieInput,
  type PrevzatieInput,
} from "../api/rezervacieData";
import { buildRezervaciaTitle } from "../api/rezervacieFields";
import { nahratFotkyRezervacie } from "../api/vozidlaFotky";
import { fetchVozidla } from "../api/vozidlaFields";
import { useAuth } from "../auth/AuthContext";
import { todayDateOnly } from "../utils/dates";
import {
  naplanovatNotifikaciuRezervacie,
  zrusitNotifikaciuRezervacie,
} from "../utils/rezervacieNotifikacie";

export function useVozidla() {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ["vozidla"],
    enabled: !!user,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return fetchVozidla(token);
    },
  });
}

export function useRezervacie(odDate: string, doDate: string) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ["rezervacie", odDate, doDate],
    enabled: !!user && !!odDate && !!doDate,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return fetchRezervacieVRozsahu(token, odDate, doDate);
    },
  });
}

export function useMojeRezervacie() {
  const { getValidAccessToken, user } = useAuth();
  const email = user?.email ?? "";

  return useQuery({
    queryKey: ["mojeRezervacie", email],
    enabled: !!email,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return fetchMojeRezervacie(token, email);
    },
  });
}

/** OdovzdanieKm poslednej vrátenej rezervácie vozidla. */
export function usePoslednyOdovzdanyKm(vozidloSpz: string) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ["poslednyKm", vozidloSpz.trim().toLowerCase()],
    enabled: !!user && !!vozidloSpz.trim(),
    staleTime: 0,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return fetchPoslednyOdovzdanyKm(token, vozidloSpz);
    },
  });
}

async function invalidateRezervacieQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  email: string | undefined,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["rezervacie"] }),
    queryClient.invalidateQueries({ queryKey: ["mojeRezervacie", email] }),
  ]);
}

export function useCreateRezervacia() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      nazovVozidla: string;
      vozidloSpz: string;
      od: string;
      do: string;
      zakazkaId: string;
      cielCesty: string;
    }) => {
      if (!user?.email) throw new Error("Nie ste prihlásený.");
      const token = await getValidAccessToken();
      return createRezervacia(token, {
        ...input,
        zamestnanecEmail: user.email,
        displayName: user.displayName || user.email,
      });
    },
    onSuccess: async (createdId, input) => {
      void naplanovatNotifikaciuRezervacie(createdId, input.do);
      await invalidateRezervacieQueries(queryClient, user?.email);
    },
  });
}

export function useZrusitRezervaciu() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getValidAccessToken();
      await zrusitRezervaciu(token, id);
    },
    onSuccess: async (_data, id) => {
      void zrusitNotifikaciuRezervacie(id);
      await invalidateRezervacieQueries(queryClient, user?.email);
    },
  });
}

export function useUpravitRezervaciu() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      nazovVozidla: string;
      od: string;
      do: string;
      zakazkaId: string;
      cielCesty: string;
    }) => {
      if (!user) throw new Error("Nie ste prihlásený.");
      const token = await getValidAccessToken();
      const { id, ...rest } = input;
      await upravitRezervaciu(token, id, {
        ...rest,
        displayName: user.displayName || user.email,
      });
    },
    onSuccess: async (_data, input) => {
      void naplanovatNotifikaciuRezervacie(input.id, input.do);
      await invalidateRezervacieQueries(queryClient, user?.email);
    },
  });
}

export function useZmenitKoniecRezervacie() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      noveDo: string;
      nazovVozidla: string;
      od: string;
    }) => {
      if (!user) throw new Error("Nie ste prihlásený.");
      const token = await getValidAccessToken();
      await zmenitKoniecRezervacie(token, input.id, {
        noveDo: input.noveDo,
        nazovVozidla: input.nazovVozidla,
        od: input.od,
        displayName: user.displayName || user.email,
      });
    },
    onSuccess: async (_data, input) => {
      void naplanovatNotifikaciuRezervacie(input.id, input.noveDo);
      await invalidateRezervacieQueries(queryClient, user?.email);
    },
  });
}

type FotkyProgress = (done: number, total: number) => void;

/** Poradie: overenie volieb → nahratie fotiek → zápis stavu. */
export function usePrevziatRezervaciu() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      data: PrevzatieInput;
      fotky: readonly string[];
      onProgress?: FotkyProgress;
    }) => {
      if (!user) throw new Error("Nie ste prihlásený.");
      const token = await getValidAccessToken();
      await overitPrevzatie(token, input.data);
      await nahratFotkyRezervacie(
        token,
        input.id,
        "prevzatie",
        input.fotky,
        input.onProgress,
      );
      await prevziatRezervaciu(token, input.id, input.data);
    },
    onSuccess: async () => {
      await invalidateRezervacieQueries(queryClient, user?.email);
    },
  });
}

export function useOdovzdatRezervaciu() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      od: string;
      do: string;
      vozidloSpz: string;
      nazovVozidla: string;
      data: Omit<OdovzdanieInput, "skrateneDo">;
      fotky: readonly string[];
      onProgress?: FotkyProgress;
    }) => {
      if (!user) throw new Error("Nie ste prihlásený.");
      const token = await getValidAccessToken();
      await overitOdovzdanie(token, input.data);
      await nahratFotkyRezervacie(
        token,
        input.id,
        "odovzdanie",
        input.fotky,
        input.onProgress,
      );
      const dnes = todayDateOnly();
      const skrateneDo =
        dnes < input.do
          ? {
              noveDo: dnes,
              title: buildRezervaciaTitle(
                input.nazovVozidla,
                input.od,
                dnes,
                user.displayName || user.email,
              ),
            }
          : undefined;
      await odovzdatRezervaciu(token, input.id, {
        ...input.data,
        skrateneDo,
      });
    },
    onSuccess: async (_data, input) => {
      void zrusitNotifikaciuRezervacie(input.id);
      await Promise.all([
        invalidateRezervacieQueries(queryClient, user?.email),
        queryClient.invalidateQueries({
          queryKey: ["poslednyKm", input.vozidloSpz.trim().toLowerCase()],
        }),
      ]);
    },
  });
}
