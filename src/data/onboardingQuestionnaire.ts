import { OnboardingAnswerMap, OnboardingQuestion } from "../types/onboarding";

export const onboardingQuestionnaire: OnboardingQuestion[] = [
  {
    id: "profile_city_area",
    category: "Profile",
    prompt: "What city/area do you want to live in?",
    kind: "choice_with_other",
    options: [
      { id: "denver", label: "Denver" },
      { id: "boulder", label: "Boulder" },
      { id: "colorado_springs", label: "Colorado Springs" },
      { id: "fort_collins", label: "Fort Collins" },
      { id: "other", label: "Other" },
    ],
    otherOptionId: "other",
    otherPlaceholder: "Type the city/area…",
  },
  {
    id: "profile_budget_monthly",
    category: "Profile",
    prompt: "What is your monthly housing budget?",
    kind: "numeric_range",
    minPlaceholder: "Min (e.g. 1200)",
    maxPlaceholder: "Max (e.g. 2200)",
  },
  {
    id: "profile_move_in_date",
    category: "Profile",
    prompt: "Desired move-in date?",
    kind: "date_range",
  },

  {
    id: "schedule_sleep_weekdays",
    category: "Schedule",
    prompt: "What time do you usually go to sleep on weekdays?",
    kind: "time_range",
  },
  {
    id: "schedule_wake_weekdays",
    category: "Schedule",
    prompt: "What time do you usually wake up on weekdays?",
    kind: "time_range",
  },
  {
    id: "schedule_home_evenings",
    category: "Schedule",
    prompt: "How often are you home during evenings?",
    kind: "scale_1_5",
    minLabel: "Rarely",
    maxLabel: "Almost always",
  },
  {
    id: "schedule_wfh",
    category: "Schedule",
    prompt: "Do you work/study from home?",
    kind: "single_select",
    options: [
      { id: "never", label: "Never" },
      { id: "sometimes", label: "Sometimes" },
      { id: "often", label: "Often" },
      { id: "full_time", label: "Full-time" },
    ],
  },

  {
    id: "clean_shared_spaces",
    category: "Cleanliness",
    prompt: "How clean do you keep shared spaces?",
    kind: "scale_1_5",
    minLabel: "Relaxed",
    maxLabel: "Very clean",
  },
  {
    id: "clean_dishes_timing",
    category: "Cleanliness",
    prompt: "How quickly should dishes be washed after use?",
    kind: "single_select",
    options: [
      { id: "immediately", label: "Immediately" },
      { id: "same_day", label: "Same day" },
      { id: "within_24h", label: "Within 24h" },
      { id: "flexible", label: "Flexible" },
    ],
  },
  {
    id: "clean_shared_areas_frequency",
    category: "Cleanliness",
    prompt: "How often should shared areas be cleaned?",
    kind: "single_select",
    options: [
      { id: "daily", label: "Daily" },
      { id: "few_times_weekly", label: "Few times weekly" },
      { id: "weekly", label: "Weekly" },
      { id: "as_needed", label: "As needed" },
    ],
  },

  {
    id: "noise_day_ok",
    category: "Noise",
    prompt: "What noise level is okay during the day?",
    kind: "scale_1_5",
    minLabel: "Very quiet",
    maxLabel: "Lively is fine",
  },
  {
    id: "noise_night_ok",
    category: "Noise",
    prompt: "What noise level is okay at night?",
    kind: "scale_1_5",
    minLabel: "Very quiet",
    maxLabel: "Some noise is fine",
  },
  {
    id: "noise_need_quiet",
    category: "Noise",
    prompt: "Do you need quiet for sleep/study?",
    kind: "scale_1_5",
    minLabel: "Not really",
    maxLabel: "Absolutely",
  },

  {
    id: "guests_friends_over",
    category: "Guests",
    prompt: "How often do you like having friends over?",
    kind: "single_select",
    options: [
      { id: "never", label: "Never" },
      { id: "monthly", label: "Monthly" },
      { id: "weekly", label: "Weekly" },
      { id: "several_weekly", label: "Several times weekly" },
    ],
  },
  {
    id: "guests_overnight_ok",
    category: "Guests",
    prompt: "Are overnight guests okay?",
    kind: "single_select",
    options: [
      { id: "never", label: "Never" },
      { id: "rarely", label: "Rarely" },
      { id: "sometimes", label: "Sometimes" },
      { id: "often", label: "Often" },
    ],
  },
  {
    id: "guests_notice",
    category: "Guests",
    prompt: "How much notice should be given before guests come over?",
    kind: "single_select",
    options: [
      { id: "none", label: "None" },
      { id: "few_hours", label: "Few hours" },
      { id: "one_day", label: "1 day" },
      { id: "more_than_one_day", label: "More than 1 day" },
    ],
  },

  {
    id: "boundaries_alone_time",
    category: "Boundaries",
    prompt: "How much alone/private time do you need at home?",
    kind: "scale_1_5",
    minLabel: "Low",
    maxLabel: "A lot",
  },
  {
    id: "boundaries_share_items",
    category: "Boundaries",
    prompt: "Are you comfortable sharing food/household items?",
    kind: "scale_1_5",
    minLabel: "Not at all",
    maxLabel: "Totally fine",
  },
  {
    id: "boundaries_enter_rooms",
    category: "Boundaries",
    prompt: "Are you comfortable entering each other’s room?",
    kind: "single_select",
    options: [
      { id: "never", label: "Never" },
      { id: "permission_only", label: "Only with permission" },
      { id: "usually_ok", label: "Usually okay" },
    ],
  },

  {
    id: "lifestyle_smoke_vape",
    category: "Lifestyle",
    prompt: "Do you smoke or vape?",
    kind: "single_select",
    options: [
      { id: "no", label: "No" },
      { id: "outside_only", label: "Outside only" },
      { id: "yes", label: "Yes" },
    ],
  },
  {
    id: "lifestyle_ok_with_smoker",
    category: "Lifestyle",
    prompt: "Are you okay living with someone who smokes or vapes?",
    kind: "single_select",
    options: [
      { id: "no", label: "No" },
      { id: "outside_only", label: "Outside only" },
      { id: "yes", label: "Yes" },
    ],
  },
  {
    id: "lifestyle_drink_at_home",
    category: "Lifestyle",
    prompt: "Do you drink alcohol at home?",
    kind: "single_select",
    options: [
      { id: "never", label: "Never" },
      { id: "rarely", label: "Rarely" },
      { id: "sometimes", label: "Sometimes" },
      { id: "often", label: "Often" },
    ],
  },
  {
    id: "lifestyle_pets_ok",
    category: "Lifestyle",
    prompt: "Are pets okay?",
    kind: "single_select",
    options: [
      { id: "no", label: "No" },
      { id: "cats_only", label: "Cats only" },
      { id: "dogs_only", label: "Dogs only" },
      { id: "most_pets", label: "Most pets" },
    ],
  },

  {
    id: "env_temperature",
    category: "Environment",
    prompt: "What room temperature do you prefer?",
    kind: "single_select",
    options: [
      { id: "cool", label: "Cool" },
      { id: "neutral", label: "Neutral" },
      { id: "warm", label: "Warm" },
    ],
  },
  {
    id: "env_late_night_media",
    category: "Environment",
    prompt: "How do you feel about lights/TV/music late at night?",
    kind: "scale_1_5",
    minLabel: "Not okay",
    maxLabel: "Totally fine",
  },

  {
    id: "money_rent_split",
    category: "Money",
    prompt: "How should rent be split?",
    kind: "single_select",
    options: [
      { id: "even", label: "Even" },
      { id: "by_room_size", label: "By room size" },
      { id: "other", label: "Other" },
    ],
  },
  {
    id: "money_utilities_handling",
    category: "Money",
    prompt: "How should utilities/common supplies be handled?",
    kind: "single_select",
    options: [
      { id: "split_evenly", label: "Split evenly" },
      { id: "track_individually", label: "Track individually" },
      { id: "rotating", label: "Rotating" },
    ],
  },
  {
    id: "money_paying_on_time",
    category: "Money",
    prompt: "How important is paying bills early/on time?",
    kind: "scale_1_5",
    minLabel: "Not important",
    maxLabel: "Very important",
  },

  {
    id: "chores_structure",
    category: "Chores",
    prompt: "Do you prefer a chore schedule or flexible cleanup?",
    kind: "single_select",
    options: [
      { id: "structured", label: "Structured" },
      { id: "some_structure", label: "Some structure" },
      { id: "flexible", label: "Flexible" },
    ],
  },
  {
    id: "chores_duties_handling",
    category: "Chores",
    prompt: "How should trash, bathroom, and kitchen duties be handled?",
    kind: "single_select",
    options: [
      { id: "rotating", label: "Rotating" },
      { id: "assigned", label: "Assigned" },
      { id: "informal", label: "Informal" },
    ],
  },

  {
    id: "comm_if_bothered",
    category: "Communication",
    prompt: "If something bothers you, what do you usually do?",
    kind: "single_select",
    options: [
      { id: "talk_immediately", label: "Talk immediately" },
      { id: "wait_then_talk", label: "Wait then talk" },
      { id: "hint", label: "Hint" },
      { id: "avoid", label: "Avoid" },
    ],
  },
  {
    id: "comm_directness",
    category: "Communication",
    prompt: "How direct are you when discussing conflict?",
    kind: "scale_1_5",
    minLabel: "Indirect",
    maxLabel: "Very direct",
  },
  {
    id: "comm_discussion_mode",
    category: "Communication",
    prompt: "How do you prefer roommate issues to be discussed?",
    kind: "single_select",
    options: [
      { id: "in_person", label: "In person" },
      { id: "text_first", label: "Text first" },
      { id: "scheduled_checkin", label: "Scheduled check-in" },
    ],
  },
  {
    id: "comm_checkin_frequency",
    category: "Communication",
    prompt: "How often would you want a roommate check-in?",
    kind: "single_select",
    options: [
      { id: "never", label: "Never" },
      { id: "as_needed", label: "As needed" },
      { id: "monthly", label: "Monthly" },
      { id: "weekly", label: "Weekly" },
    ],
  },

  {
    id: "social_close_friend_level",
    category: "Social fit",
    prompt:
      "Do you want to be close friends with a roommate or just respectful housemates?",
    kind: "single_select",
    options: [
      { id: "best_friends", label: "Best friends" },
      { id: "friendly", label: "Friendly" },
      { id: "neutral", label: "Neutral" },
      { id: "separate_lives", label: "Separate lives" },
    ],
  },
  {
    id: "social_do_things_together",
    category: "Social fit",
    prompt: "How often do you want to do things together?",
    kind: "single_select",
    options: [
      { id: "never", label: "Never" },
      { id: "sometimes", label: "Sometimes" },
      { id: "often", label: "Often" },
    ],
  },

  {
    id: "values_non_negotiables_top3",
    category: "Values",
    prompt: "What are your top 3 non-negotiables in shared living?",
    kind: "rank_top_n",
    n: 3,
    options: [
      { id: "cleanliness", label: "Cleanliness" },
      { id: "quiet_hours", label: "Quiet hours" },
      { id: "respect_privacy", label: "Respecting privacy" },
      { id: "pay_on_time", label: "Paying bills on time" },
      { id: "guest_limits", label: "Guest limits" },
      { id: "communication", label: "Clear communication" },
      { id: "no_smoking", label: "No smoking indoors" },
      { id: "pets_ok", label: "Pets are OK" },
    ],
  },
  {
    id: "values_nice_to_have_top3",
    category: "Values",
    prompt: "What are your top 3 “nice to have” qualities in a roommate?",
    kind: "rank_top_n",
    n: 3,
    options: [
      { id: "similar_schedule", label: "Similar schedule" },
      { id: "similar_interests", label: "Similar interests" },
      { id: "social", label: "Social/friendly" },
      { id: "independent", label: "Independent" },
      { id: "organized", label: "Organized" },
      { id: "quiet", label: "Quiet" },
      { id: "cooks", label: "Likes cooking" },
      { id: "active", label: "Active" },
    ],
  },

  {
    id: "risk_flags_move_out_causes",
    category: "Risk flags",
    prompt: "What would most likely cause you to move out?",
    kind: "multi_select",
    options: [
      { id: "late_rent", label: "Late rent/bills" },
      { id: "messy_common_areas", label: "Messy shared spaces" },
      { id: "too_noisy", label: "Too noisy" },
      { id: "too_many_guests", label: "Too many guests" },
      { id: "dish_conflict", label: "Dish/kitchen conflicts" },
      { id: "privacy_issues", label: "Privacy issues" },
      { id: "smoking", label: "Smoking/vaping conflicts" },
      { id: "poor_communication", label: "Poor communication" },
    ],
  },

  {
    id: "open_ideal_living",
    category: "Open-ended",
    prompt: "Describe your ideal living situation in 2–3 sentences.",
    kind: "short_text",
    placeholder: "A short description…",
    maxLength: 280,
  },
  {
    id: "open_worst_issue",
    category: "Open-ended",
    prompt: "Describe your worst past roommate issue, if any.",
    kind: "short_text",
    placeholder: "Optional—keep it short…",
    maxLength: 280,
  },
];

export const defaultOnboardingQuestionnaireAnswers: OnboardingAnswerMap = Object.fromEntries(
  onboardingQuestionnaire.map((q) => {
    switch (q.kind) {
      case "scale_1_5":
        return [q.id, 3];
      case "single_select":
        return [q.id, q.options[0]?.id ?? null];
      case "multi_select":
        return [q.id, []];
      case "rank_top_n":
        return [q.id, { rankedIds: [] }];
      case "short_text":
        return [q.id, ""];
      case "numeric_range":
        return [q.id, { min: null, max: null }];
      case "date_range":
        return [q.id, { start: null, end: null }];
      case "time_range":
        return [q.id, { start: "22:00", end: "23:30" }];
      case "choice_with_other":
        return [
          q.id,
          {
            choice: q.options[0]?.id ?? "",
            otherText: "",
          },
        ];
      default: {
        const _exhaustive: never = q;
        return [_exhaustive, null];
      }
    }
  })
) as OnboardingAnswerMap;

