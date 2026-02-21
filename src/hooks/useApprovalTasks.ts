'use client';

import useSWR from 'swr';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';

export interface PendingClient {
  id: string;
  business_name: string;
  client_code: string | null;
  rfc: string | null;
  created_at: string;
}

export interface PendingSite {
  id: string;
  name: string;
  location: string | null;
  client_id: string;
  created_at: string;
  clients?: { business_name: string } | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PendingQuote {
  id: string | number;
  client: string;
  date: string;
  amount: string;
  status: string;
  constructionSite: string;
  recipeSummary?: string;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json.error || 'Failed to fetch data');
  }
  return response.json();
};

export function useApprovalTasks() {
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();

  const canFetch =
    profile?.role === 'EXECUTIVE' || profile?.role === 'PLANT_MANAGER';

  const governanceKey = canFetch ? '/api/governance/pending' : null;
  const quotesKey = canFetch
    ? currentPlant?.id
      ? `/api/dashboard/quotes?plant_id=${currentPlant.id}`
      : '/api/dashboard/quotes'
    : null;

  const {
    data: governanceData,
    isLoading: isLoadingGovernance,
    error: governanceError,
    mutate: mutateGovernance,
  } = useSWR(governanceKey, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 1000 * 60 * 5, // 5 min cache
  });

  const {
    data: quotesData,
    isLoading: isLoadingQuotes,
    error: quotesError,
    mutate: mutateQuotes,
  } = useSWR(quotesKey, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 1000 * 60 * 5,
  });

  const clients: PendingClient[] = governanceData?.clients ?? [];
  const sites: PendingSite[] = governanceData?.construction_sites ?? [];
  const pendingQuotes: PendingQuote[] = quotesData?.pendingQuotes ?? [];

  const refetch = async () => {
    await Promise.all([mutateGovernance(), mutateQuotes()]);
  };

  return {
    clients,
    sites,
    pendingQuotes,
    isLoading: isLoadingGovernance || isLoadingQuotes,
    isError: !!governanceError || !!quotesError,
    refetch,
  };
}
