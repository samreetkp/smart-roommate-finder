import type { HomeWeekSplit } from "./matching";

export type ScenarioId = "tp" | "mug" | "partner";

export type MiniGameAnswers = {
  /** 100-point “ideal week at home” split across five buckets. */
  weekBudget: HomeWeekSplit;
  /** Order of evening activities (same ids as EVENING_CARD_IDS). */
  eveningOrder: string[];
  /** Three quick conflict vignettes. */
  scenarios: {
    id: ScenarioId;
    choiceId: string;
    annoyance: 1 | 2 | 3 | 4 | 5;
  }[];
};
