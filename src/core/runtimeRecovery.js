const CHUNK_RELOAD_KEY = "rumo_chunk_reload";

export function installRuntimeRecovery() {
  window.addEventListener("vite:preloadError", (event) => {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;

    event.preventDefault();
    sessionStorage.setItem(CHUNK_RELOAD_KEY, new Date().toISOString());
    window.location.reload();
  });

  window.setTimeout(() => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  }, 10_000);
}
