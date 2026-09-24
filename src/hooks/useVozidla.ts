import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRezervacia,
  fetchMojeRezervacie,
  fetchRezervacieVRozsahu,
  predlzitRezervaciu,
  zrusitRezervaciu,
} from "../api/rezervacieData";
import { fetchVozidla } from "../api/vozidlaFields";
import { useAuth } from "../auth/AuthContext";

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
    onSuccess: async () => {
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
    onSuccess: async () => {
      await invalidateRezervacieQueries(queryClient, user?.email);
    },
  });
}

export function usePredlzitRezervaciu() {
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
      await predlzitRezervaciu(token, input.id, {
        noveDo: input.noveDo,
        nazovVozidla: input.nazovVozidla,
        od: input.od,
        displayName: user.displayName || user.email,
      });
    },
    onSuccess: async () => {
      await invalidateRezervacieQueries(queryClient, user?.email);
    },
  });
}
