import { getBurnProgress, type IncenseState } from "./incenseState";

export type IncenseFrame = {
  index: number;
  file: string;
  src: string;
};

const FRAME_BASE_PATH = "/incense-frames";

const FRAME_FILES = [
  "incense_45min_01_progress_0000.png",
  "incense_45min_02_progress_0034.png",
  "incense_45min_03_progress_0069.png",
  "incense_45min_04_progress_0103.png",
  "incense_45min_05_progress_0138.png",
  "incense_45min_06_progress_0172.png",
  "incense_45min_07_progress_0207.png",
  "incense_45min_08_progress_0241.png",
  "incense_45min_09_progress_0276.png",
  "incense_45min_10_progress_0310.png",
  "incense_45min_11_progress_0345.png",
  "incense_45min_12_progress_0379.png",
  "incense_45min_13_progress_0414.png",
  "incense_45min_14_progress_0448.png",
  "incense_45min_15_progress_0483.png",
  "incense_45min_16_progress_0517.png",
  "incense_45min_17_progress_0552.png",
  "incense_45min_18_progress_0586.png",
  "incense_45min_19_progress_0621.png",
  "incense_45min_20_progress_0655.png",
  "incense_45min_21_progress_0690.png",
  "incense_45min_22_progress_0724.png",
  "incense_45min_23_progress_0759.png",
  "incense_45min_24_progress_0793.png",
  "incense_45min_25_progress_0828.png",
  "incense_45min_26_progress_0862.png",
  "incense_45min_27_progress_0897.png",
  "incense_45min_28_progress_0931.png",
  "incense_45min_29_progress_0966.png",
  "incense_45min_30_progress_1000.png",
] as const;

export function selectIncenseFrame(state: IncenseState, now: number): IncenseFrame {
  const progress = getBurnProgress(state, now);
  const index = selectFrameIndex(state, progress);
  const file = FRAME_FILES[index];

  return {
    index,
    file,
    src: `${FRAME_BASE_PATH}/${file}`,
  };
}

function selectFrameIndex(state: IncenseState, progress: number): number {
  if (state.kind === "Idle" || state.kind === "Wishing") {
    return 0;
  }

  if (state.kind === "Finished" || progress >= 1) {
    return FRAME_FILES.length - 1;
  }

  const firstBurningFrame = 2;
  const burningFrameCount = FRAME_FILES.length - firstBurningFrame;
  return Math.min(
    FRAME_FILES.length - 1,
    firstBurningFrame + Math.round(progress * (burningFrameCount - 1)),
  );
}

export function getIncenseFrameSource(state: IncenseState, now: number): string {
  return selectIncenseFrame(state, now).src;
}

export function renderIncenseFrame(image: HTMLImageElement, state: IncenseState, now: number): void {
  const frame = selectIncenseFrame(state, now);
  if (image.getAttribute("src") !== frame.src) {
    image.src = frame.src;
  }
  image.dataset.frameIndex = String(frame.index);
  image.dataset.progress = getBurnProgress(state, now).toFixed(4);
}
