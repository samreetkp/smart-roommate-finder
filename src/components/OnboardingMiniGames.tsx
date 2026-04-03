import { useMemo } from "react";
import { EVENING_CARD_LABELS, SCENARIO_PROMPTS } from "../data/miniGameScenarios";
import { normalizeHomeWeek } from "../lib/compatibility";
import type { MiniGameAnswers } from "../types/miniGames";
import type { HomeWeekSplit } from "../types/matching";

const WEEK_KEYS = [
  "sharedHangout",
  "soloRecharge",
  "quietWorkStudy",
  "guestsVisitors",
  "choresShared",
] as const;

const WEEK_LABELS: Record<(typeof WEEK_KEYS)[number], string> = {
  sharedHangout: "Shared meals / hangouts",
  soloRecharge: "Solo recharge",
  quietWorkStudy: "Quiet work or study",
  guestsVisitors: "Guests & visitors",
  choresShared: "Chores & errands together",
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function adjustWeekBucket(prev: HomeWeekSplit, key: (typeof WEEK_KEYS)[number], value: number): HomeWeekSplit {
  const v = clamp(Math.round(value), 8, 88);
  const rest = 100 - v;
  const others = WEEK_KEYS.filter((k) => k !== key);
  const sumOthers = others.reduce((s, k) => s + prev[k], 0);
  const next = { ...prev, [key]: v };
  if (sumOthers <= 0) {
    const eq = Math.floor(rest / others.length);
    for (const k of others) next[k] = eq;
  } else {
    const scale = rest / sumOthers;
    for (const k of others) {
      next[k] = Math.max(4, Math.round(prev[k] * scale));
    }
  }
  return normalizeHomeWeek(next);
}

type Props = {
  step: 0 | 1 | 2;
  value: MiniGameAnswers;
  onChange: (next: MiniGameAnswers) => void;
};

export function OnboardingMiniGames({ step, value, onChange }: Props) {
  const totalWeek = useMemo(
    () => WEEK_KEYS.reduce((s, k) => s + value.weekBudget[k], 0),
    [value.weekBudget]
  );

  if (step === 0) {
    return (
      <div className="mini-game">
        <h4 className="mini-game-title">Your week at home</h4>
        <p className="small-note">
          Move the sliders so the five buckets add up to how you&apos;d spend a typical week at home (we keep
          the total at 100 points).
        </p>
        <div className="week-budget-grid">
          {WEEK_KEYS.map((key) => (
            <label key={key} className="week-budget-row">
              <span className="week-budget-label">{WEEK_LABELS[key]}</span>
              <input
                type="range"
                min={4}
                max={92}
                value={value.weekBudget[key]}
                onChange={(e) =>
                  onChange({
                    ...value,
                    weekBudget: adjustWeekBucket(value.weekBudget, key, Number(e.target.value)),
                  })
                }
              />
              <span className="week-budget-num">{value.weekBudget[key]}</span>
            </label>
          ))}
        </div>
        <p className="week-budget-total" aria-live="polite">
          Total: {totalWeek} / 100
        </p>
      </div>
    );
  }

  if (step === 1) {
    const order = value.eveningOrder;

    function moveUp(i: number) {
      if (i <= 0) return;
      const next = [...order];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      onChange({ ...value, eveningOrder: next });
    }

    function moveDown(i: number) {
      if (i >= order.length - 1) return;
      const next = [...order];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      onChange({ ...value, eveningOrder: next });
    }

    return (
      <div className="mini-game">
        <h4 className="mini-game-title">Typical evening order</h4>
        <p className="small-note">
          Order these from what usually happens <strong>first</strong> in your evening to what happens{" "}
          <strong>later</strong> (not exact times—just relative order).
        </p>
        <ol className="evening-order-list">
          {order.map((id, i) => (
            <li key={`${id}-${i}`} className="evening-order-item">
              <span className="evening-order-label">{EVENING_CARD_LABELS[id] ?? id}</span>
              <span className="evening-order-actions">
                <button type="button" onClick={() => moveUp(i)} disabled={i === 0} aria-label="Move up">
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === order.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
        <p className="small-note">
          Tip: more reordering vs the default suggests a more flexible routine—we use that lightly in
          matching.
        </p>
      </div>
    );
  }

  return (
    <div className="mini-game">
      <h4 className="mini-game-title">Quick scenarios</h4>
      <p className="small-note">Pick what you&apos;d most likely do, then how annoyed you&apos;d feel.</p>
      <div className="scenario-stack">
        {SCENARIO_PROMPTS.map((sc) => {
          const row = value.scenarios.find((s) => s.id === sc.id) ?? {
            id: sc.id,
            choiceId: sc.choices[0]?.id ?? "",
            annoyance: 3 as const,
          };
          return (
            <fieldset key={sc.id} className="scenario-card">
              <legend>{sc.title}</legend>
              <p className="scenario-body">{sc.body}</p>
              <div className="scenario-choices">
                {sc.choices.map((ch) => (
                  <label key={ch.id} className="scenario-choice">
                    <input
                      type="radio"
                      name={`scenario-${sc.id}`}
                      checked={row.choiceId === ch.id}
                      onChange={() => {
                        const scenarios = value.scenarios.map((s) =>
                          s.id === sc.id ? { ...s, choiceId: ch.id } : s
                        );
                        if (!scenarios.some((s) => s.id === sc.id)) {
                          scenarios.push({ id: sc.id, choiceId: ch.id, annoyance: row.annoyance });
                        }
                        onChange({ ...value, scenarios });
                      }}
                    />
                    {ch.label}
                  </label>
                ))}
              </div>
              <label className="scenario-annoy">
                Annoyance if this kept happening:{" "}
                <select
                  value={row.annoyance}
                  onChange={(e) => {
                    const n = Number(e.target.value) as 1 | 2 | 3 | 4 | 5;
                    const scenarios = value.scenarios.map((s) =>
                      s.id === sc.id ? { ...s, annoyance: n } : s
                    );
                    if (!scenarios.some((s) => s.id === sc.id)) {
                      scenarios.push({ id: sc.id, choiceId: row.choiceId, annoyance: n });
                    }
                    onChange({ ...value, scenarios });
                  }}
                >
                  {[1, 2, 3, 4, 5].map((x) => (
                    <option key={x} value={x}>
                      {x} — {x <= 2 ? "mild" : x === 3 ? "medium" : "strong"}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
