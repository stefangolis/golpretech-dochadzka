import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTimeEntry, fetchMyTimeEntries, updateTimeEntry } from "../api/workData";
import { useAuth } from "../auth/AuthContext";

export function useMyEntries() {
  const { getValidAccessToken, user } = useAuth();
  const email = user?.email ?? "";

  return useQuery({
    queryKey: ["myEntries", email],
    enabled: !!email,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return fetchMyTimeEntries(token, email);
    },
  });
}

export function useCreateTimeEntry() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      datum: string;
      zakazkaId: string;
      cisloObjednavky: string;
      minuty: number;
      ukon: string;
      rework: boolean;
      poznamka: string;
    }) => {
      if (!user?.email) throw new Error("Nie ste prihlásený.");
      const token = await getValidAccessToken();
      await createTimeEntry(token, {
        ...input,
        zamestnanecEmail: user.email,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["myEntries", user?.email],
      });
    },
  });
}

export function useUpdateTimeEntry() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      datum: string;
      zakazkaId: string;
      cisloObjednavky: string;
      minuty: number;
      ukon: string;
      rework: boolean;
      poznamka: string;
    }) => {
      const token = await getValidAccessToken();
      const { id, ...fields } = input;
      await updateTimeEntry(token, id, fields);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["myEntries", user?.email],
      });
    },
  });
}
