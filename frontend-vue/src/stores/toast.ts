import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface ToastMessage {
  id: number;
  text: string;
  variant: 'success' | 'error' | 'info';
}

export const useToastStore = defineStore('toast', () => {
  const messages = ref<ToastMessage[]>([]);
  let nextId = 1;

  function dismiss(id: number): void {
    messages.value = messages.value.filter((m) => m.id !== id);
  }

  function show(text: string, variant: ToastMessage['variant'] = 'info', durationMs = 3000): void {
    const id = nextId++;
    messages.value = [...messages.value, { id, text, variant }];
    setTimeout(() => dismiss(id), durationMs);
  }

  return { messages, show, dismiss };
});
