import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DevModeState {
  isDevMode: boolean;
  toggleDevMode: () => void;
  setDevMode: (enabled: boolean) => void;
}

export const useDevModeStore = create<DevModeState>()(
  persist(
    (set) => ({
      isDevMode: false,
      toggleDevMode: () => set((state) => ({ isDevMode: !state.isDevMode })),
      setDevMode: (enabled: boolean) => set({ isDevMode: enabled }),
    }),
    {
      name: 'dev-mode-storage',
    }
  )
);
