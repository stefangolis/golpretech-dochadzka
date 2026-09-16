import { useQuery } from "@tanstack/react-query";
import { fetchWorkCatalog } from "../api/workData";
import { useAuth } from "../auth/AuthContext";

export function useWorkCatalog() {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ["workCatalog"],
    enabled: !!user,
    queryFn: async () => {
      const token = await getValidAccessToken();
      return fetchWorkCatalog(token);
    },
  });
}

/** Ponuka na výber (len aktívne zákazky). */
export function useWorkItems() {
  const catalog = useWorkCatalog();
  return {
    ...catalog,
    data: catalog.data?.pickerItems,
  };
}
