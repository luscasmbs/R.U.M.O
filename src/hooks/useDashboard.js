import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export function useDashboard(filters) {
  return useQuery({
    queryKey: ["dashboard", filters],
    queryFn: async ({ signal }) => {
      const { data } = await api.get("/dashboard", { params: { ...filters, include_geometry: false }, signal });
      return data;
    },
  });
}

export function useNeighborhoodGeoJSON(municipalityCode) {
  return useQuery({
    queryKey: ["neighborhoods", "geojson", municipalityCode],
    queryFn: async ({ signal }) => {
      const { data } = await api.get("/neighborhoods/geojson", {
        params: { municipality_code: municipalityCode },
        signal,
      });
      return data;
    },
    staleTime: Infinity,
  });
}

export function useDataSources() {
  return useQuery({
    queryKey: ["data-sources"],
    queryFn: async ({ signal }) => {
      const { data } = await api.get("/data-sources", { signal });
      return data;
    },
  });
}

export function useForecasts(filters) {
  return useQuery({
    queryKey: ["forecasts", filters],
    queryFn: async ({ signal }) => {
      const { data } = await api.get("/forecasts", { params: filters, signal });
      return data;
    },
  });
}
