import NetInfo from '@react-native-community/netinfo';
import * as React from 'react';
import {
  bootstrap,
  clearToken,
  getToken,
  login as apiLogin,
  logout as apiLogout,
  syncQueuedRequests,
} from '@/api/client';
import { countQueuedRequests } from '@/storage/offline-store';
import { MobileBootstrap } from '@/types/attendance';

interface AuthState extends MobileBootstrap {
  loading: boolean;
  queuedCount: number;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
}

const emptyBootstrap: MobileBootstrap = {
  user: null as unknown as MobileBootstrap['user'],
  employee: null as unknown as MobileBootstrap['employee'],
  station: null,
  settings: null,
  openSession: null,
};

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<MobileBootstrap>(emptyBootstrap);
  const [loading, setLoading] = React.useState(true);
  const [queuedCount, setQueuedCount] = React.useState(0);

  const refresh = React.useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setState(emptyBootstrap);
      setQueuedCount(await countQueuedRequests());
      return;
    }

    const next = await bootstrap();
    setState(next);
    setQueuedCount(await countQueuedRequests());
  }, []);

  const sync = React.useCallback(async () => {
    await syncQueuedRequests().catch(() => null);
    setQueuedCount(await countQueuedRequests());
  }, []);

  const signIn = React.useCallback(async (username: string, password: string) => {
    await apiLogin(username, password);
    await refresh();
    await sync();
  }, [refresh, sync]);

  const signOut = React.useCallback(async () => {
    await apiLogout().catch(() => clearToken());
    setState(emptyBootstrap);
    setQueuedCount(await countQueuedRequests());
  }, []);

  React.useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  React.useEffect(() => {
    return NetInfo.addEventListener((network) => {
      if (network.isConnected) {
        sync().catch(() => null);
      }
    });
  }, [sync]);

  const value = React.useMemo<AuthState>(() => ({
    ...state,
    loading,
    queuedCount,
    signIn,
    signOut,
    refresh,
    sync,
  }), [loading, queuedCount, refresh, signIn, signOut, state, sync]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = React.use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
