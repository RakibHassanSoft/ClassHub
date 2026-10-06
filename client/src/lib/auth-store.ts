'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from './types';

interface AuthState {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  /** true right after the user pressed Log out (then the login page opens without a ?next= return link) */
  loggedOut: boolean;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,
      loggedOut: false,
      setAuth: (token, user) => set({ token, user, loggedOut: false }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null, loggedOut: true }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'classhub-auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
