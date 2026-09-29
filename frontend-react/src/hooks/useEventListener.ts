import { useEffect, useRef } from 'react';

/**
 * Document-level event listener whose handler can change every render without the listener
 * being torn down and re-added -- the React equivalent of an Angular `@HostListener`.
 */
export function useDocumentEvent<K extends keyof DocumentEventMap>(
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
  active = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    const listener = (event: DocumentEventMap[K]): void => handlerRef.current(event);
    document.addEventListener(type, listener);
    return () => document.removeEventListener(type, listener);
  }, [type, active]);
}
