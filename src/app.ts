import {
  closeWishDialog,
  createIdleState,
  finishIfBurnedOut,
  getBurnProgress,
  openWishDialog,
  startBurning,
  type IncenseState,
} from "./incenseState";
import { renderIncenseFrame } from "./incenseRenderer";

export const PRESET_WISHES = ["今日顺遂", "平安喜乐", "所求皆如愿", "工作顺利", "身体健康"];

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown> | unknown;
type Listen = (
  event: string,
  handler: (event: { payload: string | null }) => void,
) => Promise<() => void> | (() => void);
type WindowDragPhase = "start" | "move" | "end";
type WindowDragPoint = { screen_x: number; screen_y: number };

export type AppDependencies = {
  invoke?: Invoke;
  listen?: Listen;
  now?: () => number;
  requestFrame?: (callback: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
  dragWindow?: (phase: WindowDragPhase, point?: WindowDragPoint) => Promise<unknown> | unknown;
  setOfferWindowMode?: (mode: "compact" | "expanded") => Promise<unknown> | unknown;
};

export type MountedDailyIncenseApp = {
  destroy: () => void;
};

export function mountDailyIncenseApp(dependencies: AppDependencies = {}): MountedDailyIncenseApp {
  const app = mustFind<HTMLElement>("#app");
  const windowRole = getWindowRole(app);
  app.classList.add(windowRole === "offer" ? "mode-offer" : "mode-main");

  if (windowRole === "offer") {
    return mountOfferWindow(app, dependencies);
  }

  return mountMainWindow(app, dependencies);
}

function mountMainWindow(app: HTMLElement, dependencies: AppDependencies): MountedDailyIncenseApp {
  const now = dependencies.now ?? (() => Date.now());
  const requestFrame = dependencies.requestFrame ?? window.requestAnimationFrame.bind(window);
  const cancelFrame = dependencies.cancelFrame ?? window.cancelAnimationFrame.bind(window);

  const incenseFrame = mustFind<HTMLImageElement>("#incense-frame");
  const incenseStage = mustFind<HTMLElement>(".incense-stage");
  const offerShell = mustFind<HTMLElement>(".offer-shell");
  const wishDialog = mustFind<HTMLElement>("#wish-dialog");
  const controlPanel = optionalFind<HTMLElement>(".control-panel");
  const statusText = mustFind<HTMLElement>("#status-text");
  const wishText = mustFind<HTMLElement>("#wish-text");

  let state: IncenseState = createIdleState();
  let hasRequestedHide = false;
  let frameHandle = 0;

  incenseStage.hidden = false;
  incenseStage.setAttribute("data-tauri-drag-region", "");
  offerShell.hidden = true;
  wishDialog.hidden = true;
  if (controlPanel) {
    controlPanel.hidden = true;
  }

  const cleanupDrag = installWindowDrag(incenseStage, dependencies);

  const cleanupContextMenu = setupContextMenu(app, "main", dependencies);

  const requestOffer = (wish?: string | null) => {
    if (state.kind === "Burning") {
      render();
      return;
    }

    if (typeof wish === "string") {
      state = startBurning(state, wish, now());
      render();
      return;
    }

    void dependencies.invoke?.("show_offer_window");
  };

  const unlisten = dependencies.listen?.("daily-incense:start", (event) => {
    requestOffer(event.payload);
  });

  function tick() {
    state = finishIfBurnedOut(state, now());
    render();
    frameHandle = requestFrame(tick);
  }

  function render() {
    renderIncenseFrame(incenseFrame, state, now());
    const progress = getBurnProgress(state, now());

    if (state.kind === "Burning") {
      statusText.textContent = "香火已燃起";
      wishText.textContent = state.wishText;
    } else if (state.kind === "Finished") {
      statusText.textContent = "香灰已燃尽";
      wishText.textContent = state.wishText;
      if (!hasRequestedHide) {
        hasRequestedHide = true;
        void dependencies.invoke?.("hide_pet_window");
      }
    } else {
      statusText.textContent = "";
      wishText.textContent = "";
    }

    incenseFrame.dataset.progress = progress.toFixed(4);
  }

  render();
  frameHandle = requestFrame(tick);

  return {
    destroy: () => {
      cancelFrame(frameHandle);
      cleanupDrag();
      cleanupContextMenu();
      if (typeof unlisten === "function") {
        unlisten();
      } else {
        void unlisten?.then((cleanup) => cleanup());
      }
    },
  };
}

function mountOfferWindow(app: HTMLElement, dependencies: AppDependencies): MountedDailyIncenseApp {
  const incenseStage = mustFind<HTMLElement>(".incense-stage");
  const offerShell = mustFind<HTMLElement>(".offer-shell");
  const controlPanel = optionalFind<HTMLElement>(".control-panel");
  const offerButton = mustFind<HTMLButtonElement>("#offer-button");
  const wishDialog = mustFind<HTMLElement>("#wish-dialog");
  const wishInput = mustFind<HTMLInputElement>("#wish-input");
  const presetContainer = mustFind<HTMLElement>("#preset-wishes");
  const confirmWish = mustFind<HTMLButtonElement>("#confirm-wish");
  const cancelWish = mustFind<HTMLButtonElement>("#cancel-wish");

  incenseStage.hidden = true;
  offerShell.hidden = false;
  if (controlPanel) {
    controlPanel.hidden = true;
  }

  presetContainer.replaceChildren(
    ...PRESET_WISHES.map((wish) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-wish";
      button.textContent = wish;
      button.addEventListener("click", () => {
        wishInput.value = wish;
      });
      return button;
    }),
  );

  let state: IncenseState = createIdleState();
  const cleanupContextMenu = setupContextMenu(app, "offer", dependencies, showWishDialog);
  const cleanupDrag = installWindowDrag(offerShell, dependencies);

  const requestOffer = () => {
    state = openWishDialog(state);
    wishInput.value = "";
    showWishDialog();
  };

  const confirmOffer = () => {
    const wishText = wishInput.value;
    void dependencies.invoke?.("start_incense", { wish_text: wishText });
    state = closeWishDialog(state);
    hideWishDialog();
  };

  const cancelOffer = () => {
    state = closeWishDialog(state);
    hideWishDialog();
  };

  offerButton.addEventListener("click", () => requestOffer());
  confirmWish.addEventListener("click", confirmOffer);
  cancelWish.addEventListener("click", cancelOffer);
  wishInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirmOffer();
    }
  });

  function showWishDialog() {
    wishDialog.hidden = false;
    void dependencies.setOfferWindowMode?.("expanded");
    wishInput.focus();
  }

  function hideWishDialog() {
    wishDialog.hidden = true;
    void dependencies.setOfferWindowMode?.("compact");
  }

  hideWishDialog();

  return {
    destroy: () => {
      cleanupDrag();
      cleanupContextMenu();
    },
  };
}

function installWindowDrag(target: HTMLElement, dependencies: AppDependencies) {
  const toPoint = (event: PointerEvent): WindowDragPoint => ({
    screen_x: event.screenX,
    screen_y: event.screenY,
  });

  const onPointerMove = (event: PointerEvent) => {
    void dependencies.dragWindow?.("move", toPoint(event));
  };

  const stopDragging = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDragging);
    window.removeEventListener("pointercancel", stopDragging);
    void dependencies.dragWindow?.("end");
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    void dependencies.dragWindow?.("start", toPoint(event));
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
  };

  target.addEventListener("pointerdown", onPointerDown);

  return () => {
    target.removeEventListener("pointerdown", onPointerDown);
    stopDragging();
  };
}

function mustFind<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

function optionalFind<T extends Element>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

function getWindowRole(app: HTMLElement): "main" | "offer" {
  const declaredRole = app.dataset.windowRole;
  if (declaredRole === "offer" || declaredRole === "main") {
    return declaredRole;
  }

  const queryRole = new URLSearchParams(window.location.search).get("window");
  return queryRole === "offer" ? "offer" : "main";
}

function setupContextMenu(
  app: HTMLElement,
  role: "main" | "offer",
  dependencies: AppDependencies,
  openOfferLocally?: () => void,
) {
  const contextMenu = mustFind<HTMLElement>("#context-menu");

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    contextMenu.classList.add("wide-menu");
    contextMenu.style.left = `${Math.min(event.clientX, app.clientWidth - 122)}px`;
    contextMenu.style.top = `${Math.min(event.clientY, app.clientHeight - 96)}px`;
    contextMenu.hidden = false;
  };

  const onDocumentClick = () => {
    contextMenu.hidden = true;
  };

  const onMenuClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const action = target?.dataset.menuAction;
    if (!action) {
      return;
    }

    contextMenu.hidden = true;
    if (action === "offer") {
      if (role === "offer") {
        openOfferLocally?.();
      } else {
        void dependencies.invoke?.("show_offer_window");
      }
    } else if (action === "toggle") {
      void dependencies.invoke?.("hide_pet_window");
    } else if (action === "quit") {
      void dependencies.invoke?.("quit_app");
    }
  };

  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("click", onDocumentClick);
  contextMenu.addEventListener("click", onMenuClick);

  return () => {
    document.removeEventListener("contextmenu", onContextMenu);
    document.removeEventListener("click", onDocumentClick);
    contextMenu.removeEventListener("click", onMenuClick);
  };
}
