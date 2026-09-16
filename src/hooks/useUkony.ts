import { useQuery } from "@tanstack/react-query";
import { fetchUkony } from "../api/ukonFields";
import { useAuth } from "../auth/AuthContext";

export function useUkony() {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ["ukony"],
    enabled: !!user,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return fetchUkony(token);
    },
    staleTime: 5 * 60 * 1000,
  });
}
