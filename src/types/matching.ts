export type SleepSchedule = "early_bird" | "night_owl";

/** Normalized 5-bucket “ideal week at home” from the allocation game (sums to 100). */
export type HomeWeekSplit = {
  sharedHangout: number;
  soloRecharge: number;
  quietWorkStudy: number;
  guestsVisitors: number;
  choresShared: number;
};

export type TraitVector = {
  cleanliness: number;
  socialEnergy: number;
  noiseTolerance: number;
  sleepSchedule: SleepSchedule;
  petsOk: boolean;
  /** How direct vs avoidant this person tends to be in conflict (1–10). */
  conflictDirectness: number;
  /** How flexible vs rigid about routines and house norms (1–10). */
  routineFlexibility: number;
  homeWeekSplit: HomeWeekSplit;
};

export type RoommatePreference = {
  desiredCleanliness: number;
  desiredSocialEnergy: number;
  desiredNoiseTolerance: number;
  preferredSleepSchedule: SleepSchedule;
  wantsPetFriendlyRoommate: boolean;
  /** Preferred roommate communication style (1–10, higher = more direct). */
  desiredConflictDirectness: number;
  /** Preferred roommate flexibility vs structure (1–10). */
  desiredRoutineFlexibility: number;
  /** Preferred roommate rhythm: how they’d spend a typical week at home. */
  desiredHomeWeekSplit: HomeWeekSplit;
};

export type UserModel = {
  behavior: TraitVector;
  preferences: RoommatePreference;
};

export type CandidateProfile = {
  id: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  photoUrl?: string;
  hobbies: string[];
  traits: TraitVector;
};

export type OnboardingQuestion = {
  id: keyof OnboardingAnswerMap;
  section: "about_you" | "looking_for";
  prompt: string;
  minLabel: string;
  maxLabel: string;
};

export type OnboardingAnswerMap = {
  your_cleanliness: number;
  your_social_energy: number;
  your_noise_tolerance: number;
  your_sleep_style: number;
  your_pet_comfort: number;
  roommate_cleanliness: number;
  roommate_social_energy: number;
  roommate_noise_tolerance: number;
  roommate_sleep_style: number;
  roommate_pet_friendly: number;
};

export type CompatibilityBreakdown = {
  behaviorFit: number;
  preferenceFit: number;
  lifestyleFit: number;
  /** Home-week overlap, conflict style, and routine fit (0–100). */
  gameFit: number;
};

export type CompatibilityResult = {
  totalScore: number;
  breakdown: CompatibilityBreakdown;
};
