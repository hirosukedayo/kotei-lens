import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DevModeState {
  isDevMode: boolean;
  toggleDevMode: () => void;
  setDevMode: (enabled: boolean) => void;
}

const isProduction = import.meta.env.VITE_ALLOW_INDEXING === 'true';

export const useDevModeStore = create<DevModeState>()(
  persist(
    (set) => ({
      isDevMode: false,
      toggleDevMode: () => {
        if (!isProduction) set((state) => ({ isDevMode: !state.isDevMode }));
      },
      setDevMode: (enabled: boolean) => {
        if (!isProduction) set({ isDevMode: enabled });
      },
    }),
    {
      name: 'dev-mode-storage',
    }
  )
);
