import type { OnboardingAnswerMap } from "../types/onboarding";
import type { MiniGameAnswers } from "../types/miniGames";

export type StoredOnboardingPayload = {
  answers: OnboardingAnswerMap;
  miniGames?: MiniGameAnswers | null;
};

/** Old “mug” vignette choice ids → new noise-boundary ids (same scenario key `mug` in storage). */
const LEGACY_MUG_CHOICE_MAP: Record<string, string> = {
  note: "ask_quiet",
  buy_mugs: "cope_first",
  ignore: "let_it_go",
};

function migrateMiniGames(miniGames: MiniGameAnswers | null | undefined): MiniGameAnswers | null {
  if (!miniGames?.scenarios?.length) return miniGames ?? null;
  const scenarios = miniGames.scenarios.map((s) => {
    if (s.id !== "mug") return s;
    const mapped = LEGACY_MUG_CHOICE_MAP[s.choiceId];
    return mapped ? { ...s, choiceId: mapped } : s;
  });
  return { ...miniGames, scenarios };
}

export function parseOnboardingPayload(raw: string): StoredOnboardingPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if ("answers" in obj && obj.answers && typeof obj.answers === "object") {
      return {
        answers: obj.answers as OnboardingAnswerMap,
        miniGames: migrateMiniGames((obj.miniGames as MiniGameAnswers) ?? null),
      };
    }
    return { answers: parsed as OnboardingAnswerMap, miniGames: null };
  } catch {
    return null;
  }
}

export function serializeOnboardingPayload(payload: StoredOnboardingPayload): string {
  return JSON.stringify(payload);
}
