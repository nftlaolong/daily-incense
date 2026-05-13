import { describe, expect, it } from "vitest";
import { createIdleState, startBurning } from "./incenseState";
import { getIncenseFrameSource, selectIncenseFrame } from "./incenseRenderer";

describe("incense frame selection", () => {
  it("uses the first exported frame while idle", () => {
    const frame = selectIncenseFrame(createIdleState(), 1_000);

    expect(frame.index).toBe(0);
    expect(frame.file).toBe("incense_45min_01_progress_0000.png");
  });

  it("selects exported 45 minute frames from burn progress", () => {
    const burning = startBurning(createIdleState(), "所求皆如愿", 1_000);
    const frame = selectIncenseFrame(burning, 1_000 + 22.5 * 60 * 1_000);

    expect(frame.index).toBeGreaterThan(0);
    expect(frame.index).toBeLessThan(29);
    expect(frame.src).toContain("/incense-frames/");
  });

  it("shows lit incense immediately after offering", () => {
    const burning = startBurning(createIdleState(), "今日顺遂", 1_000);
    const frame = selectIncenseFrame(burning, 1_000);

    expect(frame.file).toBe("incense_45min_03_progress_0069.png");
  });

  it("uses the final exported frame at the end", () => {
    const burning = startBurning(createIdleState(), "身体健康", 1_000);
    const src = getIncenseFrameSource(burning, 1_000 + 45 * 60 * 1_000);

    expect(src).toBe("/incense-frames/incense_45min_30_progress_1000.png");
  });
});
