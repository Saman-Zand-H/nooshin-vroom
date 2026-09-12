import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./rooms.css";
import "./imdb.css";
import { migrateHashRoute, restoreStaticRoute } from "./lib/routes";

restoreStaticRoute();
migrateHashRoute();

class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Keep the user-facing screen calm while leaving actionable diagnostics in
    // the browser console for production debugging.
    console.error("For Nooshin render failure", error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <main className="room-loading">
        <h1>Let’s open the door again.</h1>
        <p>
          Something didn’t load correctly. Your saved items have not been
          removed.
        </p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Reload the room
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppBoundary>
      <App />
    </AppBoundary>
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const scope = new URL(import.meta.env.BASE_URL, location.href).href;
      const registration = await navigator.serviceWorker.getRegistration(scope);
      // Retire the earlier cache-everything worker, scoped to this exact app.
      if (
        registration?.scope === scope &&
        registration.active?.scriptURL === `${scope}sw.js`
      ) {
        await registration.unregister();
        await caches.delete("control-room-shell-v1");
      }
      if (import.meta.env.PROD) {
        const worker = await navigator.serviceWorker.register(
          `${scope}room-sw.js`,
          { scope },
        );
        // Activate on the next visit once existing app tabs close; never interrupt a draft.
        await worker.update();
      }
    } catch {
      /* The app remains usable when installation is unavailable. */
    }
  });
}
