import { createContext, useContext, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

interface AuthCtx { user: User | null; loading: boolean; can: (perm: string) => boolean; refresh: () => Promise<unknown>; logout: () => Promise<void> }
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me'], queryFn: async () => (await api.get<User | null>('/auth/me')).data, staleTime: 60_000, retry: false });
  const out = useMutation({ mutationFn: () => api.post('/auth/logout'), onSuccess: () => { qc.clear(); qc.setQueryData(['me'], null); } });
  const user = q.data ?? null;
  // UI gating only: every permission is enforced again on the server.
  const can = (perm: string) => !!user?.permissions?.includes(perm);
  return <Ctx.Provider value={{ user, loading: q.isLoading, can, refresh: () => qc.invalidateQueries({ queryKey: ['me'] }), logout: async () => { await out.mutateAsync(); } }}>{children}</Ctx.Provider>;
}
export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
