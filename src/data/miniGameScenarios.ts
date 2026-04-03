/** Evening timeline cards (order only; ids stable for storage). */
export const EVENING_CARD_IDS = ["cook", "quiet", "hangout", "media", "calls"] as const;

export const EVENING_CARD_LABELS: Record<string, string> = {
  cook: "Cook / eat",
  quiet: "Quiet solo time",
  hangout: "Hang with roommates",
  media: "TV, games, or music",
  calls: "Calls or deep focus",
};

export const DEFAULT_EVENING_ORDER = [...EVENING_CARD_IDS];

/** Vignette choice → directness contribution (1–10). */
export const SCENARIO_CHOICE_DIRECTNESS: Record<string, Record<string, number>> = {
  tp: {
    group_text: 7,
    buy_next: 9,
    wait: 3,
  },
  mug: {
    ask_quiet: 9,
    cope_first: 6,
    let_it_go: 3,
  },
  partner: {
    negotiate: 9,
    ok_sometimes: 5,
    not_ok: 7,
  },
};

export const SCENARIO_PROMPTS: {
  id: "tp" | "mug" | "partner";
  title: string;
  body: string;
  choices: { id: string; label: string }[];
}[] = [
  {
    id: "tp",
    title: "Shared supplies run out",
    body: "Toilet paper in the shared bathroom is gone. What do you usually do?",
    choices: [
      { id: "group_text", label: "Group text / Slack so someone grabs some" },
      { id: "buy_next", label: "Buy the next pack and mention it later" },
      { id: "wait", label: "Wait and see if someone else handles it" },
    ],
  },
  {
    id: "mug",
    title: "Noise when you need rest",
    body: "It’s a weeknight and you need sleep for an early morning. Common areas are still pretty loud. What do you do?",
    choices: [
      { id: "ask_quiet", label: "Ask for a quieter evening or a cutoff time" },
      { id: "cope_first", label: "Try earplugs or white noise first, then speak up if it continues" },
      { id: "let_it_go", label: "Leave it alone this time" },
    ],
  },
  {
    id: "partner",
    title: "Guests",
    body: "A roommate’s partner stays over 4 nights this week—more than you expected. You…",
    choices: [
      { id: "negotiate", label: "Talk soon about expectations and notice" },
      { id: "ok_sometimes", label: "Roll with it this time, revisit if it repeats" },
      { id: "not_ok", label: "Say it’s not okay for this week" },
    ],
  },
];
