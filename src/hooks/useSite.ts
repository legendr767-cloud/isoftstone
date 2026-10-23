import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { SiteInfo } from '@/lib/types';
export const useSite = () => useQuery({ queryKey: ['site'], queryFn: async () => (await api.get<SiteInfo>('/site')).data, staleTime: 60_000 });
