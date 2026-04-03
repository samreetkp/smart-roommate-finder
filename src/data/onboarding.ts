import { OnboardingAnswerMap, OnboardingQuestion } from "../types/matching";

export const defaultOnboardingAnswers: OnboardingAnswerMap = {
  your_cleanliness: 3,
  your_social_energy: 3,
  your_noise_tolerance: 3,
  your_sleep_style: 3,
  your_pet_comfort: 3,
  roommate_cleanliness: 3,
  roommate_social_energy: 3,
  roommate_noise_tolerance: 3,
  roommate_sleep_style: 3,
  roommate_pet_friendly: 3,
};

export const onboardingQuestions: OnboardingQuestion[] = [
  {
    id: "your_cleanliness",
    section: "about_you",
    prompt: "How clean and organized are you at home?",
    minLabel: "Messy",
    maxLabel: "Very tidy",
  },
  {
    id: "your_social_energy",
    section: "about_you",
    prompt: "How social are you in your shared living space?",
    minLabel: "Keep to myself",
    maxLabel: "Very social",
  },
  {
    id: "your_noise_tolerance",
    section: "about_you",
    prompt: "How much noise can you tolerate at home?",
    minLabel: "Need quiet",
    maxLabel: "Noise is fine",
  },
  {
    id: "your_sleep_style",
    section: "about_you",
    prompt: "What is your sleep timing style?",
    minLabel: "Early bird",
    maxLabel: "Night owl",
  },
  {
    id: "your_pet_comfort",
    section: "about_you",
    prompt: "How comfortable are you living with pets?",
    minLabel: "Prefer no pets",
    maxLabel: "Love pets",
  },
  {
    id: "roommate_cleanliness",
    section: "looking_for",
    prompt: "How clean do you want your roommate to be?",
    minLabel: "Somewhat relaxed",
    maxLabel: "Very tidy",
  },
  {
    id: "roommate_social_energy",
    section: "looking_for",
    prompt: "How social should your ideal roommate be?",
    minLabel: "Independent",
    maxLabel: "Very social",
  },
  {
    id: "roommate_noise_tolerance",
    section: "looking_for",
    prompt: "What noise style should your roommate be okay with?",
    minLabel: "Quiet home",
    maxLabel: "Lively home",
  },
  {
    id: "roommate_sleep_style",
    section: "looking_for",
    prompt: "What sleep schedule do you prefer in a roommate?",
    minLabel: "Early bird",
    maxLabel: "Night owl",
  },
  {
    id: "roommate_pet_friendly",
    section: "looking_for",
    prompt: "How important is it that your roommate is pet-friendly?",
    minLabel: "Not important",
    maxLabel: "Very important",
  },
];
