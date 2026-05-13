import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { mountDailyIncenseApp } from "./app";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const isRunningInTauri = typeof window.__TAURI_INTERNALS__ !== "undefined";
  mountDailyIncenseApp(
    isRunningInTauri
      ? {
          invoke,
          listen,
          dragWindow: (phase, point) => {
            if (phase === "start" && point) {
              return invoke("begin_window_drag", point);
            }
            if (phase === "move" && point) {
              return invoke("move_window_drag", point);
            }
            return invoke("end_window_drag");
          },
          setOfferWindowMode: (mode) => invoke("set_offer_window_mode", { mode }),
        }
      : {},
  );
});
