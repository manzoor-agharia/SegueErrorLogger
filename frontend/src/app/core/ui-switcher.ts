/**
 * The three UIs are separate SPAs served from one origin by dev-proxy/ -- Angular at `/`,
 * Vue at `/vue/`, React at `/react/`. Because the origin is shared, so is localStorage, so
 * the JWT written by whichever app you logged in with is already present when the next one
 * boots: switching is a plain full-page navigation with no re-authentication.
 *
 * It must be `window.location.assign`, not a router navigation -- we are leaving this SPA
 * entirely and loading a different application.
 */

export type UiFlavor = 'angular' | 'vue' | 'react';

export const UI_FLAVORS: UiFlavor[] = ['angular', 'vue', 'react'];

export const UI_LABELS: Record<UiFlavor, string> = {
  angular: 'Angular',
  vue: 'Vue',
  react: 'React',
};

/** Base path each app is mounted at behind the dev proxy. */
const UI_BASE: Record<UiFlavor, string> = {
  angular: '/',
  vue: '/vue/',
  react: '/react/',
};

const UI_KEY = 'errorlogger_ui';

/** Which app this bundle is -- hard-coded per app, not inferred from the URL. */
export const CURRENT_UI: UiFlavor = 'angular';

export function storedUi(): UiFlavor {
  const raw = localStorage.getItem(UI_KEY);
  return UI_FLAVORS.includes(raw as UiFlavor) ? (raw as UiFlavor) : CURRENT_UI;
}

/**
 * Leaves this SPA and loads `flavor` at the given in-app route. Returns false (and does
 * nothing) when the target is the app already running, so callers can skip the reload.
 */
export function switchUi(flavor: UiFlavor, route = 'error-logs'): boolean {
  localStorage.setItem(UI_KEY, flavor);
  if (flavor === CURRENT_UI) return false;
  window.location.assign(`${UI_BASE[flavor]}${route}`);
  return true;
}
