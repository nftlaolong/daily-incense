import { describe, expect, it } from "vitest";
import {
  BURN_DURATION_MS,
  calculateBurnProgress,
  createIdleState,
  finishIfBurnedOut,
  openWishDialog,
  startBurning,
} from "./incenseState";

describe("incense state", () => {
  it("uses a 45 minute burn duration", () => {
    expect(BURN_DURATION_MS).toBe(45 * 60 * 1_000);
  });

  it("calculates burn progress from 0 to 1", () => {
    expect(calculateBurnProgress(1_000, 1_000, BURN_DURATION_MS)).toBe(0);
    expect(calculateBurnProgress(1_000 + BURN_DURATION_MS / 2, 1_000, BURN_DURATION_MS)).toBe(0.5);
    expect(calculateBurnProgress(1_000 + BURN_DURATION_MS, 1_000, BURN_DURATION_MS)).toBe(1);
    expect(calculateBurnProgress(1_000 + BURN_DURATION_MS + 1_000, 1_000, BURN_DURATION_MS)).toBe(1);
  });

  it("opens a wish dialog before incense starts burning", () => {
    const state = openWishDialog(createIdleState());

    expect(state.kind).toBe("Wishing");
  });

  it("starts a 45 minute incense burn with an optional wish", () => {
    const state = startBurning(createIdleState(), "今日顺遂", 12_000);

    expect(state).toEqual({
      kind: "Burning",
      startedAt: 12_000,
      durationMs: BURN_DURATION_MS,
      wishText: "今日顺遂",
    });
  });

  it("allows an empty wish without blocking incense", () => {
    const state = startBurning(createIdleState(), "", 12_000);

    expect(state.kind).toBe("Burning");
    if (state.kind === "Burning") {
      expect(state.wishText).toBe("");
    }
  });

  it("does not reset an existing burn when incense is requested again", () => {
    const original = startBurning(createIdleState(), "平安喜乐", 12_000);
    const next = startBurning(original, "工作顺利", 99_000);

    expect(next).toBe(original);
  });

  it("moves to finished once the incense has burned out", () => {
    const burning = startBurning(createIdleState(), "身体健康", 12_000);
    const finished = finishIfBurnedOut(burning, 12_000 + BURN_DURATION_MS);

    expect(finished).toEqual({
      kind: "Finished",
      wishText: "身体健康",
      finishedAt: 12_000 + BURN_DURATION_MS,
    });
  });
});
