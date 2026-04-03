import { DEFAULT_EVENING_ORDER, SCENARIO_CHOICE_DIRECTNESS } from "../data/miniGameScenarios";
import type { OnboardingAnswerMap, TimeRangeAnswer } from "../types/onboarding";
import type { MiniGameAnswers } from "../types/miniGames";
import {
  CandidateProfile,
  CompatibilityResult,
  HomeWeekSplit,
  OnboardingAnswerMap as CoreCompatibilityAnswers,
  SleepSchedule,
  UserModel,
} from "../types/matching";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function scaleToTen(answer: number) {
  return clamp(answer * 2, 1, 10);
}

function sleepFromAnswer(answer: number): SleepSchedule {
  return answer <= 3 ? "early_bird" : "night_owl";
}

export function proximityScore(a: number, b: number) {
  const diff = Math.abs(a - b);
  return clamp(100 - diff * 12.5, 0, 100);
}

function parseScale1to5(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  const rounded = Math.round(value);
  return clamp(rounded, 1, 5);
}

/** Maps full questionnaire → legacy 10-field core answers (used for baseline traits). */
export function deriveCoreCompatibilityAnswers(answers: OnboardingAnswerMap): CoreCompatibilityAnswers {
  const cleanShared = parseScale1to5(answers.clean_shared_spaces, 3);
  const dayNoiseOk = parseScale1to5(answers.noise_day_ok, 3);
  const directness = parseScale1to5(answers.comm_directness, 3);
  const homeEvenings = parseScale1to5(answers.schedule_home_evenings, 3);

  const sleep = answers.schedule_sleep_weekdays as TimeRangeAnswer | null | undefined;
  const bedtime = sleep?.start ?? "22:30";
  const bedtimeHour = Number(bedtime.split(":")[0] ?? 22);
  const sleepStyle: 1 | 2 | 3 | 4 | 5 = bedtimeHour <= 22 ? 2 : bedtimeHour <= 23 ? 3 : 5;

  const petsOk = answers.lifestyle_pets_ok as string | null;
  const petComfort: 1 | 2 | 3 | 4 | 5 =
    petsOk === "no" ? 1 : petsOk === "cats_only" ? 3 : petsOk === "dogs_only" ? 4 : 5;

  const blendedSocial = clamp(Math.round((homeEvenings + directness) / 2), 1, 5) as 1 | 2 | 3 | 4 | 5;

  return {
    your_cleanliness: cleanShared,
    your_social_energy: blendedSocial,
    your_noise_tolerance: dayNoiseOk,
    your_sleep_style: sleepStyle,
    your_pet_comfort: petComfort,
    roommate_cleanliness: cleanShared,
    roommate_social_energy: blendedSocial,
    roommate_noise_tolerance: parseScale1to5(answers.noise_night_ok, 3),
    roommate_sleep_style: sleepStyle,
    roommate_pet_friendly: petComfort,
  };
}

export function normalizeHomeWeek(vec: HomeWeekSplit): HomeWeekSplit {
  const keys = [
    "sharedHangout",
    "soloRecharge",
    "quietWorkStudy",
    "guestsVisitors",
    "choresShared",
  ] as const;
  const minFloor = 4;
  const adjusted = keys.map((k) => Math.max(minFloor, vec[k]));
  const sum = adjusted.reduce((a, b) => a + b, 0);
  const scale = 100 / sum;
  const raw = Object.fromEntries(keys.map((k, i) => [k, Math.round(adjusted[i] * scale)])) as HomeWeekSplit;
  let total = keys.reduce((acc, k) => acc + raw[k], 0);
  if (total !== 100) {
    const diff = 100 - total;
    const maxKey = keys.reduce((best, k) => (raw[k] > raw[best] ? k : best), keys[0]);
    raw[maxKey] = clamp(raw[maxKey] + diff, minFloor, 100);
  }
  return raw;
}

/**
 * Infers “ideal week at home” weights from schedule, guests, social, chores, and boundaries.
 * When dedicated onboarding games exist, their outputs can replace or blend with this.
 */
export function inferHomeWeekSplit(answers: OnboardingAnswerMap): HomeWeekSplit {
  let shared = 20;
  let solo = 20;
  let quiet = 20;
  let guests = 20;
  let chores = 20;

  const homeEve = parseScale1to5(answers.schedule_home_evenings, 3);
  shared += (homeEve - 3) * 4;
  solo -= (homeEve - 3) * 2;

  const wfh = answers.schedule_wfh as string | undefined;
  if (wfh === "full_time") quiet += 18;
  else if (wfh === "often") quiet += 12;
  else if (wfh === "sometimes") quiet += 6;

  const guestsFriends = answers.guests_friends_over as string | undefined;
  if (guestsFriends === "several_weekly") guests += 20;
  else if (guestsFriends === "weekly") guests += 12;
  else if (guestsFriends === "monthly") guests += 4;
  else if (guestsFriends === "never") guests -= 8;

  const doTogether = answers.social_do_things_together as string | undefined;
  if (doTogether === "often") shared += 12;
  else if (doTogether === "sometimes") shared += 4;
  else shared -= 6;

  const friendLevel = answers.social_close_friend_level as string | undefined;
  if (friendLevel === "best_friends") shared += 10;
  else if (friendLevel === "friendly") shared += 4;
  else if (friendLevel === "neutral") solo += 4;
  else if (friendLevel === "separate_lives") solo += 10;

  const choresStr = answers.chores_structure as string | undefined;
  if (choresStr === "structured") chores += 8;
  else if (choresStr === "some_structure") chores += 4;
  else chores += 2;

  if (answers.chores_duties_handling === "rotating") chores += 4;

  const alone = parseScale1to5(answers.boundaries_alone_time, 3);
  solo += (alone - 3) * 4;

  return normalizeHomeWeek({
    sharedHangout: shared,
    soloRecharge: solo,
    quietWorkStudy: quiet,
    guestsVisitors: guests,
    choresShared: chores,
  });
}

/** Roommate “desired week” split given a concrete home-week vector (from questionnaire or mini-game). */
export function desiredFromGameWeek(answers: OnboardingAnswerMap, homeWeek: HomeWeekSplit): HomeWeekSplit {
  const doTogether = answers.social_do_things_together as string | undefined;
  let bump = 0;
  if (doTogether === "often") bump = 8;
  else if (doTogether === "sometimes") bump = 3;
  else if (doTogether === "never") bump = -6;

  const adjusted: HomeWeekSplit = {
    ...homeWeek,
    sharedHangout: clamp(homeWeek.sharedHangout + bump, 4, 92),
    soloRecharge: clamp(homeWeek.soloRecharge - Math.round(bump / 2), 4, 92),
  };
  return normalizeHomeWeek(adjusted);
}

/** What the user wants in a roommate’s week rhythm (slightly nudged by “do things together”). */
export function inferDesiredHomeWeekSplit(answers: OnboardingAnswerMap): HomeWeekSplit {
  return desiredFromGameWeek(answers, inferHomeWeekSplit(answers));
}

export function inferConflictDirectness(answers: OnboardingAnswerMap): number {
  const commScale = parseScale1to5(answers.comm_directness, 3);
  let direct = 2 + commScale * 1.5;

  const ifBothered = answers.comm_if_bothered as string | undefined;
  if (ifBothered === "talk_immediately") direct += 2;
  else if (ifBothered === "wait_then_talk") direct += 0.5;
  else if (ifBothered === "hint") direct -= 1.5;
  else if (ifBothered === "avoid") direct -= 3;

  return Math.round(clamp(direct, 1, 10));
}

export function inferRoutineFlexibility(answers: OnboardingAnswerMap): number {
  let flex = 5;

  const dish = answers.clean_dishes_timing as string | undefined;
  if (dish === "immediately") flex -= 2;
  else if (dish === "same_day") flex -= 1;
  else if (dish === "within_24h") flex += 1;
  else if (dish === "flexible") flex += 3;

  const chore = answers.chores_structure as string | undefined;
  if (chore === "structured") flex -= 2;
  else if (chore === "some_structure") flex += 0;
  else if (chore === "flexible") flex += 2;

  const gn = answers.guests_notice as string | undefined;
  if (gn === "none") flex += 2;
  else if (gn === "few_hours") flex += 1;
  else if (gn === "one_day") flex -= 1;
  else if (gn === "more_than_one_day") flex -= 2;

  return Math.round(clamp(flex, 1, 10));
}

export function inferDesiredConflictDirectness(answers: OnboardingAnswerMap): number {
  return inferConflictDirectness(answers);
}

export function inferDesiredRoutineFlexibility(answers: OnboardingAnswerMap): number {
  return inferRoutineFlexibility(answers);
}

function homeWeekDistanceScore(a: HomeWeekSplit, b: HomeWeekSplit): number {
  const keys = [
    "sharedHangout",
    "soloRecharge",
    "quietWorkStudy",
    "guestsVisitors",
    "choresShared",
  ] as const;
  let l1 = 0;
  for (const k of keys) {
    l1 += Math.abs(a[k] - b[k]);
  }
  return clamp(100 - l1 / 2, 0, 100);
}

function inversionCountFromDefault(defaultOrder: string[], userOrder: string[]): number {
  const uPos = new Map(userOrder.map((id, i) => [id, i] as const));
  let inv = 0;
  for (let i = 0; i < defaultOrder.length; i++) {
    for (let j = i + 1; j < defaultOrder.length; j++) {
      const a = defaultOrder[i];
      const b = defaultOrder[j];
      const pa = uPos.get(a);
      const pb = uPos.get(b);
      if (pa === undefined || pb === undefined) continue;
      if (pa > pb) inv += 1;
    }
  }
  return inv;
}

function applyEveningOrderToHomeWeek(order: string[], split: HomeWeekSplit): HomeWeekSplit {
  const lastTwo = order.slice(-2);
  let bump = 0;
  if (lastTwo.includes("hangout") || lastTwo.includes("media")) bump += 5;
  if (order[0] === "quiet") bump += 2;
  const adjusted: HomeWeekSplit = {
    ...split,
    sharedHangout: split.sharedHangout + bump,
    soloRecharge: split.soloRecharge - Math.round(bump * 0.35),
  };
  return normalizeHomeWeek(adjusted);
}

function routineFromEveningOrder(order: string[], inferred: number, defaultOrder: string[]): number {
  const inv = inversionCountFromDefault(defaultOrder, order);
  const fromEvening = clamp(4 + inv * 0.55, 1, 10);
  return Math.round((inferred + fromEvening) / 2);
}

function conflictFromScenarios(miniGames: MiniGameAnswers, inferred: number): number {
  let sum = 0;
  for (const s of miniGames.scenarios) {
    const m = SCENARIO_CHOICE_DIRECTNESS[s.id]?.[s.choiceId];
    sum += m ?? 5;
  }
  const avg = sum / Math.max(1, miniGames.scenarios.length);
  const avgAnnoyance =
    miniGames.scenarios.reduce((a, s) => a + s.annoyance, 0) / Math.max(1, miniGames.scenarios.length);
  const adjusted = clamp(avg + (5 - avgAnnoyance) * 0.35, 1, 10);
  return Math.round((inferred + adjusted) / 2);
}

function routineFromMiniGames(miniGames: MiniGameAnswers, answers: OnboardingAnswerMap): number {
  const inferred = inferRoutineFlexibility(answers);
  let r = routineFromEveningOrder(miniGames.eveningOrder, inferred, [...DEFAULT_EVENING_ORDER]);
  const avgAnnoyance =
    miniGames.scenarios.reduce((a, s) => a + s.annoyance, 0) / Math.max(1, miniGames.scenarios.length);
  r = Math.round(clamp(r - (avgAnnoyance - 3) * 0.45, 1, 10));
  return r;
}

/** Defaults for mini-games: week split from questionnaire, default evening order, neutral scenarios. */
export function createDefaultMiniGames(answers: OnboardingAnswerMap): MiniGameAnswers {
  return {
    weekBudget: inferHomeWeekSplit(answers),
    eveningOrder: [...DEFAULT_EVENING_ORDER],
    scenarios: [
      { id: "tp", choiceId: "group_text", annoyance: 3 },
      { id: "mug", choiceId: "cope_first", annoyance: 3 },
      { id: "partner", choiceId: "negotiate", annoyance: 3 },
    ],
  };
}

function gameFitScore(me: UserModel, candidate: CandidateProfile): number {
  const t = candidate.traits;
  const hwB = homeWeekDistanceScore(me.behavior.homeWeekSplit, t.homeWeekSplit);
  const hwP = homeWeekDistanceScore(me.preferences.desiredHomeWeekSplit, t.homeWeekSplit);
  const cdB = proximityScore(me.behavior.conflictDirectness, t.conflictDirectness);
  const cdP = proximityScore(me.preferences.desiredConflictDirectness, t.conflictDirectness);
  const rfB = proximityScore(me.behavior.routineFlexibility, t.routineFlexibility);
  const rfP = proximityScore(me.preferences.desiredRoutineFlexibility, t.routineFlexibility);
  return (hwB + hwP + cdB + cdP + rfB + rfP) / 6;
}

export function buildUserModel(answers: OnboardingAnswerMap, miniGames?: MiniGameAnswers | null): UserModel {
  const core = deriveCoreCompatibilityAnswers(answers);

  let homeWeekSplit = inferHomeWeekSplit(answers);
  let desiredHomeWeekSplit = inferDesiredHomeWeekSplit(answers);
  let conflictDirectness = inferConflictDirectness(answers);
  let routineFlexibility = inferRoutineFlexibility(answers);
  let desiredConflictDirectness = inferDesiredConflictDirectness(answers);
  let desiredRoutineFlexibility = inferDesiredRoutineFlexibility(answers);

  if (
    miniGames &&
    miniGames.weekBudget &&
    miniGames.eveningOrder?.length === DEFAULT_EVENING_ORDER.length &&
    miniGames.scenarios?.length === 3
  ) {
    homeWeekSplit = normalizeHomeWeek(miniGames.weekBudget);
    homeWeekSplit = applyEveningOrderToHomeWeek(miniGames.eveningOrder, homeWeekSplit);
    desiredHomeWeekSplit = desiredFromGameWeek(answers, homeWeekSplit);
    conflictDirectness = conflictFromScenarios(miniGames, inferConflictDirectness(answers));
    desiredConflictDirectness = conflictDirectness;
    routineFlexibility = routineFromMiniGames(miniGames, answers);
    desiredRoutineFlexibility = routineFlexibility;
  }

  return {
    behavior: {
      cleanliness: scaleToTen(core.your_cleanliness),
      socialEnergy: scaleToTen(core.your_social_energy),
      noiseTolerance: scaleToTen(core.your_noise_tolerance),
      sleepSchedule: sleepFromAnswer(core.your_sleep_style),
      petsOk: core.your_pet_comfort >= 3,
      conflictDirectness,
      routineFlexibility,
      homeWeekSplit,
    },
    preferences: {
      desiredCleanliness: scaleToTen(core.roommate_cleanliness),
      desiredSocialEnergy: scaleToTen(core.roommate_social_energy),
      desiredNoiseTolerance: scaleToTen(core.roommate_noise_tolerance),
      preferredSleepSchedule: sleepFromAnswer(core.roommate_sleep_style),
      wantsPetFriendlyRoommate: core.roommate_pet_friendly >= 4,
      desiredConflictDirectness,
      desiredRoutineFlexibility,
      desiredHomeWeekSplit,
    },
  };
}

/** Build a swipe-deck candidate from stored questionnaire data (same scoring as mock profiles). */
export function buildCandidateProfileFromQuestionnaire(
  id: string,
  name: string,
  age: number,
  city: string,
  bio: string,
  photoUrl: string | undefined,
  hobbies: string[],
  answers: OnboardingAnswerMap,
  miniGames: MiniGameAnswers | null | undefined
): CandidateProfile {
  const model = buildUserModel(answers, miniGames ?? createDefaultMiniGames(answers));
  const b = model.behavior;
  return {
    id,
    name,
    age,
    city,
    bio: bio || "",
    photoUrl,
    hobbies,
    traits: {
      cleanliness: b.cleanliness,
      socialEnergy: b.socialEnergy,
      noiseTolerance: b.noiseTolerance,
      sleepSchedule: b.sleepSchedule,
      petsOk: b.petsOk,
      conflictDirectness: b.conflictDirectness,
      routineFlexibility: b.routineFlexibility,
      homeWeekSplit: b.homeWeekSplit,
    },
  };
}

export function compatibilityScore(me: UserModel, candidate: CandidateProfile): CompatibilityResult {
  const behaviorFit =
    (proximityScore(me.behavior.cleanliness, candidate.traits.cleanliness) +
      proximityScore(me.behavior.socialEnergy, candidate.traits.socialEnergy) +
      proximityScore(me.behavior.noiseTolerance, candidate.traits.noiseTolerance)) /
    3;

  const preferenceFit =
    (proximityScore(me.preferences.desiredCleanliness, candidate.traits.cleanliness) +
      proximityScore(me.preferences.desiredSocialEnergy, candidate.traits.socialEnergy) +
      proximityScore(
        me.preferences.desiredNoiseTolerance,
        candidate.traits.noiseTolerance
      )) /
    3;

  let lifestyleFit = 70;
  if (me.preferences.preferredSleepSchedule === candidate.traits.sleepSchedule) {
    lifestyleFit += 20;
  } else {
    lifestyleFit -= 15;
  }

  if (me.preferences.wantsPetFriendlyRoommate && candidate.traits.petsOk) {
    lifestyleFit += 10;
  } else if (me.preferences.wantsPetFriendlyRoommate && !candidate.traits.petsOk) {
    lifestyleFit -= 20;
  }

  if (me.behavior.petsOk === candidate.traits.petsOk) {
    lifestyleFit += 5;
  }

  lifestyleFit = clamp(lifestyleFit, 0, 100);

  const gameFit = gameFitScore(me, candidate);

  const totalScore = clamp(
    behaviorFit * 0.27 + preferenceFit * 0.32 + lifestyleFit * 0.13 + gameFit * 0.28,
    0,
    99
  );

  return {
    totalScore: Math.round(totalScore),
    breakdown: {
      behaviorFit: Math.round(behaviorFit),
      preferenceFit: Math.round(preferenceFit),
      lifestyleFit: Math.round(lifestyleFit),
      gameFit: Math.round(gameFit),
    },
  };
}
