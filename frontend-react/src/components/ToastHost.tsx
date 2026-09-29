import type { JSX } from 'react';

import { useToastStore } from '@/stores/toast';

export default function ToastHost(): JSX.Element {
  const messages = useToastStore((s) => s.messages);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`toast toast-${msg.variant}`}
          style={{ cursor: 'pointer' }}
          onClick={() => dismiss(msg.id)}
        >
          {msg.text}
        </div>
      ))}
    </>
  );
}
