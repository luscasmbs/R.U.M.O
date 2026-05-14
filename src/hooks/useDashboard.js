import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useDashboard(filters) {
  return useQuery({
    queryKey: ["dashboard", filters],
    queryFn: async () => {
      const { data } = await api.get("/dashboard", { params: filters });
      return data;
    },
  });
}

export function useDataSources() {
  return useQuery({
    queryKey: ["data-sources"],
    queryFn: async () => {
      const { data } = await api.get("/data-sources");
      return data;
    },
  });
}
