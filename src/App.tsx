import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import {
  defaultOnboardingQuestionnaireAnswers,
  onboardingQuestionnaire,
} from "./data/onboardingQuestionnaire";
import { mockCandidates } from "./data/mockCandidates";
import { mockApartments } from "./data/mockApartments";
import { REPORT_REASON_OPTIONS, type ReportReasonId } from "./data/reportReasons";

const ONBOARDING_QUESTIONNAIRE_LEN = onboardingQuestionnaire.length;
const ONBOARDING_MINI_STEPS = 3;
const ONBOARDING_TOTAL_STEPS = ONBOARDING_QUESTIONNAIRE_LEN + ONBOARDING_MINI_STEPS;

const MINI_GAME_SUBCATEGORIES = ["Week at home", "Evening order", "Quick scenarios"] as const;
import { fetchRentCastApartmentsNear } from "./lib/rentcast";
import { OnboardingMiniGames } from "./components/OnboardingMiniGames";
import { UtilitiesPanel } from "./components/UtilitiesPanel";
import {
  buildUserModel,
  compatibilityScore,
  createDefaultMiniGames,
} from "./lib/compatibility";
import { fetchDiscoverCandidates } from "./lib/discoverCandidates";
import {
  calculateAgeFromBirthdate,
  maxBirthdateForMinAge,
  minBirthdateForMaxAge,
} from "./lib/age";
import { parseOnboardingPayload, serializeOnboardingPayload } from "./lib/onboardingStorage";
import type { ApartmentSearchResult } from "./types/apartmentSearch";
import type { MiniGameAnswers } from "./types/miniGames";
import type {
  ChoiceWithOtherAnswer,
  DateRangeAnswer,
  NumericRangeAnswer,
  OnboardingAnswerMap,
  OnboardingAnswerValue,
  OnboardingQuestion,
  RankedMultiSelectAnswer,
  Scale1to5Answer,
  TimeRangeAnswer,
} from "./types/onboarding";
import type { CandidateProfile, CompatibilityResult } from "./types/matching";

type ScoredCandidateProfile = CandidateProfile & { compatibility: CompatibilityResult };

const DECK_PROFILE_WEEK_KEYS = [
  "sharedHangout",
  "soloRecharge",
  "quietWorkStudy",
  "guestsVisitors",
  "choresShared",
] as const;

const DECK_PROFILE_WEEK_LABELS: Record<(typeof DECK_PROFILE_WEEK_KEYS)[number], string> = {
  sharedHangout: "Shared meals / hangouts",
  soloRecharge: "Solo recharge",
  quietWorkStudy: "Quiet work or study",
  guestsVisitors: "Guests & visitors",
  choresShared: "Chores & errands together",
};

type Swipe = {
  candidateId: string;
  decision: "like" | "pass";
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type NominatimPlace = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  class?: string;
  type?: string;
  extratags?: Record<string, string>;
};

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function onboardingStorageKey(sessionEmail: string) {
  return `roomai_onboarding_${sessionEmail}`;
}

function photoPromptStorageKey(sessionEmail: string) {
  return `roomai_photo_prompt_${sessionEmail}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseScale1to5(value: unknown, fallback: Scale1to5Answer): Scale1to5Answer {
  if (typeof value !== "number") return fallback;
  const rounded = Math.round(value);
  return clamp(rounded, 1, 5) as Scale1to5Answer;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown; error_description?: unknown; details?: unknown };
    if (typeof maybe.message === "string" && maybe.message.trim()) return maybe.message;
    if (typeof maybe.error_description === "string" && maybe.error_description.trim()) {
      return maybe.error_description;
    }
    if (typeof maybe.details === "string" && maybe.details.trim()) return maybe.details;
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
  if (typeof error === "string" && error.trim()) return error;
  return "Unknown error";
}

function firstNameOnly(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name;
}

export default function App() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [signUpBirthdate, setSignUpBirthdate] = useState("");
  const [signUpVisibleToOthers, setSignUpVisibleToOthers] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [forgotPasswordSending, setForgotPasswordSending] = useState(false);
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [recoveryPasswordSaving, setRecoveryPasswordSaving] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswerMap>(
    defaultOnboardingQuestionnaireAnswers
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  /** Unified onboarding step: 0..QUESTIONNAIRE_LEN-1 = questionnaire, then mini-games (e.g. last 3 of 44). */
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0);
  const [miniGameAnswers, setMiniGameAnswers] = useState<MiniGameAnswers | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingEditorOpen, setOnboardingEditorOpen] = useState(false);
  const [profilePageOpen, setProfilePageOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  /** Shown under your photo / avatar initials — only `public.users.first_name`, never email. */
  const [userFirstName, setUserFirstName] = useState("");
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profileBirthdate, setProfileBirthdate] = useState("");
  const [profileVisibleToOthers, setProfileVisibleToOthers] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoExpanded, setProfilePhotoExpanded] = useState(false);
  const [photoPromptComplete, setPhotoPromptComplete] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [messagesPageOpen, setMessagesPageOpen] = useState(false);
  const [searchPageOpen, setSearchPageOpen] = useState(false);
  const [apartmentsPageOpen, setApartmentsPageOpen] = useState(false);
  const [aiChatPageOpen, setAiChatPageOpen] = useState(false);
  const [utilitiesPageOpen, setUtilitiesPageOpen] = useState(false);
  const [conversations, setConversations] = useState<
    {
      id: string;
      match_id: string;
      created_at: string;
      other_user_id: string | null;
      other_display_name: string | null;
      other_photo_url: string | null;
    }[]
  >([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    { id: string; conversation_id: string; sender_user_id: string; body: string; sent_at: string }[]
  >([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    {
      user_id: string;
      display_name: string | null;
      username: string | null;
      city: string | null;
      bio: string | null;
    }[]
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [apartmentSearchText, setApartmentSearchText] = useState("");
  const [apartmentsLoading, setApartmentsLoading] = useState(false);
  const [apartmentResults, setApartmentResults] = useState<ApartmentSearchResult[]>([]);
  const [userCoordinates, setUserCoordinates] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "resolving" | "ready" | "denied" | "unsupported" | "error"
  >("idle");
  const [searchedLocationLabel, setSearchedLocationLabel] = useState("near your area");
  const [aiChatMessages, setAiChatMessages] = useState<
    { id: string; from: "user" | "ai"; body: string; at: string }[]
  >([]);
  const [aiChatDraft, setAiChatDraft] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsContainerRef = useRef<HTMLDivElement | null>(null);
  const notificationsButtonRef = useRef<HTMLButtonElement | null>(null);
  const [notificationsPopoverPos, setNotificationsPopoverPos] = useState({ top: 0, left: 0 });
  const [swipes, setSwipes] = useState<Swipe[]>([]);
  const [discoverCandidates, setDiscoverCandidates] = useState<CandidateProfile[]>([]);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [removeLikeTarget, setRemoveLikeTarget] = useState<{ id: string; name: string } | null>(null);
  const [reportReason, setReportReason] = useState<ReportReasonId>("other");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [deckProfileCandidate, setDeckProfileCandidate] = useState<ScoredCandidateProfile | null>(
    null
  );
  const [deckMode, setDeckMode] = useState<"compatibility" | "location" | "random">("compatibility");
  const [theme, setTheme] = useState<"sunny" | "night">(() => {
    const savedTheme = localStorage.getItem("roomai_theme");
    return savedTheme === "night" ? "night" : "sunny";
  });

  const profileCityAreaFingerprint = useMemo(
    () => JSON.stringify(onboardingAnswers["profile_city_area"]),
    [onboardingAnswers]
  );

  function restoreOnboardingState(email: string | null) {
    if (!email) {
      setOnboardingAnswers(defaultOnboardingQuestionnaireAnswers);
      setOnboardingComplete(false);
      setQuestionIndex(0);
      setSwipes([]);
      setOnboardingStepIndex(0);
      setMiniGameAnswers(null);
      return;
    }

    const raw = localStorage.getItem(onboardingStorageKey(email));
    if (!raw) {
      setOnboardingAnswers(defaultOnboardingQuestionnaireAnswers);
      setOnboardingComplete(false);
      setQuestionIndex(0);
      setSwipes([]);
      setOnboardingStepIndex(0);
      setMiniGameAnswers(null);
      return;
    }

    const parsed = parseOnboardingPayload(raw);
    if (!parsed) {
      setOnboardingAnswers(defaultOnboardingQuestionnaireAnswers);
      setOnboardingComplete(false);
      setQuestionIndex(0);
      setSwipes([]);
      setOnboardingStepIndex(0);
      setMiniGameAnswers(null);
      return;
    }

    setOnboardingAnswers(parsed.answers);
    setMiniGameAnswers(parsed.miniGames ?? null);
    setOnboardingComplete(true);
    setQuestionIndex(0);
    setSwipes([]);
  }

  function restorePhotoPromptState(email: string | null) {
    if (!email) {
      setPhotoPromptComplete(false);
      setProfilePhotoUrl(null);
      return;
    }
    const raw = localStorage.getItem(photoPromptStorageKey(email));
    setPhotoPromptComplete(raw === "done");
  }

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email ?? null;
      setSessionEmail(email);
      restoreOnboardingState(email);
      restorePhotoPromptState(email);
    }

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecoveryMode(true);
        }
        const email = session?.user.email ?? null;
        setSessionEmail(email);
        restoreOnboardingState(email);
        restorePhotoPromptState(email);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setPasswordRecoveryMode(true);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSplashVisible(false), 2000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!sessionEmail) return;
    loadProfileDisplayName();
    loadProfilePhotoAndGate();
  }, [sessionEmail]);

  useEffect(() => {
    if (!notificationsOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (!notificationsContainerRef.current) return;
      const targetNode = event.target as Node;
      if (!notificationsContainerRef.current.contains(targetNode)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;

    function updateNotificationsPopoverPosition() {
      const button = notificationsButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      setNotificationsPopoverPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 10,
      });
    }

    updateNotificationsPopoverPosition();
    window.addEventListener("resize", updateNotificationsPopoverPosition);
    window.addEventListener("scroll", updateNotificationsPopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updateNotificationsPopoverPosition);
      window.removeEventListener("scroll", updateNotificationsPopoverPosition, true);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!profilePageOpen) setProfilePhotoExpanded(false);
  }, [profilePageOpen]);

  useEffect(() => {
    if (!profilePhotoExpanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setProfilePhotoExpanded(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [profilePhotoExpanded]);

  useEffect(() => {
    if (!reportTarget && !deckProfileCandidate && !removeLikeTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (removeLikeTarget) {
        setRemoveLikeTarget(null);
        return;
      }
      if (reportTarget) {
        if (reportSending) return;
        setReportTarget(null);
        return;
      }
      setDeckProfileCandidate(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [reportTarget, reportSending, deckProfileCandidate, removeLikeTarget]);

  useEffect(() => {
    if (!sessionEmail) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
    })();
  }, [sessionEmail]);

  useEffect(() => {
    if (!sessionEmail || !currentUserId || !onboardingComplete) {
      setDiscoverCandidates([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const list = await fetchDiscoverCandidates(supabase, currentUserId);
      if (!cancelled) setDiscoverCandidates(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionEmail, onboardingComplete, currentUserId]);

  useEffect(() => {
    if (!sessionEmail) return;
    if (!messagesPageOpen) return;

    async function loadConvos() {
      setMessagesLoading(true);
      try {
        const { data: convoRows, error: convoError } = await supabase
          .from("conversations")
          .select("id, match_id, created_at")
          .order("created_at", { ascending: false });

        if (convoError || !convoRows || convoRows.length === 0) {
          setConversations([]);
          setSelectedConversationId(null);
          return;
        }

        const matchIds = Array.from(new Set(convoRows.map((c: any) => c.match_id)));

        const { data: matchRows, error: matchError } = await supabase
          .from("matches")
          .select("id, user_1_id, user_2_id")
          .in("id", matchIds);

        if (matchError || !matchRows) {
          setConversations(
            convoRows.map((c: any) => ({
              id: c.id as string,
              match_id: c.match_id as string,
              created_at: c.created_at as string,
              other_user_id: null,
              other_display_name: null,
              other_photo_url: null,
            }))
          );
          setSelectedConversationId((prev) => prev ?? (convoRows[0]?.id as string));
          return;
        }

        const matchById = new Map<string, { user_1_id: string; user_2_id: string }>();
        for (const m of matchRows as any[]) {
          matchById.set(m.id as string, {
            user_1_id: m.user_1_id as string,
            user_2_id: m.user_2_id as string,
          });
        }

        const otherUserIds = new Set<string>();
        const convoToOtherUser = new Map<string, string | null>();

        for (const c of convoRows as any[]) {
          const match = matchById.get(c.match_id as string);
          if (!match) {
            convoToOtherUser.set(c.id as string, null);
            continue;
          }
          const isUser1 = match.user_1_id === currentUserId;
          const isUser2 = match.user_2_id === currentUserId;
          const otherId = isUser1 ? match.user_2_id : isUser2 ? match.user_1_id : null;
          if (otherId) {
            convoToOtherUser.set(c.id as string, otherId);
            otherUserIds.add(otherId);
          } else {
            convoToOtherUser.set(c.id as string, null);
          }
        }

        let profileByUserId = new Map<string, { display_name: string | null }>();
        let photoByUserId = new Map<string, string | null>();

        if (otherUserIds.size > 0) {
          const otherIdsArray = Array.from(otherUserIds);

          const { data: profileRows } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", otherIdsArray);

          if (profileRows) {
            profileByUserId = new Map(
              (profileRows as any[]).map((p) => [
                p.user_id as string,
                { display_name: (p.display_name as string | null) ?? null },
              ])
            );
          }

          const { data: photoRows } = await supabase
            .from("profile_photos")
            .select("user_id, url, is_primary, created_at")
            .in("user_id", otherIdsArray)
            .order("is_primary", { ascending: false })
            .order("created_at", { ascending: false });

          if (photoRows) {
            for (const row of photoRows as any[]) {
              const uid = row.user_id as string;
              if (!photoByUserId.has(uid)) {
                photoByUserId.set(uid, (row.url as string) ?? null);
              }
            }
          }
        }

        const enriched = (convoRows as any[]).map((c) => {
          const otherId = convoToOtherUser.get(c.id as string) ?? null;
          const profile = otherId ? profileByUserId.get(otherId) ?? null : null;
          const photoUrl = otherId ? photoByUserId.get(otherId) ?? null : null;
          return {
            id: c.id as string,
            match_id: c.match_id as string,
            created_at: c.created_at as string,
            other_user_id: otherId,
            other_display_name: profile?.display_name ?? null,
            other_photo_url: photoUrl ?? null,
          };
        });

        setConversations(enriched);
        setSelectedConversationId((prev) => prev ?? (enriched[0]?.id as string));
      } finally {
        setMessagesLoading(false);
      }
    }

    loadConvos();
  }, [sessionEmail, messagesPageOpen, currentUserId]);

  async function fetchUnreadMessageCount(): Promise<number> {
    if (!currentUserId) return 0;

    const { data: convoRows, error: convoError } = await supabase
      .from("conversations")
      .select("id");

    if (convoError || !convoRows) return 0;
    const convoIds = (convoRows as any[]).map((c) => c.id as string);
    if (convoIds.length === 0) return 0;

    const { data: unreadRows } = await supabase
      .from("messages")
      .select("id, sender_user_id")
      .in("conversation_id", convoIds)
      .is("read_at", null)
      .neq("sender_user_id", currentUserId);

    return unreadRows?.length ?? 0;
  }

  useEffect(() => {
    if (!sessionEmail || !currentUserId) {
      setUnreadMessageCount(0);
      return;
    }

    let cancelled = false;
    void (async () => {
      const count = await fetchUnreadMessageCount();
      if (!cancelled) setUnreadMessageCount(count);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionEmail, currentUserId]);

  useEffect(() => {
    if (!sessionEmail) return;
    if (!messagesPageOpen) return;
    if (!selectedConversationId) return;

    async function loadMessages(conversationId: string) {
      setMessagesLoading(true);
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("id, conversation_id, sender_user_id, body, sent_at")
          .eq("conversation_id", conversationId)
          .order("sent_at", { ascending: true });

        if (error) return;
        setMessages(data ?? []);

      if (currentUserId) {
        const { data: unreadRows, error: unreadErr } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .is("read_at", null)
          .neq("sender_user_id", currentUserId);

        if (!unreadErr && unreadRows && unreadRows.length > 0) {
          const ids = (unreadRows as any[]).map((m) => m.id as string);
          await supabase
            .from("messages")
            .update({ read_at: new Date().toISOString() })
            .in("id", ids);
        }

        // Recompute badge from server state.
        const count = await fetchUnreadMessageCount();
        setUnreadMessageCount(count);
      }
      } finally {
        setMessagesLoading(false);
      }
    }

    loadMessages(selectedConversationId);
  }, [sessionEmail, messagesPageOpen, selectedConversationId, currentUserId]);

  async function handleUserSearch() {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setAuthMessage(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, city, bio, users!inner(username)")
        .or(`display_name.ilike.%${q}%,users.username.ilike.%${q}%`)
        .limit(20);

      if (error) {
        setAuthMessage(`Unable to search users: ${error.message}`);
        return;
      }

      const normalized = (data ?? []).map((row: any) => ({
        user_id: row.user_id as string,
        display_name: row.display_name as string | null,
        username: (row.users?.username ?? null) as string | null,
        city: row.city as string | null,
        bio: row.bio as string | null,
      }));
      setSearchResults(normalized);
    } finally {
      setSearchLoading(false);
    }
  }

  function getProfileCityAreaLabel(): string | null {
    const q = onboardingQuestionnaire.find((qq) => qq.id === "profile_city_area");
    if (!q) return null;

    const raw = onboardingAnswers["profile_city_area"];
    const v = raw as ChoiceWithOtherAnswer | null;
    if (!v || !v.choice) return null;

    // If user chose "other", use otherText.
    if (v.choice === (q as any).otherOptionId) {
      const otherText = (v.otherText ?? "").trim();
      return otherText || "Other area";
    }

    const optionLabel = (q as any).options?.find((o: any) => o.id === v.choice)?.label;
    return optionLabel ?? null;
  }

  function areaKeyFromCityLabel(cityLabel: string | null): string {
    const lower = (cityLabel ?? "").toLowerCase();
    if (lower.includes("denver")) return "denver";
    if (lower.includes("boulder")) return "boulder";
    if (lower.includes("colorado springs")) return "colorado_springs";
    if (lower.includes("fort collins")) return "fort_collins";
    return "other";
  }

  function areaCenter(areaKey: string): Coordinates {
    if (areaKey === "denver") return { latitude: 39.7392, longitude: -104.9903 };
    if (areaKey === "boulder") return { latitude: 40.015, longitude: -105.2705 };
    if (areaKey === "colorado_springs") return { latitude: 38.8339, longitude: -104.8214 };
    if (areaKey === "fort_collins") return { latitude: 40.5853, longitude: -105.0844 };
    return { latitude: 39.7392, longitude: -104.9903 };
  }

  function distanceInMiles(from: Coordinates, to: Coordinates): number {
    const earthRadiusMiles = 3958.8;
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = toRadians(to.latitude - from.latitude);
    const dLng = toRadians(to.longitude - from.longitude);
    const lat1 = toRadians(from.latitude);
    const lat2 = toRadians(to.latitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMiles * c;
  }

  function mergeApartmentResultsWithMocks(
    searchCoordinates: Coordinates,
    areaKey: string,
    apiResults: ApartmentSearchResult[]
  ): ApartmentSearchResult[] {
    const mockResults = mockApartments
      .map((a) => {
        const distanceMiles = distanceInMiles(searchCoordinates, {
          latitude: a.latitude,
          longitude: a.longitude,
        });
        return {
          result: {
            id: a.id,
            name: a.name,
            address: a.address,
            distanceMiles,
            bedroomsLabel: `${a.bedrooms} bedroom${a.bedrooms === 1 ? "" : "s"}`,
            priceLabel: `$${a.priceMonthlyMin}–$${a.priceMonthlyMax}/mo`,
            highlights: [...a.highlights, "Demo listing"],
            websiteUrl: null,
            source: "mock" as const,
          },
          areaPriority: a.areaKey === areaKey ? 0 : 1,
          distanceMiles,
        };
      })
      .sort((a, b) => {
        if (a.areaPriority !== b.areaPriority) return a.areaPriority - b.areaPriority;
        return a.distanceMiles - b.distanceMiles;
      })
      .map((row) => row.result);

    const apiSorted = [...apiResults].sort(
      (a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity)
    );

    const seen = new Set<string>();
    const out: ApartmentSearchResult[] = [];

    const pushUnique = (item: ApartmentSearchResult) => {
      const key = `${item.name.toLowerCase()}::${item.address.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(item);
    };

    for (const m of mockResults.slice(0, 3)) {
      if (out.length >= 12) break;
      pushUnique(m);
    }
    for (const row of apiSorted) {
      if (out.length >= 12) break;
      pushUnique(row);
    }
    for (const m of mockResults.slice(3)) {
      if (out.length >= 12) break;
      pushUnique(m);
    }

    out.sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
    return out.slice(0, 12);
  }

  function normalizeWebsite(url: string | null): string | null {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    return `https://${trimmed}`;
  }

  async function geocodeLocation(locationQuery: string): Promise<{ label: string; coords: Coordinates }> {
    const params = new URLSearchParams({
      q: locationQuery,
      format: "jsonv2",
      addressdetails: "1",
      limit: "1",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Location lookup failed (${response.status})`);
    }

    const results = (await response.json()) as NominatimPlace[];
    const first = results[0];
    if (!first) {
      throw new Error("No location found.");
    }

    return {
      label: first.display_name,
      coords: {
        latitude: Number(first.lat),
        longitude: Number(first.lon),
      },
    };
  }

  async function fetchRealApartmentsNearCoordinates(
    center: Coordinates,
    locationLabel: string
  ): Promise<ApartmentSearchResult[]> {
    const query = `
[out:json][timeout:25];
(
  node["building"="apartments"](around:12000,${center.latitude},${center.longitude});
  way["building"="apartments"](around:12000,${center.latitude},${center.longitude});
  relation["building"="apartments"](around:12000,${center.latitude},${center.longitude});
  node["amenity"="apartments"](around:12000,${center.latitude},${center.longitude});
  way["amenity"="apartments"](around:12000,${center.latitude},${center.longitude});
  relation["amenity"="apartments"](around:12000,${center.latitude},${center.longitude});
);
out center tags 120;
    `.trim();

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: query,
    });

    if (!response.ok) {
      throw new Error(`Apartment lookup failed (${response.status})`);
    }

    const body = (await response.json()) as { elements?: OverpassElement[] };
    const elements = body.elements ?? [];
    const results: ApartmentSearchResult[] = [];
    for (const element of elements) {
      const tags = element.tags ?? {};
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (lat == null || lon == null) continue;

      const websiteUrl = normalizeWebsite(
        tags.website ?? tags["contact:website"] ?? tags.url ?? null
      );
      const addressParts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:city"],
        tags["addr:state"],
      ].filter(Boolean);
      const address = addressParts.length > 0 ? addressParts.join(" ") : `Near ${locationLabel}`;
      const name = tags.name?.trim() || "Apartment building";

      results.push({
        id: `osm-${element.type}-${element.id}`,
        name,
        address,
        distanceMiles: distanceInMiles(center, { latitude: lat, longitude: lon }),
        bedroomsLabel: "Varies",
        priceLabel: "Check listing site",
        highlights: websiteUrl ? ["Website available"] : [],
        websiteUrl:
          websiteUrl ??
          `https://www.google.com/search?q=${encodeURIComponent(`${name} ${address} apartments`)}`,
        source: "api" as const,
      });
    }

    const sorted = results
      .sort((a, b) => {
        if (a.distanceMiles == null && b.distanceMiles == null) return 0;
        if (a.distanceMiles == null) return 1;
        if (b.distanceMiles == null) return -1;
        return a.distanceMiles - b.distanceMiles;
      })
      .slice(0, 20);

    const uniqueByNameAndAddress = new Map<string, ApartmentSearchResult>();
    for (const item of sorted) {
      const key = `${item.name.toLowerCase()}::${item.address.toLowerCase()}`;
      if (!uniqueByNameAndAddress.has(key)) {
        uniqueByNameAndAddress.set(key, item);
      }
    }

    return Array.from(uniqueByNameAndAddress.values()).slice(0, 10);
  }

  async function resolveCurrentLocation(): Promise<Coordinates | null> {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return null;
    }

    setLocationStatus("resolving");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserCoordinates(coords);
          setLocationStatus("ready");
          resolve(coords);
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationStatus("denied");
          } else {
            setLocationStatus("error");
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
      );
    });
  }

  async function handleApartmentSearch() {
    const query = apartmentSearchText.trim();
    setApartmentsLoading(true);
    setAuthMessage(null);

    try {
      const cityLabel = getProfileCityAreaLabel();
      const areaKey = areaKeyFromCityLabel(cityLabel);
      const fallbackCoordinates = areaCenter(areaKey);
      const typedLocation = query.length > 0 ? query : null;
      const defaultLocationLabel = cityLabel ?? "your selected area";
      let locationLabel = defaultLocationLabel;
      let searchCoordinates = fallbackCoordinates;

      if (typedLocation) {
        const geocoded = await geocodeLocation(typedLocation);
        locationLabel = geocoded.label;
        searchCoordinates = geocoded.coords;
      } else {
        const locationCoordinates = userCoordinates ?? (await resolveCurrentLocation());
        searchCoordinates = locationCoordinates ?? fallbackCoordinates;
      }
      setSearchedLocationLabel(locationLabel);

      let apiResults: ApartmentSearchResult[] = [];

      try {
        const rentcastResults = await fetchRentCastApartmentsNear(searchCoordinates, {
          radiusMiles: 15,
          limit: 30,
        });
        if (rentcastResults.length > 0) {
          apiResults = rentcastResults;
        }
      } catch {
        // No key, proxy unavailable, or empty market — try OpenStreetMap next.
      }

      if (apiResults.length === 0) {
        try {
          const overpassResults = await fetchRealApartmentsNearCoordinates(
            searchCoordinates,
            locationLabel
          );
          if (overpassResults.length > 0) {
            apiResults = overpassResults;
          }
        } catch {
          // Fall through to merged demo + API list.
        }
      }

      setApartmentResults(mergeApartmentResultsWithMocks(searchCoordinates, areaKey, apiResults));
    } finally {
      setApartmentsLoading(false);
    }
  }

  useEffect(() => {
    if (!apartmentsPageOpen || !sessionEmail) return;
    void handleApartmentSearch();
    // Intentionally depend on tab + session + profile city only (not search text).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apartmentsPageOpen, sessionEmail, profileCityAreaFingerprint]);

  async function handleAiChatSend() {
    const text = aiChatDraft.trim();
    if (!text) return;

    const now = new Date().toISOString();
    const userMessage = { id: `u-${now}`, from: "user" as const, body: text, at: now };
    setAiChatDraft("");
    setAiChatMessages((prev) => [...prev, userMessage]);

    // Very simple scripted reply so the UI feels alive.
    // No external AI/API calls are made here.
    const lower = text.toLowerCase();
    let reply =
      "I’m a demo chatbot inside RoomAi. I can’t match you yet, but I can react to what you type.";

    if (lower.includes("hello") || lower.includes("hi")) {
      reply = "Hey there! Tell me what kind of roommate or apartment you’re looking for.";
    } else if (lower.includes("roommate")) {
      reply =
        "Roommate matching here is based on your onboarding questionnaire. You can tweak that in your profile.";
    } else if (lower.includes("apartment")) {
      reply =
        "Check the Apartments tab in the left menu—I’ll suggest a few places near the area you picked.";
    } else if (lower.includes("budget")) {
      reply =
        "Try to keep your budget range realistic for your city. You can adjust it in the onboarding questionnaire.";
    }

    const aiNow = new Date().toISOString();
    const aiMessage = { id: `a-${aiNow}`, from: "ai" as const, body: reply, at: aiNow };
    setAiChatMessages((prev) => [...prev, aiMessage]);
  }

  async function handleSendMessage() {
    if (!selectedConversationId) return;
    if (!currentUserId) return;
    const trimmed = messageDraft.trim();
    if (!trimmed) return;

    setMessageSending(true);
    setAuthMessage(null);
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversationId,
        sender_user_id: currentUserId,
        body: trimmed,
      });

      if (error) {
        setAuthMessage(`Unable to send message: ${error.message}`);
        return;
      }

      setMessageDraft("");

      // Reload messages so the new one shows up immediately.
      const { data, error: loadErr } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_user_id, body, sent_at")
        .eq("conversation_id", selectedConversationId)
        .order("sent_at", { ascending: true });

      if (!loadErr) setMessages(data ?? []);
    } finally {
      setMessageSending(false);
    }
  }

  async function ensurePublicUserRow(params?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    username?: string | null;
    email?: string;
  }) {
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      return;
    }

    const metadata = user.user_metadata ?? {};
    const resolvedEmail = params?.email ?? user.email ?? null;

    const resolvedFirstName = (params?.firstName ?? metadata.first_name ?? "").trim() || null;
    const resolvedLastName = (params?.lastName ?? metadata.last_name ?? "").trim() || null;

    const resolvedUsername =
      (params?.username ?? metadata.username ?? "").trim().toLowerCase() || null;

    const updateRow: Record<string, unknown> = {
      id: user.id,
      email: resolvedEmail,
      ...(resolvedFirstName ? { first_name: resolvedFirstName } : {}),
      ...(resolvedLastName ? { last_name: resolvedLastName } : {}),
      ...(resolvedUsername ? { username: resolvedUsername } : {}),
    };

    const { error } = await supabase.from("users").upsert(updateRow, { onConflict: "id" });

    if (error) {
      throw error;
    }
  }

  async function ensureProfileRow(
    displayName: string,
    birthdateIso: string,
    visibleToOthers: boolean
  ) {
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    if (!user) {
      return;
    }

    const age = calculateAgeFromBirthdate(birthdateIso);
    if (age == null || age < 18 || age > 120) {
      throw new Error("Invalid birth date.");
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        display_name: displayName,
        birthdate: birthdateIso,
        age,
        is_visible: visibleToOthers,
      },
      { onConflict: "user_id" }
    );
    if (error) {
      throw error;
    }
  }

  async function handleForgotPassword() {
    const email = userEmail.trim();
    if (!email) {
      setAuthMessage("Enter your email above, then use Forgot password.");
      return;
    }
    setForgotPasswordSending(true);
    setAuthMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    setForgotPasswordSending(false);
    if (error) {
      setAuthMessage(error.message);
      return;
    }
  }

  async function handleUpdateRecoveryPassword() {
    if (recoveryPassword.length < 6) {
      setAuthMessage("Password must be at least 6 characters.");
      return;
    }
    if (recoveryPassword !== recoveryPasswordConfirm) {
      setAuthMessage("Passwords do not match.");
      return;
    }
    setRecoveryPasswordSaving(true);
    setAuthMessage(null);
    const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
    setRecoveryPasswordSaving(false);
    if (error) {
      setAuthMessage(error.message);
      return;
    }
    setPasswordRecoveryMode(false);
    setRecoveryPassword("");
    setRecoveryPasswordConfirm("");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setAuthMessage(null);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    if (authMode === "signup") {
      const cleanedFirstName = firstName.trim();
      const cleanedLastName = lastName.trim();
      const cleanedFullName = `${cleanedFirstName} ${cleanedLastName}`.trim();

      if (!cleanedFirstName) {
        setAuthMessage("First name is required.");
        setAuthLoading(false);
        return;
      }
      if (!cleanedLastName) {
        setAuthMessage("Last name is required.");
        setAuthLoading(false);
        return;
      }

      const birthRaw = signUpBirthdate.trim();
      if (!birthRaw) {
        setAuthMessage("Please enter your date of birth.");
        setAuthLoading(false);
        return;
      }
      const signupAge = calculateAgeFromBirthdate(birthRaw);
      if (signupAge == null || signupAge < 18 || signupAge > 120) {
        setAuthMessage("You must be between 18 and 120 years old to sign up.");
        setAuthLoading(false);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: userEmail,
        password,
        options: {
          data: {
            first_name: cleanedFirstName,
            last_name: cleanedLastName,
            full_name: cleanedFullName,
          },
        },
      });

      if (signUpError) {
        setAuthMessage(signUpError.message);
        setAuthLoading(false);
        return;
      }

      try {
        await ensurePublicUserRow({
          firstName: cleanedFirstName,
          lastName: cleanedLastName,
          fullName: cleanedFullName,
          email: userEmail,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        setAuthMessage(`Account created, but profile setup failed: ${message}`);
        setAuthLoading(false);
        return;
      }
      await ensureProfileRow(cleanedFullName, birthRaw, signUpVisibleToOthers);

      // If email confirmation is off, Supabase may return a session — sign out locally so we always
      // send new users to the Sign in step with a clear message.
      if (signUpData.session) {
        await supabase.auth.signOut({ scope: "local" });
        setSessionEmail(null);
      }

      setAuthMode("signin");
      setAuthMessage("Account created. Sign in with the same email and password below.");
      setAuthLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    if (signInError) {
      setAuthMessage(signInError.message);
      setAuthLoading(false);
      return;
    }

    try {
      await ensurePublicUserRow({ email: userEmail });
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthMessage(`Signed in, but profile sync failed: ${message}`);
      setAuthLoading(false);
      return;
    }
    setAuthMessage(null);
    setAuthLoading(false);
  }

  async function handleSignOut() {
    setAuthLoading(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setAuthMessage(signOutError.message);
      setAuthLoading(false);
      return;
    }
    setAuthMessage(null);
    setSignUpBirthdate("");
    setSignUpVisibleToOthers(true);
    setProfileBirthdate("");
    setProfileVisibleToOthers(true);
    setUserFirstName("");
    setAuthLoading(false);
  }

  async function handleDeleteAccount() {
    if (!sessionEmail) {
      return;
    }

    const confirmed = window.confirm(
      "Delete your account permanently? This removes your profile and cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    setAuthLoading(true);
    setAuthMessage(null);

    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setAuthMessage("You are not signed in.");
        return;
      }

      const userEmailForStorage = user.email ?? sessionEmail;
      let deletionErrorMessage: string | null = null;

      // Try the Edge Function first (it can actually delete auth.users).
      const { error: fnError } = await supabase.functions.invoke("delete-current-user", {
        body: {},
      });

      if (fnError) {
        // Fallback: delete app-owned data only (auth user remains).
        const { error: deleteError } = await supabase.rpc("delete_current_user");
        if (deleteError) {
          // Last-resort fallback if RPC migration has not been applied yet.
          const { error: directDeleteError } = await supabase
            .from("users")
            .delete()
            .eq("id", user.id);

          if (directDeleteError) {
            deletionErrorMessage = `Could not fully delete account on server. Edge function error: ${fnError.message}. RPC error: ${deleteError.message}. Direct delete error: ${directDeleteError.message}`;
          }
        }
      }

      if (userEmailForStorage) {
        localStorage.removeItem(onboardingStorageKey(userEmailForStorage));
        localStorage.removeItem(photoPromptStorageKey(userEmailForStorage));
      }

      // Always clear local session so the UI exits authenticated state.
      await supabase.auth.signOut({ scope: "local" });
      setOnboardingAnswers(defaultOnboardingQuestionnaireAnswers);
      setOnboardingComplete(false);
      setQuestionIndex(0);
      setOnboardingStepIndex(0);
      setMiniGameAnswers(null);
      setSignUpBirthdate("");
      setSignUpVisibleToOthers(true);
      setProfileBirthdate("");
      setProfileVisibleToOthers(true);
      setOnboardingEditorOpen(false);
      setProfilePageOpen(false);
      setUtilitiesPageOpen(false);
      setSwipes([]);
      setSessionEmail(null);
      setAuthMessage(deletionErrorMessage);
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthMessage(`Unable to delete account: ${message}`);
    } finally {
      setAuthLoading(false);
    }
  }

  const me = useMemo(
    () => buildUserModel(onboardingAnswers, miniGameAnswers),
    [onboardingAnswers, miniGameAnswers]
  );
  const scoredCandidates = useMemo(() => {
    const seen = new Set<string>();
    const pool: CandidateProfile[] = [];
    for (const c of mockCandidates) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        pool.push(c);
      }
    }
    for (const c of discoverCandidates) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        pool.push(c);
      }
    }
    return pool
      .map((candidate) => ({
        ...candidate,
        compatibility: compatibilityScore(me, candidate),
      }))
      .sort((a, b) => b.compatibility.totalScore - a.compatibility.totalScore);
  }, [me, discoverCandidates]);

  const selfProfilePhotoSrc = useMemo(() => {
    const label = userFirstName.trim() || displayName.trim() || "You";
    return (
      profilePhotoUrl ??
      `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&size=240&background=f5d7c2&color=4c2f21`
    );
  }, [profilePhotoUrl, userFirstName, displayName]);

  const selfProfilePhotoExpandedSrc = useMemo(() => {
    const label = userFirstName.trim() || displayName.trim() || "You";
    return (
      profilePhotoUrl ??
      `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&size=720&background=f5d7c2&color=4c2f21`
    );
  }, [profilePhotoUrl, userFirstName, displayName]);

  const locationOrderedCandidates = useMemo(() => {
    const preferredLocation = (getProfileCityAreaLabel() ?? "").trim().toLowerCase();
    if (!preferredLocation) {
      return [...scoredCandidates].sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
    }

    return [...scoredCandidates].sort((a, b) => {
      const aMatches = a.city.toLowerCase().includes(preferredLocation);
      const bMatches = b.city.toLowerCase().includes(preferredLocation);
      if (aMatches !== bMatches) return aMatches ? -1 : 1;
      return a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
    });
  }, [scoredCandidates, onboardingAnswers]);

  const randomCandidates = useMemo(() => {
    const shuffled = [...scoredCandidates];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [scoredCandidates]);

  const deckCandidates = useMemo(() => {
    if (deckMode === "location") return locationOrderedCandidates;
    if (deckMode === "random") return randomCandidates;
    return scoredCandidates;
  }, [deckMode, scoredCandidates, locationOrderedCandidates, randomCandidates]);

  const remainingCandidates = useMemo(() => {
    return deckCandidates.filter(
      (candidate) => !swipes.some((swipe) => swipe.candidateId === candidate.id)
    );
  }, [deckCandidates, swipes]);

  const currentQuestion = onboardingQuestionnaire[questionIndex];

  const likedCandidates = useMemo(() => {
    const likedIds = new Set(
      swipes.filter((swipe) => swipe.decision === "like").map((swipe) => swipe.candidateId)
    );
    return deckCandidates.filter((candidate) => likedIds.has(candidate.id));
  }, [deckCandidates, swipes]);

  function updateAnswer(id: string, value: OnboardingAnswerValue) {
    setOnboardingAnswers((prev) => ({
      ...prev,
      [id]: value,
    }));
  }

  function nextQuestion() {
    setQuestionIndex((prev) => Math.min(onboardingQuestionnaire.length - 1, prev + 1));
  }

  function previousQuestion() {
    setQuestionIndex((prev) => Math.max(0, prev - 1));
  }

  function advanceOnboardingStep() {
    setOnboardingStepIndex((s) => {
      if (s === ONBOARDING_QUESTIONNAIRE_LEN - 1) {
        setMiniGameAnswers((mg) => mg ?? createDefaultMiniGames(onboardingAnswers));
      }
      return Math.min(s + 1, ONBOARDING_TOTAL_STEPS - 1);
    });
  }

  function retreatOnboardingStep() {
    setOnboardingStepIndex((s) => Math.max(0, s - 1));
  }

  async function persistQuestionnaireToSupabase(payload: {
    answers: OnboardingAnswerMap;
    miniGames: MiniGameAnswers | null;
  }) {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;

    const resolvedMini =
      payload.miniGames ?? createDefaultMiniGames(payload.answers);
    const label =
      `${profileFirstName.trim()} ${profileLastName.trim()}`.trim() ||
      sessionEmail?.split("@")[0] ||
      "Member";
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        display_name: label,
        is_visible: profileVisibleToOthers,
        onboarding_answers: payload.answers as unknown as Record<string, unknown>,
        mini_games: resolvedMini as unknown as Record<string, unknown>,
        questionnaire_updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.warn("Could not sync questionnaire to Supabase:", error.message);
    }
  }

  function finishOnboarding() {
    if (!sessionEmail) {
      return;
    }
    const resolvedMiniGames = miniGameAnswers ?? createDefaultMiniGames(onboardingAnswers);
    localStorage.setItem(
      onboardingStorageKey(sessionEmail),
      serializeOnboardingPayload({
        answers: onboardingAnswers,
        miniGames: resolvedMiniGames,
      })
    );
    setMiniGameAnswers(resolvedMiniGames);
    setOnboardingComplete(true);
    setSwipes([]);
    void persistQuestionnaireToSupabase({
      answers: onboardingAnswers,
      miniGames: resolvedMiniGames,
    });
  }

  function skipOnboarding() {
    if (!sessionEmail) {
      return;
    }
    localStorage.setItem(
      onboardingStorageKey(sessionEmail),
      serializeOnboardingPayload({
        answers: onboardingAnswers,
        miniGames: null,
      })
    );
    setOnboardingComplete(true);
    setSwipes([]);
    void persistQuestionnaireToSupabase({
      answers: onboardingAnswers,
      miniGames: null,
    });
  }

  function saveOnboardingEdits() {
    if (!sessionEmail) {
      return;
    }
    localStorage.setItem(
      onboardingStorageKey(sessionEmail),
      serializeOnboardingPayload({
        answers: onboardingAnswers,
        miniGames: miniGameAnswers,
      })
    );
    void persistQuestionnaireToSupabase({
      answers: onboardingAnswers,
      miniGames: miniGameAnswers,
    });
  }

  async function loadPrimaryProfilePhotoUrl(): Promise<string | null> {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;

    const { data: photoRows, error } = await supabase
      .from("profile_photos")
      .select("url, is_primary, created_at")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) return null;
    const url = photoRows?.[0]?.url ?? null;
    setProfilePhotoUrl(url);
    return url;
  }

  async function loadProfilePhotoAndGate() {
    if (!sessionEmail) return;
    const url = await loadPrimaryProfilePhotoUrl();
    if (url) {
      setPhotoPromptComplete(true);
      localStorage.setItem(photoPromptStorageKey(sessionEmail), "done");
      return;
    }
    const raw = localStorage.getItem(photoPromptStorageKey(sessionEmail));
    setPhotoPromptComplete(raw === "done");
  }

  async function uploadProfilePhoto(file: File) {
    if (!sessionEmail) return;
    setPhotoUploading(true);
    setAuthMessage(null);

    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setAuthMessage("You are not signed in.");
        return;
      }

      try {
        // Ensure FK parent row exists before inserting into profile_photos.
        await ensurePublicUserRow({ email: user.email ?? undefined });
      } catch (syncError) {
        const message = getErrorMessage(syncError);
        setAuthMessage(`Unable to prepare account for photo upload: ${message}`);
        return;
      }

      const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
      const objectPath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(objectPath, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        setAuthMessage(`Unable to upload photo: ${uploadError.message}`);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-photos").getPublicUrl(objectPath);

      await supabase.from("profile_photos").update({ is_primary: false }).eq("user_id", user.id);

      let { error: rowError } = await supabase.from("profile_photos").insert({
        user_id: user.id,
        url: publicUrl,
        position: 0,
        is_primary: true,
      });

      if (rowError && rowError.message.includes("profile_photos_user_id_fkey")) {
        // If user row was missing transiently, recreate/sync and retry once.
        try {
          await ensurePublicUserRow({ email: user.email ?? undefined });
          const retry = await supabase.from("profile_photos").insert({
            user_id: user.id,
            url: publicUrl,
            position: 0,
            is_primary: true,
          });
          rowError = retry.error;
        } catch (syncError) {
          const message = getErrorMessage(syncError);
          setAuthMessage(`Unable to prepare account for photo upload: ${message}`);
          return;
        }
      }

      if (rowError) {
        setAuthMessage(`Photo uploaded but could not save profile photo row: ${rowError.message}`);
        return;
      }

      setProfilePhotoUrl(publicUrl);
      setAuthMessage(null);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handlePhotoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadProfilePhoto(file);
    event.target.value = "";
  }

  function handleSkipPhotoPrompt() {
    if (!sessionEmail) return;
    localStorage.setItem(photoPromptStorageKey(sessionEmail), "done");
    setPhotoPromptComplete(true);
    setAuthMessage(null);
  }

  function handleCompletePhotoPrompt() {
    if (!sessionEmail) return;
    localStorage.setItem(photoPromptStorageKey(sessionEmail), "done");
    setPhotoPromptComplete(true);
  }

  async function loadProfileDisplayName() {
    if (!sessionEmail) return;
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;

    const [{ data: profile, error: profileError }, { data: account }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, birthdate, is_visible, onboarding_answers, mini_games")
        .eq("user_id", user.id)
        .single(),
      supabase.from("users").select("first_name, last_name").eq("id", user.id).maybeSingle(),
    ]);

    if (profileError) {
      const fnOnly = (account?.first_name ?? "").trim();
      setUserFirstName(fnOnly);
      setDisplayName(fnOnly);
      return;
    }

    const full = (profile?.display_name ?? "").trim();
    const parts = full.split(/\s+/).filter(Boolean);
    const fnFromProfile = parts.shift() ?? "";
    const lnFromProfile = parts.join(" ");

    const fnDb = (account?.first_name ?? "").trim();
    const lnDb = (account?.last_name ?? "").trim();

    if (fnDb || lnDb) {
      setProfileFirstName(fnDb);
      setProfileLastName(lnDb);
    } else {
      setProfileFirstName(fnFromProfile);
      setProfileLastName(lnFromProfile);
    }

    // UI label under deck photo: only `users.first_name` (never email).
    setUserFirstName(fnDb);
    // Legacy short label for fallbacks (e.g. avatar if first name missing).
    setDisplayName(fnDb || fnFromProfile || "");
    const bd = profile?.birthdate as string | null | undefined;
    setProfileBirthdate(typeof bd === "string" ? bd : "");
    setProfileVisibleToOthers(profile?.is_visible !== false);

    const oa = profile?.onboarding_answers as unknown;
    if (oa && typeof oa === "object") {
      setOnboardingAnswers(oa as OnboardingAnswerMap);
      const mgRaw = profile?.mini_games as unknown;
      setMiniGameAnswers(
        mgRaw && typeof mgRaw === "object" ? (mgRaw as MiniGameAnswers) : null
      );
      setOnboardingComplete(true);
      const email = sessionEmail;
      if (email) {
        localStorage.setItem(
          onboardingStorageKey(email),
          serializeOnboardingPayload({
            answers: oa as OnboardingAnswerMap,
            miniGames:
              mgRaw && typeof mgRaw === "object" ? (mgRaw as MiniGameAnswers) : null,
          })
        );
      }
    }
  }

  async function handleSaveProfile() {
    if (!sessionEmail) return;

    setProfileSaving(true);
    setAuthMessage(null);

    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setAuthMessage("You are not signed in.");
        return;
      }

      const cleanedFirstName = profileFirstName.trim();
      const cleanedLastName = profileLastName.trim();
      if (!cleanedFirstName) {
        setAuthMessage("First name cannot be empty.");
        return;
      }
      if (!cleanedLastName) {
        setAuthMessage("Last name cannot be empty.");
        return;
      }
      const cleanedFullName = `${cleanedFirstName} ${cleanedLastName}`.trim();

      const bd = profileBirthdate.trim();
      const profileUpsert: {
        user_id: string;
        display_name: string;
        is_visible: boolean;
        birthdate?: string;
        age?: number;
      } = {
        user_id: user.id,
        display_name: cleanedFullName,
        is_visible: profileVisibleToOthers,
      };
      if (bd) {
        const savedAge = calculateAgeFromBirthdate(bd);
        if (savedAge == null || savedAge < 18 || savedAge > 120) {
          setAuthMessage("Enter a valid date of birth (age 18–120).");
          return;
        }
        profileUpsert.birthdate = bd;
        profileUpsert.age = savedAge;
      }

      const { error } = await supabase.from("profiles").upsert(profileUpsert, { onConflict: "user_id" });

      if (error) {
        setAuthMessage(`Unable to save profile: ${error.message}`);
        return;
      }

      const { error: userError } = await supabase
        .from("users")
        .update({
          first_name: cleanedFirstName,
          last_name: cleanedLastName,
        })
        .eq("id", user.id);

      if (userError) {
        setAuthMessage(`Unable to save name: ${userError.message}`);
        return;
      }

      setDisplayName(cleanedFirstName);
      setUserFirstName(cleanedFirstName);
      setAuthMessage(null);
    } finally {
      setProfileSaving(false);
    }
  }

  function swipeCandidate(candidateId: string, decision: "like" | "pass") {
    setSwipes((prev) => {
      if (prev.some((swipe) => swipe.candidateId === candidateId)) {
        return prev;
      }
      return [...prev, { candidateId, decision }];
    });
  }

  function confirmRemoveLikedProfile() {
    if (!removeLikeTarget) return;
    const id = removeLikeTarget.id;
    setSwipes((prev) => prev.filter((s) => s.candidateId !== id));
    setDeckProfileCandidate((current) => (current?.id === id ? null : current));
    setRemoveLikeTarget(null);
  }

  function toggleTheme() {
    const nextTheme = theme === "sunny" ? "night" : "sunny";
    setTheme(nextTheme);
    localStorage.setItem("roomai_theme", nextTheme);
  }

  function openDeckProfile(candidate: ScoredCandidateProfile) {
    setDeckProfileCandidate(candidate);
  }

  function closeDeckProfile() {
    setDeckProfileCandidate(null);
  }

  async function ensureConversationWithUser(targetUserId: string): Promise<string> {
    const resolvedCurrentUserId = currentUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!resolvedCurrentUserId) {
      throw new Error("You are not signed in.");
    }
    if (!currentUserId) {
      setCurrentUserId(resolvedCurrentUserId);
    }
    if (targetUserId === resolvedCurrentUserId) {
      throw new Error("You can’t message yourself.");
    }

    const { data: matchRow, error: matchError } = await supabase
      .from("matches")
      .upsert(
        { user_1_id: resolvedCurrentUserId, user_2_id: targetUserId, status: "active" },
        { onConflict: "canonical_user_low,canonical_user_high" }
      )
      .select("id")
      .single();

    if (matchError) {
      throw matchError;
    }

    const { data: convoRow, error: convoError } = await supabase
      .from("conversations")
      .upsert({ match_id: matchRow.id }, { onConflict: "match_id" })
      .select("id")
      .single();

    if (convoError) {
      throw convoError;
    }

    return convoRow.id;
  }

  async function openMessageFromCandidate(candidate: { id: string; name: string }) {
    setDeckProfileCandidate(null);
    setAuthMessage(null);

    setMessagesPageOpen(true);
    setProfilePageOpen(false);
    setSearchPageOpen(false);
    setApartmentsPageOpen(false);
    setAiChatPageOpen(false);
    setUtilitiesPageOpen(false);
    setOnboardingEditorOpen(false);

    try {
      const conversationId = await ensureConversationWithUser(candidate.id);
      setSelectedConversationId(conversationId);
      setMessageDraft(`Hi ${candidate.name}, I found your profile and wanted to connect.`);
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthMessage(`Could not start a message: ${message}`);
    }
  }

  function uuidLooksLikeUserId(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  function openReportForCandidate(candidate: { id: string; name: string }) {
    setDeckProfileCandidate(null);
    setReportTarget({ id: candidate.id, name: candidate.name });
    setReportReason("other");
    setReportDetails("");
  }

  function closeReportModal() {
    if (reportSending) return;
    setReportTarget(null);
  }

  async function submitUserReport() {
    if (!reportTarget) return;
    const { data: auth } = await supabase.auth.getUser();
    const reporter = auth.user;
    if (!reporter) {
      setAuthMessage("Sign in to submit a report.");
      return;
    }
    setReportSending(true);
    setAuthMessage(null);
    try {
      const isRealUser = uuidLooksLikeUserId(reportTarget.id);
      const { error } = await supabase.from("user_reports").insert({
        reporter_id: reporter.id,
        reported_user_id: isRealUser ? reportTarget.id : null,
        subject_display_name: reportTarget.name,
        subject_external_key: isRealUser ? null : reportTarget.id,
        reason: reportReason,
        details: reportDetails.trim() || null,
        source: "swipe_deck",
      });
      if (error) {
        setAuthMessage(`Could not send report: ${error.message}`);
        return;
      }
      setAuthMessage(null);
      setReportTarget(null);
    } finally {
      setReportSending(false);
    }
  }

  if (splashVisible) {
    return (
      <main className={`splash theme-${theme}`}>
        <img
          className="splash-logo"
          src="/roomai_logo.png"
          alt="RoomAi"
          width={1536}
          height={1024}
        />
        <p className="splash-tagline">
          <span className="splash-tagline-primary">Match Smarter.</span>{" "}
          <span className="splash-tagline-secondary">Live Better.</span>
        </p>
      </main>
    );
  }

  if (!sessionEmail) {
    return (
      <main className={`page auth-page theme-${theme}`}>
        <header className="hero">
          <div className="hero-title-row">
            <img
              className="app-logo"
              src="/roomai_logo.png"
              alt="RoomAi"
              width={1536}
              height={1024}
            />
            <h1>Welcome to RoomAi</h1>
          </div>
          <p>
            Sign in or create your account to start matching with compatible roommates.
          </p>
        </header>

        <section className="filters">
          <h3 className="section-title">Account</h3>
          <button type="button" className="theme-toggle" onClick={toggleTheme}>
            {theme === "sunny" ? "Switch to Night Vibe" : "Switch to Sunny Vibe"}
          </button>
          <form className="auth-form" onSubmit={handleAuthSubmit}>
            <div className="auth-mode-switch">
              <button
                type="button"
                className={authMode === "signup" ? "active" : ""}
                onClick={() => setAuthMode("signup")}
              >
                Sign up
              </button>
              <button
                type="button"
                className={authMode === "signin" ? "active" : ""}
                onClick={() => setAuthMode("signin")}
              >
                Sign in
              </button>
            </div>
            {authMode === "signup" ? (
              <>
                <div className="name-row">
                  <label>
                    First name
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Jane"
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Doe"
                    />
                  </label>
                </div>
                <label>
                  Date of birth
                  <input
                    type="date"
                    required
                    value={signUpBirthdate}
                    onChange={(event) => setSignUpBirthdate(event.target.value)}
                    min={minBirthdateForMaxAge(120)}
                    max={maxBirthdateForMinAge(18)}
                  />
                </label>
                <p className="small-note">Must be 18 or older. We store your birthdate and show your age.</p>
              </>
            ) : null}
            <label>
              Email
              <input
                type="email"
                required
                value={userEmail}
                onChange={(event) => setUserEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              <span className="auth-password-label-row">
                <span>Password</span>
                {authMode === "signin" ? (
                  <button
                    type="button"
                    className="auth-forgot-password"
                    onClick={() => void handleForgotPassword()}
                    disabled={forgotPasswordSending || authLoading}
                  >
                    {forgotPasswordSending ? "Sending…" : "Forgot password?"}
                  </button>
                ) : null}
              </span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </label>
            {passwordRecoveryMode && !sessionEmail ? (
              <p className="small-note password-recovery-waiting">
                Signing you in to reset your password…
              </p>
            ) : null}
            {authMode === "signup" ? (
              <>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={signUpVisibleToOthers}
                    onChange={(event) => setSignUpVisibleToOthers(event.target.checked)}
                  />
                  <span>
                    Show my profile to other users and include me in roommate recommendations and search
                  </span>
                </label>
                <p className="small-note">
                  Turn off to stay private—others won&apos;t discover your profile until you turn this back on.
                </p>
              </>
            ) : null}
            <button type="submit" disabled={authLoading}>
              {authLoading
                ? "Please wait..."
                : authMode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>
          {authMessage ? <p className="auth-status">{authMessage}</p> : null}
        </section>
      </main>
    );
  }

  const passwordRecoveryBanner =
    passwordRecoveryMode && sessionEmail ? (
      <section className="filters password-recovery-banner">
        <h3 className="section-title">Set a new password</h3>
        <p className="small-note">
          You opened a password reset link. Enter and confirm your new password below.
        </p>
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={recoveryPassword}
            onChange={(e) => setRecoveryPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={recoveryPasswordConfirm}
            onChange={(e) => setRecoveryPasswordConfirm(e.target.value)}
            placeholder="Repeat password"
          />
        </label>
        <div className="actions-row">
          <button
            type="button"
            onClick={() => void handleUpdateRecoveryPassword()}
            disabled={recoveryPasswordSaving}
          >
            {recoveryPasswordSaving ? "Saving…" : "Update password"}
          </button>
        </div>
        {authMessage ? <p className="auth-status">{authMessage}</p> : null}
      </section>
    ) : null;

  function formatAnswerForReview(
    question: OnboardingQuestion,
    rawValue: OnboardingAnswerValue
  ) {
    const value = rawValue ?? null;

    if (question.kind === "scale_1_5") {
      if (typeof value !== "number") return "—";
      return `${value}/5`;
    }

    if (question.kind === "single_select") {
      if (typeof value !== "string") return "—";
      return question.options.find((o) => o.id === value)?.label ?? "—";
    }

    if (question.kind === "multi_select") {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      if (ids.length === 0) return "—";
      return ids
        .map((id) => question.options.find((o) => o.id === id)?.label ?? id)
        .join(", ");
    }

    if (question.kind === "rank_top_n") {
      const ranked = (value as RankedMultiSelectAnswer | null)?.rankedIds ?? [];
      if (ranked.length === 0) return "—";
      return ranked
        .map((id) => question.options.find((o) => o.id === id)?.label ?? id)
        .join(" > ");
    }

    if (question.kind === "short_text") {
      return typeof value === "string" && value.trim().length > 0 ? value : "—";
    }

    if (question.kind === "numeric_range") {
      const range = (value as NumericRangeAnswer | null) ?? { min: null, max: null };
      if (range.min == null && range.max == null) return "—";
      const minPart = range.min == null ? "?" : String(range.min);
      const maxPart = range.max == null ? "?" : String(range.max);
      return `${minPart} – ${maxPart}`;
    }

    if (question.kind === "date_range") {
      const range = (value as DateRangeAnswer | null) ?? { start: null, end: null };
      if (!range.start && !range.end) return "—";
      return `${range.start ?? "?"} – ${range.end ?? "?"}`;
    }

    if (question.kind === "time_range") {
      const range = (value as TimeRangeAnswer | null) ?? { start: null, end: null };
      if (!range.start && !range.end) return "—";
      return `${range.start ?? "?"} – ${range.end ?? "?"}`;
    }

    if (question.kind === "choice_with_other") {
      const v =
        (value as ChoiceWithOtherAnswer | null) ?? ({ choice: "", otherText: "" } as ChoiceWithOtherAnswer);
      const choiceLabel =
        question.options.find((o) => o.id === v.choice)?.label ??
        (v.choice ? v.choice : "—");
      const other = v.otherText?.trim();
      return other ? `${choiceLabel} (${other})` : choiceLabel;
    }

    return "—";
  }

  function renderQuestion(question: OnboardingQuestion) {
    const value = onboardingAnswers[question.id] ?? null;

    if (question.kind === "scale_1_5") {
      const numeric = parseScale1to5(value, 3);
      return (
        <>
          <label>
            {question.prompt}
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={numeric}
              onChange={(event) =>
                updateAnswer(question.id, Number(event.target.value) as Scale1to5Answer)
              }
            />
          </label>
          <div className="range-labels">
            <span>{question.minLabel ?? "Low"}</span>
            <strong>Vibe: {numeric}/5</strong>
            <span>{question.maxLabel ?? "High"}</span>
          </div>
        </>
      );
    }

    if (question.kind === "single_select") {
      const selected = typeof value === "string" ? value : question.options[0]?.id ?? "";
      return (
        <fieldset className="choice-list">
          <legend>{question.prompt}</legend>
          {question.options.map((opt) => (
            <label key={opt.id} className="radio-row">
              <input
                type="radio"
                name={question.id}
                value={opt.id}
                checked={selected === opt.id}
                onChange={() => updateAnswer(question.id, opt.id)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </fieldset>
      );
    }

    if (question.kind === "multi_select") {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="choice-list">
          <legend>{question.prompt}</legend>
          {question.options.map((opt) => {
            const checked = selected.includes(opt.id);
            return (
              <label key={opt.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? selected.filter((id) => id !== opt.id)
                      : [...selected, opt.id];
                    updateAnswer(question.id, next);
                  }}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </fieldset>
      );
    }

    if (question.kind === "rank_top_n") {
      const ranked = (value as RankedMultiSelectAnswer | null)?.rankedIds ?? [];
      const selectedSet = new Set(ranked);
      return (
        <fieldset className="choice-list">
          <legend>{question.prompt}</legend>
          <p className="small-note">Pick up to {question.n} and order them.</p>
          <div className="ranked-pills">
            {ranked.length === 0 ? <span className="small-note">Nothing selected yet.</span> : null}
            {ranked.map((id) => {
              const label = question.options.find((o) => o.id === id)?.label ?? id;
              return (
                <div key={id} className="ranked-pill">
                  <span>{label}</span>
                  <div className="ranked-actions">
                    <button
                      type="button"
                      onClick={() => {
                        const idx = ranked.indexOf(id);
                        if (idx <= 0) return;
                        const next = [...ranked];
                        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                        updateAnswer(question.id, { rankedIds: next });
                      }}
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const idx = ranked.indexOf(id);
                        if (idx < 0 || idx >= ranked.length - 1) return;
                        const next = [...ranked];
                        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                        updateAnswer(question.id, { rankedIds: next });
                      }}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateAnswer(question.id, { rankedIds: ranked.filter((x) => x !== id) })
                      }
                      aria-label="Remove"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rank-options">
            {question.options.map((opt) => {
              const disabled = !selectedSet.has(opt.id) && ranked.length >= question.n;
              return (
                <button
                  type="button"
                  key={opt.id}
                  className={selectedSet.has(opt.id) ? "pill selected" : "pill"}
                  disabled={disabled}
                  onClick={() => {
                    const next = selectedSet.has(opt.id)
                      ? ranked.filter((x) => x !== opt.id)
                      : [...ranked, opt.id];
                    updateAnswer(question.id, { rankedIds: next });
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    }

    if (question.kind === "short_text") {
      const text = typeof value === "string" ? value : "";
      return (
        <label>
          {question.prompt}
          <textarea
            value={text}
            maxLength={question.maxLength}
            placeholder={question.placeholder}
            onChange={(event) => updateAnswer(question.id, event.target.value)}
          />
        </label>
      );
    }

    if (question.kind === "numeric_range") {
      const range = (value as NumericRangeAnswer | null) ?? { min: null, max: null };
      return (
        <fieldset className="range-pair">
          <legend>{question.prompt}</legend>
          <label>
            Min
            <input
              inputMode="numeric"
              type="number"
              value={range.min ?? ""}
              placeholder={question.minPlaceholder}
              onChange={(e) =>
                updateAnswer(question.id, {
                  ...range,
                  min: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Max
            <input
              inputMode="numeric"
              type="number"
              value={range.max ?? ""}
              placeholder={question.maxPlaceholder}
              onChange={(e) =>
                updateAnswer(question.id, {
                  ...range,
                  max: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </fieldset>
      );
    }

    if (question.kind === "date_range") {
      const range = (value as DateRangeAnswer | null) ?? { start: null, end: null };
      return (
        <fieldset className="range-pair">
          <legend>{question.prompt}</legend>
          <label>
            Start
            <input
              type="date"
              value={range.start ?? ""}
              onChange={(e) =>
                updateAnswer(question.id, {
                  ...range,
                  start: e.target.value === "" ? null : e.target.value,
                })
              }
            />
          </label>
          <label>
            End
            <input
              type="date"
              value={range.end ?? ""}
              onChange={(e) =>
                updateAnswer(question.id, {
                  ...range,
                  end: e.target.value === "" ? null : e.target.value,
                })
              }
            />
          </label>
        </fieldset>
      );
    }

    if (question.kind === "time_range") {
      const range = (value as TimeRangeAnswer | null) ?? { start: "22:00", end: "23:30" };
      return (
        <fieldset className="range-pair">
          <legend>{question.prompt}</legend>
          <label>
            Start
            <input
              type="time"
              value={range.start}
              onChange={(e) => updateAnswer(question.id, { ...range, start: e.target.value })}
            />
          </label>
          <label>
            End
            <input
              type="time"
              value={range.end}
              onChange={(e) => updateAnswer(question.id, { ...range, end: e.target.value })}
            />
          </label>
        </fieldset>
      );
    }

    if (question.kind === "choice_with_other") {
      const a = (value as ChoiceWithOtherAnswer | null) ?? {
        choice: question.options[0]?.id ?? "",
        otherText: "",
      };
      const showOther = a.choice === question.otherOptionId;
      return (
        <fieldset className="choice-list">
          <legend>{question.prompt}</legend>
          {question.options.map((opt) => (
            <label key={opt.id} className="radio-row">
              <input
                type="radio"
                name={question.id}
                value={opt.id}
                checked={a.choice === opt.id}
                onChange={() => updateAnswer(question.id, { ...a, choice: opt.id })}
              />
              <span>{opt.label}</span>
            </label>
          ))}
          {showOther ? (
            <label>
              <span className="small-note">Tell us where.</span>
              <input
                type="text"
                value={a.otherText ?? ""}
                placeholder={question.otherPlaceholder}
                onChange={(e) => updateAnswer(question.id, { ...a, otherText: e.target.value })}
              />
            </label>
          ) : null}
        </fieldset>
      );
    }

    return null;
  }

  if (!photoPromptComplete) {
    return (
      <main className={`page theme-${theme}`}>
        {passwordRecoveryBanner}
        <section className="filters">
          <h3 className="section-title">Add a profile photo</h3>
          <p className="small-note">
            Upload a profile photo to help roommates recognize you. You can skip this and add it later.
          </p>
          {profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt="Current profile"
              style={{ width: "140px", height: "140px", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : null}
          <label>
            Upload photo
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoFileChange}
              disabled={photoUploading}
            />
          </label>
          <div className="actions-row">
            <button
              type="button"
              onClick={handleCompletePhotoPrompt}
              disabled={!profilePhotoUrl || photoUploading}
            >
              Next
            </button>
            <button type="button" onClick={handleSkipPhotoPrompt} disabled={photoUploading}>
              Skip for now
            </button>
          </div>
          {authMessage && !passwordRecoveryMode ? <p className="auth-status">{authMessage}</p> : null}
        </section>
      </main>
    );
  }

  if (!onboardingComplete) {
    const step = onboardingStepIndex;
    const isQuestionnaireStep = step < ONBOARDING_QUESTIONNAIRE_LEN;
    const miniStep = (step - ONBOARDING_QUESTIONNAIRE_LEN) as 0 | 1 | 2;
    const gamesValue = miniGameAnswers ?? createDefaultMiniGames(onboardingAnswers);

    const subtitle = isQuestionnaireStep
      ? `Question ${step + 1} of ${ONBOARDING_TOTAL_STEPS} (${onboardingQuestionnaire[step].category})`
      : `Question ${step + 1} of ${ONBOARDING_TOTAL_STEPS} (${MINI_GAME_SUBCATEGORIES[miniStep]})`;

    return (
      <main className={`page theme-${theme}`}>
        {passwordRecoveryBanner}
        <section className="filters">
          <h3 className="section-title">Onboarding Questionnaire</h3>
          <p className="small-note">{subtitle}</p>
          <div className="progress-track" aria-hidden="true">
            <div
              className="progress-fill"
              style={{
                width: `${((step + 1) / ONBOARDING_TOTAL_STEPS) * 100}%`,
              }}
            />
          </div>

          {isQuestionnaireStep ? (
            renderQuestion(onboardingQuestionnaire[step])
          ) : (
            <OnboardingMiniGames step={miniStep} value={gamesValue} onChange={setMiniGameAnswers} />
          )}

          <div className="actions-row">
            <button type="button" onClick={retreatOnboardingStep} disabled={step === 0}>
              Back
            </button>
            {step < ONBOARDING_TOTAL_STEPS - 1 ? (
              <button type="button" onClick={advanceOnboardingStep}>
                Next
              </button>
            ) : (
              <button type="button" onClick={finishOnboarding}>
                Finish onboarding
              </button>
            )}
            <button type="button" onClick={skipOnboarding}>
              Skip
            </button>
          </div>
          {authMessage && !passwordRecoveryMode ? <p className="auth-status">{authMessage}</p> : null}
        </section>
      </main>
    );
  }

  const homePageActive =
    !profilePageOpen &&
    !messagesPageOpen &&
    !searchPageOpen &&
    !apartmentsPageOpen &&
    !aiChatPageOpen &&
    !utilitiesPageOpen;

  return (
    <main
      className={`page page-with-menu theme-${theme}${messagesPageOpen ? " messages-full-page" : ""}`}
    >
      {passwordRecoveryBanner}
      <aside className="user-menu" aria-label="User menu">
        <button
          type="button"
          className={`user-menu-icon-button${homePageActive ? " active" : ""}`}
          onClick={() => {
            setProfilePageOpen(false);
            setMessagesPageOpen(false);
            setSearchPageOpen(false);
            setApartmentsPageOpen(false);
            setAiChatPageOpen(false);
            setUtilitiesPageOpen(false);
            setOnboardingEditorOpen(false);
            setQuestionIndex(0);
          }}
          aria-label="Home / Matching"
        >
          <span className="user-menu-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 10.5V21h14V10.5" />
            </svg>
          </span>
          <span className="menu-label">Home</span>
        </button>

        <button
          type="button"
          className={`user-menu-icon-button${messagesPageOpen ? " active" : ""}`}
          onClick={() => {
            setMessagesPageOpen(true);
            setProfilePageOpen(false);
            setSearchPageOpen(false);
            setApartmentsPageOpen(false);
            setAiChatPageOpen(false);
            setUtilitiesPageOpen(false);
            setOnboardingEditorOpen(false);
          }}
          aria-label="Messages"
        >
          <span className="user-menu-icon-wrapper" aria-hidden="true">
            <span className="user-menu-icon">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16v11H7l-3 3V4z" />
              </svg>
            </span>
            {unreadMessageCount > 0 ? (
              <span className="menu-badge">
                {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
              </span>
            ) : null}
          </span>
          <span className="menu-label">Messages</span>
        </button>

        <button
          type="button"
          className={`user-menu-icon-button${searchPageOpen ? " active" : ""}`}
          onClick={() => {
            setSearchPageOpen(true);
            setMessagesPageOpen(false);
            setProfilePageOpen(false);
            setAiChatPageOpen(false);
            setApartmentsPageOpen(false);
            setUtilitiesPageOpen(false);
            setOnboardingEditorOpen(false);
          }}
          aria-label="Search users"
        >
          <span className="user-menu-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="6" />
              <path d="m16 16 4 4" />
            </svg>
          </span>
          <span className="menu-label">Search</span>
        </button>

        <button
          type="button"
          className={`user-menu-icon-button${aiChatPageOpen ? " active" : ""}`}
          onClick={() => {
            setAiChatPageOpen(true);
            setMessagesPageOpen(false);
            setSearchPageOpen(false);
            setApartmentsPageOpen(false);
            setProfilePageOpen(false);
            setUtilitiesPageOpen(false);
            setOnboardingEditorOpen(false);
          }}
          aria-label="RoomAi chatbot"
        >
          <span className="user-menu-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="14" rx="3" />
              <path d="M9 20h6" />
              <path d="M12 17v3" />
              <circle cx="9" cy="9" r="1" />
              <circle cx="15" cy="9" r="1" />
            </svg>
          </span>
          <span className="menu-label">AI Chat</span>
        </button>

        <button
          type="button"
          className={`user-menu-icon-button${utilitiesPageOpen ? " active" : ""}`}
          aria-label="Utilities"
          onClick={() => {
            setUtilitiesPageOpen(true);
            setMessagesPageOpen(false);
            setSearchPageOpen(false);
            setApartmentsPageOpen(false);
            setAiChatPageOpen(false);
            setProfilePageOpen(false);
            setOnboardingEditorOpen(false);
          }}
        >
          <span className="user-menu-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
          </span>
          <span className="menu-label">Utilities</span>
        </button>

        <div className="settings-anchor" ref={notificationsContainerRef}>
          <button
            type="button"
            ref={notificationsButtonRef}
            className={`user-menu-icon-button${notificationsOpen ? " active" : ""}`}
            onClick={() => setNotificationsOpen((prev) => !prev)}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <span className="user-menu-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </span>
            <span className="menu-label">Notifications</span>
          </button>
          {notificationsOpen ? (
            <div
              className="settings-popover"
              role="dialog"
              aria-label="Notifications"
              style={{
                top: `${notificationsPopoverPos.top}px`,
                left: `${notificationsPopoverPos.left}px`,
              }}
            >
              <h4>Notifications</h4>
              <p className="small-note">No notifications for now.</p>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className={`user-menu-icon-button${apartmentsPageOpen ? " active" : ""}`}
          onClick={() => {
            setApartmentsPageOpen(true);
            setMessagesPageOpen(false);
            setSearchPageOpen(false);
            setAiChatPageOpen(false);
            setProfilePageOpen(false);
            setUtilitiesPageOpen(false);
            setOnboardingEditorOpen(false);
          }}
          aria-label="Apartments near me"
        >
          <span className="user-menu-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="8" width="7" height="11" />
              <rect x="14" y="5" width="7" height="14" />
              <path d="M3 8l3-3h4l3 3" />
              <path d="M14 5l2-2h3l2 2" />
            </svg>
          </span>
          <span className="menu-label">Apartments</span>
        </button>

        <button
          type="button"
          className={`user-menu-icon-button${profilePageOpen ? " active" : ""}`}
          onClick={() => {
            setProfilePageOpen(true);
            setOnboardingEditorOpen(false);
            setMessagesPageOpen(false);
            setSearchPageOpen(false);
            setAiChatPageOpen(false);
            setApartmentsPageOpen(false);
            setUtilitiesPageOpen(false);
            setQuestionIndex(0);
          }}
          aria-label="Account profile"
        >
          <span className="user-menu-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="10" r="3" />
              <path d="M8 20a4 4 0 0 1 8 0" />
            </svg>
          </span>
          <span className="menu-label">Profile</span>
        </button>
      </aside>

      <div className={`page-content${messagesPageOpen ? " messages-page-content" : ""}`}>
      <header className="hero">
        <img
          className="hero-logo"
          src="/roomai_logo.png"
          alt="RoomAi"
          width={400}
          height={400}
          onClick={() => {
            window.location.href = "/";
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              window.location.href = "/";
            }
          }}
        />
        <h1>
          {aiChatPageOpen
            ? "RoomAi Assistant"
            : apartmentsPageOpen
              ? "Apartments near me"
              : messagesPageOpen
                ? "Messages"
                : searchPageOpen
                  ? "Search users"
                  : utilitiesPageOpen
                    ? "Utilities"
                    : profilePageOpen
                      ? "Your profile"
                      : ""}
        </h1>
        <p>
          {aiChatPageOpen
            ? "Chat with the RoomAi Assistant. This is a demo chatbot without access to your real data."
            : apartmentsPageOpen
              ? "Suggested apartments based on your current location."
              : messagesPageOpen
                ? "Message your matches. New messages appear here after refresh."
                : searchPageOpen
                  ? "Search for other users by name."
                  : utilitiesPageOpen
                    ? "Open a utility by clicking on the icon."
                    : profilePageOpen
                      ? "Edit your account, review your questionnaire answers, or delete your account."
                      : ""}
        </p>
      </header>

      {profilePageOpen ? (
        <section className="filters">
          <h3 className="section-title">Account</h3>
          <div className="auth-row">
            <p className="auth-status">Signed in as {sessionEmail}</p>
            <div className="header-actions">
              <button type="button" className="theme-toggle" onClick={toggleTheme}>
                {theme === "sunny" ? "Night Vibe" : "Sunny Vibe"}
              </button>
              <button type="button" onClick={handleSignOut} disabled={authLoading}>
                {authLoading ? "Please wait..." : "Sign out"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {aiChatPageOpen ? (
        <section className="filters ai-chat-panel">
          <p className="small-note">
            This is a local demo chatbot. It doesn’t call a real AI service yet.
          </p>

          <div className="message-history ai-chat-history">
            {aiChatMessages.length === 0 ? (
              <p className="ai-chat-empty-prompt">
                Say hi and tell the assistant what you’re trying to figure out.
              </p>
            ) : (
              aiChatMessages.map((m) => (
                <div
                  key={m.id}
                  className={m.from === "user" ? "message-row mine" : "message-row"}
                >
                  <div className="message-bubble">
                    <div className="message-body">{m.body}</div>
                    <div className="message-time">
                      {new Date(m.at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="message-composer">
            <input
              type="text"
              value={aiChatDraft}
              onChange={(e) => setAiChatDraft(e.target.value)}
              placeholder="Ask RoomAi Assistant anything..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAiChatSend();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAiChatSend}
              disabled={!aiChatDraft.trim()}
            >
              Send
            </button>
          </div>
        </section>
      ) : apartmentsPageOpen ? (
        <section className="filters">
          <p className="small-note">
            {locationStatus === "ready"
              ? "Using your current location."
              : "Trying your current location first, then falling back to onboarding area."}
          </p>
          <p className="small-note">Showing listings for: {searchedLocationLabel}</p>

          <div className="message-composer">
            <input
              type="text"
              value={apartmentSearchText}
              onChange={(e) => setApartmentSearchText(e.target.value)}
              placeholder="Enter city, neighborhood, or zip"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApartmentSearch();
                }
              }}
            />
            <button
              type="button"
              onClick={handleApartmentSearch}
              disabled={apartmentsLoading}
            >
              {apartmentsLoading ? "Searching..." : "Find apartments"}
            </button>
            <button
              type="button"
              onClick={resolveCurrentLocation}
              disabled={locationStatus === "resolving"}
            >
              {locationStatus === "resolving" ? "Locating..." : "Use my location"}
            </button>
          </div>
          {locationStatus === "denied" ? (
            <p className="small-note">
              Location permission denied. Showing apartments near your onboarding area instead.
            </p>
          ) : null}
          {locationStatus === "unsupported" ? (
            <p className="small-note">
              Geolocation isn’t supported in this browser. Showing fallback results.
            </p>
          ) : null}

          <div className="results">
            {apartmentsLoading && apartmentResults.length === 0 ? (
              <p className="small-note">Searching…</p>
            ) : apartmentResults.length === 0 ? (
              <p className="small-note">No apartments found. Try a different search.</p>
            ) : (
              apartmentResults.map((a) => (
                <article key={a.id} className="card">
                  <div className="card-top">
                    <div>
                      <h2>{a.name}</h2>
                      <p>{a.address}</p>
                    </div>
                    <span className="score">
                      {a.priceLabel}
                    </span>
                  </div>

                  <div className="meta">
                    <span>{a.bedroomsLabel}</span>
                    {a.distanceMiles != null ? (
                      <span>{a.distanceMiles.toFixed(1)} miles away</span>
                    ) : (
                      <span>Distance unavailable</span>
                    )}
                  </div>
                  {a.websiteUrl ? (
                    <p>
                      <a href={a.websiteUrl} target="_blank" rel="noreferrer">
                        Visit apartment website
                      </a>
                    </p>
                  ) : (
                    <p className="small-note">Website unavailable for this listing.</p>
                  )}
                  {a.source === "rentcast" ? (
                    <p className="small-note">Live rental data from the RentCast API.</p>
                  ) : null}
                  {a.source === "mock" ? (
                    <p className="small-note">
                      Real-time listings were unavailable, so fallback results are shown.
                    </p>
                  ) : null}

                  <ul>
                    {a.highlights.map((h) => (
                      <li key={h} className="pill">
                        {h}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </div>

        </section>
      ) : searchPageOpen ? (
        <section className="filters">
          <p className="small-note">Search other users by full name or username.</p>

          <div className="message-composer">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type a name to search…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleUserSearch();
                }
              }}
            />
            <button type="button" onClick={handleUserSearch} disabled={searchLoading}>
              {searchLoading ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="results">
            {searchLoading && searchResults.length === 0 ? (
              <p className="small-note">Searching…</p>
            ) : searchResults.length === 0 ? (
              <p className="small-note">No users found yet.</p>
            ) : (
              searchResults.map((user) => (
                <article key={user.user_id} className="card">
                  <div className="card-top">
                    <div>
                      <h2>{user.display_name ?? "Unnamed user"}</h2>
                      {user.username ? <p>@{user.username}</p> : null}
                      {user.city ? <p>{user.city}</p> : null}
                    </div>
                    <div className="actions-row" style={{ justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="candidate-message-btn"
                        onClick={() =>
                          void openMessageFromCandidate({
                            id: user.user_id,
                            name: user.display_name ?? user.username ?? "there",
                          })
                        }
                      >
                        Message
                      </button>
                    </div>
                  </div>
                  {user.bio ? <p>{user.bio}</p> : null}
                </article>
              ))
            )}
          </div>
        </section>
      ) : messagesPageOpen ? (
        <section className="messages-screen">
          <div className="messages-layout">
            <div className="conversation-list" aria-label="Conversation list">
              <h4 className="messages-pane-title">Conversations</h4>
              {messagesLoading && conversations.length === 0 ? (
                <p className="small-note">Loading conversations...</p>
              ) : conversations.length === 0 ? (
                <p className="small-note">No conversations yet.</p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={
                      selectedConversationId === c.id ? "conversation-item active" : "conversation-item"
                    }
                    onClick={() => setSelectedConversationId(c.id)}
                  >
                    <div className="conversation-main">
                      <div className="conversation-avatar-wrap" aria-hidden="true">
                        {c.other_photo_url ? (
                          <img className="conversation-avatar" src={c.other_photo_url} alt="" />
                        ) : (
                          <div className="conversation-avatar conversation-avatar-fallback">
                            {(c.other_display_name ?? "Roommate")
                              .split(" ")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase())
                              .join("")}
                          </div>
                        )}
                      </div>
                      <div className="conversation-text">
                        <div className="conversation-title">
                          {c.other_display_name ?? "Roommate"}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="message-thread" aria-label="Message thread">
              <h4 className="messages-pane-title">Selected conversation</h4>
              {!selectedConversationId ? (
                <p className="small-note">Select a conversation.</p>
              ) : messagesLoading ? (
                <p className="small-note">Loading messages...</p>
              ) : (
                <>
                  <div className="message-history">
                    {messages.length === 0 ? (
                      <p className="small-note">No messages yet.</p>
                    ) : (
                      messages.map((m) => {
                        const isMine = currentUserId && m.sender_user_id === currentUserId;
                        return (
                          <div
                            key={m.id}
                            className={isMine ? "message-row mine" : "message-row"}
                          >
                            <div className="message-bubble">
                              <div className="message-body">{m.body}</div>
                              <div className="message-time">
                                {new Date(m.sent_at).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="message-composer">
                    <input
                      type="text"
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={messageSending || !messageDraft.trim()}
                    >
                      {messageSending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      ) : utilitiesPageOpen ? (
        <UtilitiesPanel />
      ) : profilePageOpen ? (
        <section className="filters">
          <h3 className="section-title">Profile</h3>
          <p className="small-note">Edit your account and questionnaire answers.</p>

          <fieldset>
            <legend>Account</legend>
            <label>
              Profile photo
              {profilePhotoUrl ? (
                <button
                  type="button"
                  className="profile-photo-thumb-button"
                  onClick={() => setProfilePhotoExpanded(true)}
                  aria-label="View profile photo larger"
                >
                  <img src={profilePhotoUrl} alt="" />
                </button>
              ) : (
                <p className="small-note">No photo uploaded yet.</p>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoFileChange}
                disabled={photoUploading}
              />
            </label>
            <div className="name-row">
              <label>
                First name
                <input
                  type="text"
                  value={profileFirstName}
                  onChange={(e) => setProfileFirstName(e.target.value)}
                  placeholder="Jane"
                />
              </label>
              <label>
                Last name
                <input
                  type="text"
                  value={profileLastName}
                  onChange={(e) => setProfileLastName(e.target.value)}
                  placeholder="Doe"
                />
              </label>
            </div>
            <label>
              Date of birth
              <input
                type="date"
                value={profileBirthdate}
                onChange={(e) => setProfileBirthdate(e.target.value)}
                min={minBirthdateForMaxAge(120)}
                max={maxBirthdateForMinAge(18)}
              />
            </label>
            {profileBirthdate ? (
              <p className="small-note">
                Age: {calculateAgeFromBirthdate(profileBirthdate) ?? "—"} (saved from birthdate)
              </p>
            ) : null}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={profileVisibleToOthers}
                onChange={(e) => setProfileVisibleToOthers(e.target.checked)}
              />
              <span>
                Show my profile to other users and include me in roommate recommendations and search
              </span>
            </label>
            <p className="small-note">
              When off, your profile is hidden from discovery; you can still use the app and edit settings.
            </p>

            <div className="actions-row">
              <button type="button" onClick={handleSaveProfile} disabled={profileSaving}>
                {profileSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend>Questionnaire answers</legend>
            {!onboardingEditorOpen ? (
              <>
                <p className="small-note">
                  Review and edit answers question-by-question.
                </p>
                <div className="answers-review" aria-label="Current questionnaire answers">
                  {onboardingQuestionnaire.map((q) => (
                    <div className="answer-summary-row" key={q.id}>
                      <div className="answer-summary-prompt">{q.prompt}</div>
                      <div className="answer-summary-value">
                        {formatAnswerForReview(q, onboardingAnswers[q.id] ?? null)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="actions-row">
                  <button
                    type="button"
                    onClick={() => {
                      setOnboardingEditorOpen(true);
                      setQuestionIndex(0);
                    }}
                  >
                    Review / Edit answers
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="small-note">
                  Question {questionIndex + 1} of {onboardingQuestionnaire.length} (
                  {currentQuestion.category})
                </p>
                <div className="progress-track" aria-hidden="true">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${((questionIndex + 1) / onboardingQuestionnaire.length) * 100}%`,
                    }}
                  />
                </div>
                {renderQuestion(currentQuestion)}
                <div className="actions-row">
                  <button
                    type="button"
                    onClick={() => {
                      setOnboardingEditorOpen(false);
                      setQuestionIndex(0);
                    }}
                  >
                    Back to profile
                  </button>
                  {questionIndex < onboardingQuestionnaire.length - 1 ? (
                    <button type="button" onClick={nextQuestion}>
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        saveOnboardingEdits();
                        setOnboardingEditorOpen(false);
                      }}
                    >
                      Save answers
                    </button>
                  )}
                </div>
                {questionIndex > 0 ? (
                  <div className="actions-row" style={{ justifyContent: "flex-start" }}>
                    <button type="button" onClick={previousQuestion}>
                      Back
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </fieldset>

          <div className="actions-row" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="danger-button"
              onClick={handleDeleteAccount}
              disabled={authLoading}
            >
              {authLoading ? "Please wait..." : "Delete account"}
            </button>
          </div>
        </section>
      ) : !onboardingComplete ? (
        (() => {
          const step = onboardingStepIndex;
          const isQuestionnaireStep = step < ONBOARDING_QUESTIONNAIRE_LEN;
          const miniStep = (step - ONBOARDING_QUESTIONNAIRE_LEN) as 0 | 1 | 2;
          const gamesValue = miniGameAnswers ?? createDefaultMiniGames(onboardingAnswers);
          const subtitle = isQuestionnaireStep
            ? `Question ${step + 1} of ${ONBOARDING_TOTAL_STEPS} (${onboardingQuestionnaire[step].category})`
            : `Question ${step + 1} of ${ONBOARDING_TOTAL_STEPS} (${MINI_GAME_SUBCATEGORIES[miniStep]})`;
          return (
            <section className="filters">
              <h3 className="section-title">Onboarding Questionnaire</h3>
              <p className="small-note">{subtitle}</p>
              <div className="progress-track" aria-hidden="true">
                <div
                  className="progress-fill"
                  style={{
                    width: `${((step + 1) / ONBOARDING_TOTAL_STEPS) * 100}%`,
                  }}
                />
              </div>

              {isQuestionnaireStep ? (
                renderQuestion(onboardingQuestionnaire[step])
              ) : (
                <OnboardingMiniGames step={miniStep} value={gamesValue} onChange={setMiniGameAnswers} />
              )}

              <div className="actions-row">
                <button type="button" onClick={retreatOnboardingStep} disabled={step === 0}>
                  Back
                </button>
                {step < ONBOARDING_TOTAL_STEPS - 1 ? (
                  <button type="button" onClick={advanceOnboardingStep}>
                    Next
                  </button>
                ) : (
                  <button type="button" onClick={finishOnboarding}>
                    Finish onboarding
                  </button>
                )}
                <button type="button" onClick={skipOnboarding}>
                  Skip
                </button>
              </div>
              {authMessage ? <p className="auth-status">{authMessage}</p> : null}
            </section>
          );
        })()
      ) : (
        <>
          <section className="filters swipe-deck-section">
            <div className="swipe-deck-section-head">
              <div className="swipe-deck-section-main">
                <h3 className="section-title">Swipe Deck</h3>
                <div className="swipe-deck-section-controls">
                  <p className="small-note">
                    Choose how your deck is ordered.
                  </p>
                  <div className="actions-row" style={{ justifyContent: "flex-start" }}>
                    <button
                      type="button"
                      className={deckMode === "compatibility" ? "pill selected" : "pill"}
                      onClick={() => {
                        setDeckMode("compatibility");
                        setSwipes([]);
                      }}
                    >
                      Compatibility
                    </button>
                    <button
                      type="button"
                      className={deckMode === "location" ? "pill selected" : "pill"}
                      onClick={() => {
                        setDeckMode("location");
                        setSwipes([]);
                      }}
                    >
                      Location
                    </button>
                    <button
                      type="button"
                      className={deckMode === "random" ? "pill selected" : "pill"}
                      onClick={() => {
                        setDeckMode("random");
                        setSwipes([]);
                      }}
                    >
                      Random (all users)
                    </button>
                  </div>
                </div>
              </div>
              <div className="deck-self-card deck-self-inline" aria-label="Your profile">
                <button
                  type="button"
                  className="deck-self-photo-btn"
                  onClick={() => setProfilePhotoExpanded(true)}
                  aria-label="View your profile photo larger"
                >
                  <img className="deck-self-photo" src={selfProfilePhotoSrc} alt="" />
                </button>
                <p className="deck-self-username">
                  {userFirstName.trim() || "You"}
                </p>
              </div>
            </div>
          </section>

          <div className="main-layout-deck">
            <section className="results">
              {remainingCandidates.length === 0 ? (
                <p className="empty">No more cards left. Switch mode or refresh to see them again.</p>
              ) : (
                remainingCandidates.map((candidate) => (
                  <article key={candidate.id} className="card swipe-card">
                    {(() => {
                      const candidateFirstName = firstNameOnly(candidate.name);
                      return (
                    <div
                      className="swipe-card-main"
                      title="Click for full profile"
                      onClick={() => openDeckProfile(candidate)}
                    >
                      <div className="swipe-card-layout">
                        <div className="candidate-photo-wrap">
                          <img
                            className="candidate-photo"
                            src={
                              candidate.photoUrl ??
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(candidateFirstName)}&size=320&background=f5d7c2&color=4c2f21`
                            }
                            alt={`${candidateFirstName}'s profile`}
                            loading="lazy"
                          />
                          <div
                            className="candidate-photo-actions"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="candidate-message-btn"
                              onClick={() => void openMessageFromCandidate({ id: candidate.id, name: candidate.name })}
                            >
                              Message
                            </button>
                            <button
                              type="button"
                              className="candidate-report-btn"
                              onClick={() => openReportForCandidate(candidate)}
                            >
                              Report
                            </button>
                          </div>
                        </div>

                        <div className="swipe-card-content">
                        <div className="card-top">
                          <div>
                            <h2>
                              {candidateFirstName}, {candidate.age}
                            </h2>
                            <p>{candidate.city}</p>
                          </div>
                          {deckMode === "compatibility" ? (
                            <span className="score">
                              {candidate.compatibility.totalScore}% match
                            </span>
                          ) : null}
                        </div>

                        <p>{candidate.bio}</p>

                        <div className="meta">
                          <span>Cleanliness: {candidate.traits.cleanliness}/10</span>
                          <span>
                            Sleep:{" "}
                            {candidate.traits.sleepSchedule === "early_bird"
                              ? "Early bird"
                              : "Night owl"}
                          </span>
                          <span>{candidate.traits.petsOk ? "Pet friendly" : "No pets"}</span>
                        </div>

                        <ul>
                          {candidate.hobbies.map((hobby) => (
                            <li key={hobby} className="pill">
                              {hobby}
                            </li>
                          ))}
                        </ul>

                        {deckMode === "compatibility" ? (
                          <div className="breakdown">
                            <span>Behavior fit: {candidate.compatibility.breakdown.behaviorFit}%</span>
                            <span>
                              Preference fit: {candidate.compatibility.breakdown.preferenceFit}%
                            </span>
                            <span>
                              Lifestyle fit: {candidate.compatibility.breakdown.lifestyleFit}%
                            </span>
                            <span>
                              Rhythm &amp; communication: {candidate.compatibility.breakdown.gameFit}%
                            </span>
                          </div>
                        ) : null}
                        </div>
                      </div>
                    </div>
                      );
                    })()}

                    <div
                      className="actions-row"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn-pass"
                        onClick={() => swipeCandidate(candidate.id, "pass")}
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        className="btn-like"
                        onClick={() => swipeCandidate(candidate.id, "like")}
                      >
                        Like
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>

            <section className="filters liked-filters" aria-label="Liked profiles">
              <div className="liked-header">
                <h3 className="section-title">Liked Profiles</h3>
                <p className="small-note liked-count">{likedCandidates.length} liked</p>
              </div>
              {likedCandidates.length === 0 ? (
                <p className="small-note">No likes yet.</p>
              ) : (
                likedCandidates.map((candidate) => {
                  const candidateFirstName = firstNameOnly(candidate.name);
                  const cityText = (candidate.city ?? "").trim();
                  const likedCityLabel =
                    cityText.length > 0
                      ? cityText
                      : uuidLooksLikeUserId(candidate.id)
                        ? "Denver, CO"
                        : candidate.city;
                  return (
                    <div className="liked-row" key={candidate.id}>
                      <button
                        type="button"
                        className="liked-row-main liked-row-clickable"
                        aria-label={`View ${candidateFirstName}'s full profile`}
                        onClick={() => openDeckProfile(candidate)}
                      >
                        <span>
                          {candidateFirstName} ({likedCityLabel})
                        </span>
                        <strong>
                          {deckMode === "compatibility"
                            ? `${candidate.compatibility.totalScore}%`
                            : "Liked"}
                        </strong>
                      </button>
                      <button
                        type="button"
                        className="liked-remove-btn"
                        aria-label={`Remove ${candidateFirstName} from liked profiles`}
                        onClick={() =>
                          setRemoveLikeTarget({ id: candidate.id, name: candidateFirstName })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  );
                })
              )}
            </section>
          </div>
        </>
      )}
      </div>

      {deckProfileCandidate ? (
        <div
          className="deck-profile-backdrop"
          role="presentation"
          onClick={closeDeckProfile}
        >
          <div
            className="deck-profile-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-profile-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="deck-profile-close"
              onClick={closeDeckProfile}
              aria-label="Close profile"
            >
              <span aria-hidden="true">×</span>
            </button>

            <div className="deck-profile-hero">
              <img
                className="deck-profile-photo"
                src={
                  deckProfileCandidate.photoUrl ??
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(deckProfileCandidate.name)}&size=480&background=f5d7c2&color=4c2f21`
                }
                alt=""
              />
              <div className="deck-profile-hero-text">
                <h2 id="deck-profile-title" className="deck-profile-name">
                  {firstNameOnly(deckProfileCandidate.name)}, {deckProfileCandidate.age}
                </h2>
                <p className="deck-profile-city">{deckProfileCandidate.city}</p>
                {deckMode === "compatibility" ? (
                  <p className="deck-profile-match-pill">
                    {deckProfileCandidate.compatibility.totalScore}% match with you
                  </p>
                ) : null}
              </div>
            </div>

            <div className="deck-profile-body">
              <section className="deck-profile-section">
                <h3 className="deck-profile-section-title">About</h3>
                <p className="deck-profile-bio">{deckProfileCandidate.bio}</p>
              </section>

              {deckMode === "compatibility" ? (
                <section className="deck-profile-section">
                  <h3 className="deck-profile-section-title">Match breakdown</h3>
                  <div className="deck-profile-breakdown-grid">
                    <span>Behavior fit: {deckProfileCandidate.compatibility.breakdown.behaviorFit}%</span>
                    <span>
                      Preference fit: {deckProfileCandidate.compatibility.breakdown.preferenceFit}%
                    </span>
                    <span>Lifestyle fit: {deckProfileCandidate.compatibility.breakdown.lifestyleFit}%</span>
                    <span>
                      Rhythm &amp; communication: {deckProfileCandidate.compatibility.breakdown.gameFit}%
                    </span>
                  </div>
                </section>
              ) : null}

              <section className="deck-profile-section">
                <h3 className="deck-profile-section-title">Living style</h3>
                <ul className="deck-profile-trait-grid">
                  <li>
                    <span className="deck-profile-trait-label">Cleanliness</span>
                    <span className="deck-profile-trait-value">
                      {deckProfileCandidate.traits.cleanliness}/10
                    </span>
                  </li>
                  <li>
                    <span className="deck-profile-trait-label">Social energy</span>
                    <span className="deck-profile-trait-value">
                      {deckProfileCandidate.traits.socialEnergy}/10
                    </span>
                  </li>
                  <li>
                    <span className="deck-profile-trait-label">Noise tolerance</span>
                    <span className="deck-profile-trait-value">
                      {deckProfileCandidate.traits.noiseTolerance}/10
                    </span>
                  </li>
                  <li>
                    <span className="deck-profile-trait-label">Sleep</span>
                    <span className="deck-profile-trait-value">
                      {deckProfileCandidate.traits.sleepSchedule === "early_bird"
                        ? "Early bird"
                        : "Night owl"}
                    </span>
                  </li>
                  <li>
                    <span className="deck-profile-trait-label">Pets</span>
                    <span className="deck-profile-trait-value">
                      {deckProfileCandidate.traits.petsOk ? "Comfortable with pets" : "Prefers no pets"}
                    </span>
                  </li>
                  <li>
                    <span className="deck-profile-trait-label">Conflict style</span>
                    <span className="deck-profile-trait-value">
                      Directness {deckProfileCandidate.traits.conflictDirectness}/10
                    </span>
                  </li>
                  <li>
                    <span className="deck-profile-trait-label">Routine flexibility</span>
                    <span className="deck-profile-trait-value">
                      {deckProfileCandidate.traits.routineFlexibility}/10
                    </span>
                  </li>
                </ul>
              </section>

              <section className="deck-profile-section">
                <h3 className="deck-profile-section-title">Typical week at home</h3>
                <p className="deck-profile-week-intro">
                  How they’d like to spend time in a shared home (out of 100).
                </p>
                <ul className="deck-profile-week-bars" aria-label="Week at home split">
                  {DECK_PROFILE_WEEK_KEYS.map((key) => {
                    const pct = deckProfileCandidate.traits.homeWeekSplit[key];
                    return (
                      <li key={key}>
                        <div className="deck-profile-week-row">
                          <span className="deck-profile-week-label">{DECK_PROFILE_WEEK_LABELS[key]}</span>
                          <span className="deck-profile-week-pct">{pct}%</span>
                        </div>
                        <div className="deck-profile-week-track">
                          <div
                            className="deck-profile-week-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="deck-profile-section">
                <h3 className="deck-profile-section-title">Interests</h3>
                <ul className="deck-profile-hobbies">
                  {deckProfileCandidate.hobbies.map((hobby) => (
                    <li key={hobby} className="pill">
                      {hobby}
                    </li>
                  ))}
                </ul>
              </section>

              <div className="deck-profile-actions">
                <button
                  type="button"
                  className="candidate-message-btn"
                  onClick={() =>
                    void openMessageFromCandidate({
                      id: deckProfileCandidate.id,
                      name: deckProfileCandidate.name,
                    })
                  }
                >
                  Message
                </button>
                <button
                  type="button"
                  className="candidate-report-btn"
                  onClick={() => openReportForCandidate(deckProfileCandidate)}
                >
                  Report
                </button>
                {remainingCandidates.some((c) => c.id === deckProfileCandidate.id) ? (
                  <div className="deck-profile-swipe-row">
                    <button
                      type="button"
                      className="btn-pass"
                      onClick={() => {
                        swipeCandidate(deckProfileCandidate.id, "pass");
                        closeDeckProfile();
                      }}
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      className="btn-like"
                      onClick={() => {
                        swipeCandidate(deckProfileCandidate.id, "like");
                        closeDeckProfile();
                      }}
                    >
                      Like
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {removeLikeTarget ? (
        <div
          className="report-modal-backdrop"
          role="presentation"
          onClick={() => setRemoveLikeTarget(null)}
        >
          <div
            className="report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-like-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="report-modal-close"
              onClick={() => setRemoveLikeTarget(null)}
              aria-label="Close dialog"
            >
              <span aria-hidden="true">×</span>
            </button>
            <h2 id="remove-like-modal-title" className="report-modal-title">
              Remove from liked profiles?
            </h2>
            <p className="report-modal-hint">
              {removeLikeTarget.name} will be removed from your liked list. You can like them again from
              the deck.
            </p>
            <div className="report-modal-actions">
              <button
                type="button"
                className="report-cancel-btn"
                onClick={() => setRemoveLikeTarget(null)}
              >
                Cancel
              </button>
              <button type="button" className="danger-button" onClick={confirmRemoveLikedProfile}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reportTarget ? (
        <div
          className="report-modal-backdrop"
          role="presentation"
          onClick={closeReportModal}
        >
          <div
            className="report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="report-modal-close"
              onClick={closeReportModal}
              disabled={reportSending}
              aria-label="Close report dialog"
            >
              <span aria-hidden="true">×</span>
            </button>
            <h2 id="report-modal-title" className="report-modal-title">
              Report {reportTarget.name}
            </h2>
            <p className="report-modal-hint">
              Reports are reviewed by our team. False reports may affect your account.
            </p>
            <label className="report-field-label" htmlFor="report-reason">
              Reason
            </label>
            <select
              id="report-reason"
              className="report-reason-select"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value as ReportReasonId)}
            >
              {REPORT_REASON_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label className="report-field-label" htmlFor="report-details">
              Details (optional)
            </label>
            <textarea
              id="report-details"
              className="report-details-input"
              rows={4}
              maxLength={2000}
              placeholder="Add context that helps us review this report…"
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
            />
            <div className="report-modal-actions">
              <button
                type="button"
                className="report-cancel-btn"
                onClick={closeReportModal}
                disabled={reportSending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="report-submit-btn"
                onClick={() => void submitUserReport()}
                disabled={reportSending}
              >
                {reportSending ? "Sending…" : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {profilePhotoExpanded ? (
        <div
          className="profile-photo-lightbox-backdrop"
          role="presentation"
          onClick={() => setProfilePhotoExpanded(false)}
        >
          <div
            className="profile-photo-lightbox-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Enlarged profile photo"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="profile-photo-lightbox-close"
              onClick={() => setProfilePhotoExpanded(false)}
              aria-label="Close enlarged photo"
            >
              <span aria-hidden="true">×</span>
            </button>
            <img
              className="profile-photo-lightbox-img"
              src={selfProfilePhotoExpandedSrc}
              alt="Your profile photo"
            />
            <div className="profile-photo-lightbox-actions">
              <button type="button" onClick={handleSignOut} disabled={authLoading}>
                {authLoading ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
