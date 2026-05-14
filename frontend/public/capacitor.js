// Stub for non-Capacitor environments (Electron, web browser).
// The real capacitor.js is injected by the Capacitor iOS/Android runtime.
// This file prevents ERR_FILE_NOT_FOUND errors in Electron and web builds.
window.Capacitor = window.Capacitor || {
  isNativePlatform: () => false,
  getPlatform: () => 'web',
  isPluginAvailable: () => false,
  Plugins: {},
};
