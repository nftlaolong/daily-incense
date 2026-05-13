export const BURN_DURATION_MS = 45 * 60 * 1_000;

export type IncenseState =
  | { kind: "Idle" }
  | { kind: "Wishing" }
  | {
      kind: "Burning";
      startedAt: number;
      durationMs: number;
      wishText: string;
    }
  | {
      kind: "Finished";
      wishText: string;
      finishedAt: number;
    };

export function createIdleState(): IncenseState {
  return { kind: "Idle" };
}

export function openWishDialog(state: IncenseState): IncenseState {
  return state.kind === "Burning" ? state : { kind: "Wishing" };
}

export function closeWishDialog(state: IncenseState): IncenseState {
  return state.kind === "Wishing" ? createIdleState() : state;
}

export function startBurning(state: IncenseState, wishText: string, now: number): IncenseState {
  if (state.kind === "Burning") {
    return state;
  }

  return {
    kind: "Burning",
    startedAt: now,
    durationMs: BURN_DURATION_MS,
    wishText: wishText.trim(),
  };
}

export function calculateBurnProgress(now: number, startedAt: number, durationMs: number): number {
  if (durationMs <= 0) {
    return 1;
  }

  const progress = (now - startedAt) / durationMs;
  return Math.min(1, Math.max(0, progress));
}

export function finishIfBurnedOut(state: IncenseState, now: number): IncenseState {
  if (state.kind !== "Burning") {
    return state;
  }

  if (calculateBurnProgress(now, state.startedAt, state.durationMs) < 1) {
    return state;
  }

  return {
    kind: "Finished",
    wishText: state.wishText,
    finishedAt: now,
  };
}

export function getBurnProgress(state: IncenseState, now: number): number {
  if (state.kind !== "Burning") {
    return state.kind === "Finished" ? 1 : 0;
  }

  return calculateBurnProgress(now, state.startedAt, state.durationMs);
}
