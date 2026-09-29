import { create } from 'zustand';

export interface ToastMessage {
  id: number;
  text: string;
  variant: 'success' | 'error' | 'info';
}

interface ToastState {
  messages: ToastMessage[];
  show: (text: string, variant?: ToastMessage['variant'], durationMs?: number) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  messages: [],

  show(text, variant = 'info', durationMs = 3000) {
    const id = nextId++;
    set({ messages: [...get().messages, { id, text, variant }] });
    setTimeout(() => get().dismiss(id), durationMs);
  },

  dismiss(id) {
    set({ messages: get().messages.filter((m) => m.id !== id) });
  },
}));

/** Non-reactive accessor for use inside event handlers, so callers don't re-render on toasts. */
export const toast = {
  show: (text: string, variant?: ToastMessage['variant']) => useToastStore.getState().show(text, variant),
};
