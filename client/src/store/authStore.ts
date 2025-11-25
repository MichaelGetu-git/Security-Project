import { create } from 'zustand';

type UserSummary = {
  id: number;
  email: string;
  username: string;
  roles: string[];
  security_level: string;
  mfa_enabled?: boolean;
  phone_number?: string | null;
};

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserSummary | null;
  setTokens: (access: string | null, refresh: string | null) => void;
  setUser: (user: UserSummary | null) => void;
  clearTokens: () => void;
}

export const authStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
  setUser: (user) => set({ user }),
  clearTokens: () => set({ accessToken: null, refreshToken: null, user: null }),
}));


