import { api } from '@/api/client';
import type { Screen } from '@/types/errorLog';

export const screensService = {
  async list(usedOnly = false): Promise<Screen[]> {
    const { data } = await api.get<Screen[]>('/screens', { params: { used_only: String(usedOnly) } });
    return data;
  },
};
