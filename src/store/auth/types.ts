import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'QUALITY_TEAM' | 'PLANT_MANAGER' | 'SALES_AGENT' | 'EXECUTIVE' | 'CREDIT_VALIDATOR' | 'DOSIFICADOR' | 'EXTERNAL_SALES_AGENT';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  plant_id: string | null;
  business_unit_id: string | null;
}

export interface AuthSliceState {
  user: User | null;
  profile: UserProfile | null;
  isInitialized: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>; 
  signOut: () => Promise<{ success: boolean; error?: string }>;
  loadProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (allowed: UserRole | UserRole[]) => boolean;
}

export interface SessionSliceState {
  session: Session | null;
  scheduleRefresh: () => void;
  clearRefreshTimer: () => void;
  isSessionExpiringSoon: () => boolean;
  refreshSessionNow: () => Promise<void>;
}

export interface CacheSliceState {
  cacheHits: number;
  cacheMisses: number;
  lastAuthCheck: number | null;
  authCheckSource: string | null;
}

export interface MetricsSliceState {
  authLatencyMs: number[];
  failedOperationsCount: number;
  getMetricsSummary: () => { avgLatencyMs: number; operationsFailed: number };
}

export interface OfflineSliceState {
  isOnline: boolean;
  queue: Array<() => Promise<void>>;
  failedOperations: Array<{ at: number; message: string }>;
  setOnlineStatus: (online: boolean) => void;
  processQueue: () => Promise<void>;
}

export type AuthStoreState = AuthSliceState & SessionSliceState & CacheSliceState & MetricsSliceState & OfflineSliceState;


