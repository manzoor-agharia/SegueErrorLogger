export const environment = {
  production: false,
  apiUrl: '/api',
  truebell: true,
  /**
   * Shows the Angular/Vue/React picker on the login screen and in the toolbar.
   * Dev-only: `environment.prod.ts` sets this to false, and angular.json's production
   * `fileReplacements` swaps the file in, so the switcher is tree-shaken out of prod builds.
   * Switching between the three UIs only resolves when they are served from one origin --
   * see dev-proxy/README.md.
   */
  uiSwitcher: true,
};
