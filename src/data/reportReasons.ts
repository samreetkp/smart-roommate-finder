export const REPORT_REASON_OPTIONS = [
  { id: "harassment", label: "Harassment or threats" },
  { id: "fake_profile", label: "Fake or misleading profile" },
  { id: "scam", label: "Scam or fraud" },
  { id: "inappropriate_content", label: "Inappropriate content" },
  { id: "spam", label: "Spam" },
  { id: "other", label: "Other" },
] as const;

export type ReportReasonId = (typeof REPORT_REASON_OPTIONS)[number]["id"];
