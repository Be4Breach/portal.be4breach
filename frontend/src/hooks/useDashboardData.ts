import { useState, useEffect, useCallback } from "react";

export interface DashboardData {
  threatTrendsData: Array<{
    date: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }>;
  severityData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  attackVectorsData: Array<{
    name: string;
    count: number;
  }>;
  geoThreatData: Array<{
    country: string;
    lat: number;
    lng: number;
    count: number;
    intensity: number;
  }>;
  recentAlerts: Array<{
    id: number;
    name: string;
    source: string;
    severity: string;
    time: string;
    description: string;
  }>;
  statsData: {
    totalThreats: { value: number; change: number; trend: string };
    criticalAlerts: { value: number; change: number; trend: string };
    systemsMonitored: { value: number; change: number; trend: string };
    riskScore: number;
  };
}

const API_BASE_URL = "http://localhost:8000/api";

// Simple in-memory cache so multiple components share one network call.
let cachedData: DashboardData | null = null;
let inflight: Promise<DashboardData> | null = null;
let cachedError: string | null = null;

const fetchDashboardData = async (force = false): Promise<DashboardData> => {
  if (!force && cachedData) return cachedData;
  if (!force && inflight) return inflight;

  const request = (async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard-data`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as DashboardData;
  })();

  const wrapped = request
    .then((result) => {
      cachedData = result;
      cachedError = null;
      return result;
    })
    .catch((err) => {
      cachedError = err instanceof Error ? err.message : "Failed to fetch data";
      throw err;
    })
    .finally(() => {
      inflight = null;
    });

  if (!force) {
    inflight = wrapped;
  }

  return wrapped;
};

export const useDashboardData = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const result = await fetchDashboardData(force);
      setData(result);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      const message =
        err instanceof Error ? err.message : "Failed to fetch data";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Hydrate from cache if available
    if (cachedData) {
      setData(cachedData);
      setError(cachedError);
      setLoading(false);
      return;
    }

    load();
  }, [load]);

  const refetch = useCallback(async () => {
    cachedData = null;
    cachedError = null;
    await load(true);
  }, [load]);

  return { data, loading, error, refetch };
};
