export type OnboardingCategory =
  | "Profile"
  | "Schedule"
  | "Cleanliness"
  | "Noise"
  | "Guests"
  | "Boundaries"
  | "Lifestyle"
  | "Environment"
  | "Money"
  | "Chores"
  | "Communication"
  | "Social fit"
  | "Values"
  | "Risk flags"
  | "Open-ended";

export type Scale1to5Answer = 1 | 2 | 3 | 4 | 5;

export type TimeRangeAnswer = {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
};

export type NumericRangeAnswer = {
  min: number | null;
  max: number | null;
};

export type DateRangeAnswer = {
  start: string | null; // "YYYY-MM-DD"
  end: string | null; // "YYYY-MM-DD"
};

export type ChoiceWithOtherAnswer = {
  choice: string;
  otherText?: string;
};

export type RankedMultiSelectAnswer = {
  rankedIds: string[]; // ordered, top N
};

export type OnboardingQuestion =
  | {
      id: string;
      category: OnboardingCategory;
      prompt: string;
      kind: "scale_1_5";
      minLabel?: string;
      maxLabel?: string;
    }
  | {
      id: string;
      category: OnboardingCategory;
      prompt: string;
      kind: "single_select";
      options: { id: string; label: string }[];
    }
  | {
      id: string;
      category: OnboardingCategory;
      prompt: string;
      kind: "multi_select";
      options: { id: string; label: string }[];
      minSelected?: number;
      maxSelected?: number;
    }
  | {
      id: string;
      category: OnboardingCategory;
      prompt: string;
      kind: "rank_top_n";
      options: { id: string; label: string }[];
      n: number;
    }
  | {
      id: string;
      category: OnboardingCategory;
      prompt: string;
      kind: "short_text";
      placeholder?: string;
      maxLength?: number;
    }
  | {
      id: string;
      category: OnboardingCategory;
      prompt: string;
      kind: "numeric_range";
      minPlaceholder?: string;
      maxPlaceholder?: string;
    }
  | {
      id: string;
      category: OnboardingCategory;
      prompt: string;
      kind: "date_range";
    }
  | {
      id: string;
      category: OnboardingCategory;
      prompt: string;
      kind: "time_range";
    }
  | {
      id: string;
      category: OnboardingCategory;
      prompt: string;
      kind: "choice_with_other";
      options: { id: string; label: string }[];
      otherOptionId: string;
      otherPlaceholder?: string;
    };

export type OnboardingAnswerValue =
  | Scale1to5Answer
  | string
  | string[]
  | TimeRangeAnswer
  | NumericRangeAnswer
  | DateRangeAnswer
  | ChoiceWithOtherAnswer
  | RankedMultiSelectAnswer
  | null;

export type OnboardingAnswerMap = Record<string, OnboardingAnswerValue>;

