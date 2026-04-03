import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCandidateProfileFromQuestionnaire } from "./compatibility";
import type { OnboardingAnswerMap } from "../types/onboarding";
import type { MiniGameAnswers } from "../types/miniGames";
import type { CandidateProfile } from "../types/matching";

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  age: number | null;
  bio: string | null;
  city: string | null;
  onboarding_answers: unknown;
  mini_games: unknown;
};

/**
 * Loads other visible users who have saved a questionnaire, for the swipe deck.
 */
export async function fetchDiscoverCandidates(
  supabase: SupabaseClient,
  currentUserId: string
): Promise<CandidateProfile[]> {
  const { data: rows, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, age, bio, city, onboarding_answers, mini_games")
    .eq("is_visible", true)
    .neq("user_id", currentUserId)
    .not("onboarding_answers", "is", null);

  if (error || !rows?.length) {
    return [];
  }

  const typed = rows as ProfileRow[];
  const ids = typed.map((r) => r.user_id);

  const { data: photoRows } = await supabase
    .from("profile_photos")
    .select("user_id, url, is_primary")
    .in("user_id", ids)
    .order("is_primary", { ascending: false });

  const photoByUser = new Map<string, string>();
  for (const p of photoRows ?? []) {
    if (!photoByUser.has(p.user_id)) {
      photoByUser.set(p.user_id, p.url);
    }
  }

  const out: CandidateProfile[] = [];

  for (const row of typed) {
    const raw = row.onboarding_answers;
    if (!raw || typeof raw !== "object") continue;
    const answers = raw as OnboardingAnswerMap;
    const mg =
      row.mini_games && typeof row.mini_games === "object"
        ? (row.mini_games as MiniGameAnswers)
        : null;

    try {
      const age = typeof row.age === "number" && row.age >= 18 && row.age <= 120 ? row.age : 25;
      const cp = buildCandidateProfileFromQuestionnaire(
        row.user_id,
        (row.display_name ?? "Member").trim() || "Member",
        age,
        (row.city ?? "").trim(),
        (row.bio ?? "").trim(),
        photoByUser.get(row.user_id),
        [],
        answers,
        mg
      );
      out.push(cp);
    } catch {
      continue;
    }
  }

  return out;
}
