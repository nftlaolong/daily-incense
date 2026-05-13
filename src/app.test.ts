// @vitest-environment jsdom
import { fireEvent, getByRole, queryByText } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountDailyIncenseApp } from "./app";

function createRoot(windowRole: "main" | "offer" = "main") {
  document.body.innerHTML = `
    <main id="app" data-window-role="${windowRole}">
      <section class="incense-stage" data-tauri-drag-region>
        <img id="incense-frame" />
      </section>
      <aside class="offer-shell">
        <div class="offer-drag-handle" data-tauri-drag-region></div>
        <button id="offer-button">上香</button>
        <p id="offer-caption">今日宜上香</p>
      </aside>
      <aside class="control-panel">
        <p id="status-text"></p>
        <p id="wish-text"></p>
      </aside>
      <section id="wish-dialog" class="wish-panel" hidden>
        <input id="wish-input" />
        <div id="preset-wishes"></div>
        <button id="confirm-wish">开始上香</button>
        <button id="cancel-wish">取消</button>
      </section>
      <nav id="context-menu" hidden>
        <button data-menu-action="offer">上香</button>
        <button data-menu-action="toggle">显示/隐藏</button>
        <button data-menu-action="quit">退出</button>
      </nav>
    </main>
  `;

  return document.body;
}

describe("daily incense UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the main incense window as a small draggable pet surface", () => {
    const root = createRoot();
    const dragWindow = vi.fn();
    mountDailyIncenseApp({ dragWindow, now: () => 1_000, requestFrame: () => 1 });

    expect(root.querySelector("#app")?.classList.contains("mode-main")).toBe(true);
    expect(root.querySelector(".incense-stage")?.getAttribute("data-tauri-drag-region")).toBe("");
    expect(root.querySelector(".offer-shell")?.hasAttribute("hidden")).toBe(true);
    expect(queryByText(root, "今日可上香")).toBeNull();
    expect(root.querySelector("#incense-frame")?.getAttribute("src")).toContain(
      "incense_45min_01_progress_0000.png",
    );

    fireEvent.pointerDown(root.querySelector(".incense-stage") as HTMLElement, { button: 0 });
    expect(dragWindow).toHaveBeenCalledWith("start", expect.any(Object));
  });

  it("renders the offer window as a compact movable button without old status copy", () => {
    const root = createRoot("offer");
    const dragWindow = vi.fn();
    mountDailyIncenseApp({ dragWindow, now: () => 1_000, requestFrame: () => 1 });

    expect(root.querySelector("#app")?.classList.contains("mode-offer")).toBe(true);
    expect(root.querySelector(".incense-stage")?.hasAttribute("hidden")).toBe(true);
    expect(root.querySelector(".offer-shell")?.hasAttribute("hidden")).toBe(false);
    expect(root.querySelector(".offer-drag-handle")?.getAttribute("data-tauri-drag-region")).toBe("");
    expect(queryByText(root, "今日可上香")).toBeNull();
    expect(queryByText(root, "今日宜上香")).toBeTruthy();

    fireEvent.pointerDown(root.querySelector(".offer-drag-handle") as HTMLElement, { button: 0 });
    expect(dragWindow).toHaveBeenCalledWith("start", expect.any(Object));
  });

  it("opens an independent wish panel and collapses it after confirming", () => {
    const root = createRoot("offer");
    const invoke = vi.fn();
    const setOfferWindowMode = vi.fn();
    mountDailyIncenseApp({ invoke, setOfferWindowMode, now: () => 1_000, requestFrame: () => 1 });

    fireEvent.click(getByRole(root, "button", { name: "上香" }));
    expect(root.querySelector("#wish-dialog")?.hasAttribute("hidden")).toBe(false);
    expect(setOfferWindowMode).toHaveBeenCalledWith("expanded");
    fireEvent.click(getByRole(root, "button", { name: "今日顺遂" }));
    fireEvent.click(getByRole(root, "button", { name: "开始上香" }));

    expect(invoke).toHaveBeenCalledWith("start_incense", { wish_text: "今日顺遂" });
    expect(root.querySelector("#wish-dialog")?.hasAttribute("hidden")).toBe(true);
    expect(setOfferWindowMode).toHaveBeenLastCalledWith("compact");
  });

  it("starts burning from the exported image sequence without an extra smoke layer", () => {
    const root = createRoot();
    let startHandler: ((event: { payload: string | null }) => void) | undefined;
    mountDailyIncenseApp({
      now: () => 1_000,
      requestFrame: () => 1,
      listen: (event, handler) => {
        if (event === "daily-incense:start") {
          startHandler = handler;
        }
        return () => {};
      },
    });

    startHandler?.({ payload: "今日顺遂" });

    expect(root.querySelector("#smoke-layer")).toBeNull();
    expect(root.querySelector("#incense-frame")?.getAttribute("src")).toContain(
      "incense_45min_03_progress_0069.png",
    );
  });

  it("does not restart an active burn when receiving another offer", () => {
    const root = createRoot();
    let now = 10_000;
    let startHandler: ((event: { payload: string | null }) => void) | undefined;
    mountDailyIncenseApp({
      now: () => now,
      requestFrame: () => 1,
      listen: (_event, handler) => {
        startHandler = handler;
        return () => {};
      },
    });

    startHandler?.({ payload: "平安喜乐" });
    now = 50_000;
    startHandler?.({ payload: "今日顺遂" });

    expect(root.querySelector("#wish-text")?.textContent).toBe("平安喜乐");
    expect((root.querySelector("#incense-frame") as HTMLElement | null)?.dataset.progress).toBe(
      "0.0148",
    );
  });

  it("keeps the context menu wide enough for display toggle text", () => {
    const root = createRoot();
    mountDailyIncenseApp({ now: () => 1_000, requestFrame: () => 1 });

    fireEvent.contextMenu(root.querySelector("#app") as HTMLElement, { clientX: 200, clientY: 180 });

    expect(root.querySelector("#context-menu")?.classList.contains("wide-menu")).toBe(true);
  });

  it("invokes hide when the incense finishes", () => {
    createRoot();
    const invoke = vi.fn();
    let startHandler: ((event: { payload: string | null }) => void) | undefined;
    let callback: FrameRequestCallback = () => {};
    let now = 1_000;
    mountDailyIncenseApp({
      invoke,
      now: () => now,
      listen: (_event, handler) => {
        startHandler = handler;
        return () => {};
      },
      requestFrame: (next) => {
        callback = next;
        return 1;
      },
    });

    startHandler?.({ payload: "身体健康" });
    now += 45 * 60 * 1_000;
    callback(0);

    expect(invoke).toHaveBeenCalledWith("hide_pet_window");
  });
});
