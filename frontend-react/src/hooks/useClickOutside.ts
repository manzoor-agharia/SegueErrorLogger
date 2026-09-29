import { useEffect, type RefObject } from 'react';

/**
 * Calls `handler` on any document click landing outside `ref`. Replaces the
 * `@HostListener('document:click')` + `hostRef.nativeElement.contains(...)` pattern the
 * Angular components used to close their own dropdowns.
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, handler: () => void, active = true): void {
  useEffect(() => {
    if (!active) return;

    function onDocumentClick(event: MouseEvent): void {
      const el = ref.current;
      if (el && !el.contains(event.target as Node)) {
        handler();
      }
    }

    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, [ref, handler, active]);
}
