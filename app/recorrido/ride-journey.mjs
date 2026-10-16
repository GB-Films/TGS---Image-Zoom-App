export const TRAVEL_SECONDS = 4;
export const initialJourney = () => ({ phase: "idle", stop: 0, from: 0, to: 0, progress: 0 });

export function startJourney(state, stopCount) {
  if (state.phase === "riding") return state;
  if (state.phase === "paused") return { ...state, phase: "riding" };
  if (state.stop >= stopCount - 1) return state;
  return { ...state, phase: "riding", from: state.stop, to: state.stop + 1, progress: 0 };
}

export function pauseJourney(state) {
  return state.phase === "riding" ? { ...state, phase: "paused" } : state;
}

export function advanceJourney(state, seconds) {
  if (state.phase !== "riding") return state;
  const progress = Math.min(1, state.progress + Math.max(0, seconds) / TRAVEL_SECONDS);
  return { ...state, progress, ...(progress === 1 ? { phase: "arrived", stop: state.to } : {}) };
}
