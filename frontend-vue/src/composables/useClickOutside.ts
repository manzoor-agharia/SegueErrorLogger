import { onBeforeUnmount, onMounted, type Ref } from 'vue';

/**
 * Calls `handler` on any document click landing outside `elementRef`. Replaces the
 * `@HostListener('document:click')` + `hostRef.nativeElement.contains(...)` pattern the
 * Angular components used to close their own dropdowns.
 */
export function useClickOutside(elementRef: Ref<HTMLElement | null>, handler: () => void): void {
  function onDocumentClick(event: MouseEvent): void {
    const el = elementRef.value;
    if (el && !el.contains(event.target as Node)) {
      handler();
    }
  }

  onMounted(() => document.addEventListener('click', onDocumentClick));
  onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));
}
