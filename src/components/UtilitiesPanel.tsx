import { useCallback, useEffect, useId, useMemo, useState } from "react";

const RENT_KEY = "roomai_utilities_rent_v1";
const CHORE_KEY = "roomai_utilities_chores_v1";
const SUPPLIES_KEY = "roomai_utilities_supplies_v1";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const DEFAULT_CHORES = [
  "Trash & recycling",
  "Kitchen / dishes",
  "Vacuum & floors",
  "Shared bathroom",
];

type UtilityChoice = "rent" | "chores" | "supplies";

type RentState = {
  monthlyRent: string;
  roommateCount: number;
  extras: string;
};

type ChoreRow = { id: string; label: string; done: boolean[] };

function loadRent(): RentState {
  try {
    const raw = localStorage.getItem(RENT_KEY);
    if (!raw) return { monthlyRent: "", roommateCount: 2, extras: "" };
    const p = JSON.parse(raw) as Partial<RentState>;
    return {
      monthlyRent: typeof p.monthlyRent === "string" ? p.monthlyRent : "",
      roommateCount:
        typeof p.roommateCount === "number" && p.roommateCount >= 1 && p.roommateCount <= 12
          ? p.roommateCount
          : 2,
      extras: typeof p.extras === "string" ? p.extras : "",
    };
  } catch {
    return { monthlyRent: "", roommateCount: 2, extras: "" };
  }
}

function loadChores(): ChoreRow[] {
  try {
    const raw = localStorage.getItem(CHORE_KEY);
    if (!raw) {
      return DEFAULT_CHORES.map((label, i) => ({
        id: `c${i}`,
        label,
        done: DAYS.map(() => false),
      }));
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error("bad shape");
    return parsed.map((row, i) => {
      const r = row as { id?: string; label?: string; done?: boolean[] };
      const done =
        Array.isArray(r.done) && r.done.length === 7
          ? r.done.map((b) => Boolean(b))
          : DAYS.map(() => false);
      return {
        id: typeof r.id === "string" ? r.id : `c${i}`,
        label: typeof r.label === "string" ? r.label : DEFAULT_CHORES[i] ?? "Chore",
        done,
      };
    });
  } catch {
    return DEFAULT_CHORES.map((label, i) => ({
      id: `c${i}`,
      label,
      done: DAYS.map(() => false),
    }));
  }
}

type SupplyRow = { id: string; text: string; done: boolean };

function loadSupplies(): SupplyRow[] {
  const defaults = ["Paper towels", "Dish soap", "Trash bags"];
  try {
    const raw = localStorage.getItem(SUPPLIES_KEY);
    if (!raw) {
      return defaults.map((text, i) => ({ id: `s${i}`, text, done: false }));
    }
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p
      .map((row, i) => {
        if (typeof row === "string") {
          return { id: `s${i}-${row.slice(0, 8)}`, text: row, done: false };
        }
        const r = row as { id?: string; text?: string; done?: boolean };
        if (typeof r.text !== "string") return null;
        return {
          id: typeof r.id === "string" ? r.id : `s${i}`,
          text: r.text,
          done: Boolean(r.done),
        };
      })
      .filter((x): x is SupplyRow => x != null);
  } catch {
    return [];
  }
}

function IconRent({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01" />
      <path d="M6 14h12" />
    </svg>
  );
}

function IconChores({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

function IconSupplies({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8h15l-1.5 9H7.5L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 3-3v0a3 3 0 0 1 3 3v2" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

export function UtilitiesPanel() {
  const baseId = useId();
  const [choice, setChoice] = useState<UtilityChoice | null>(null);
  const [rent, setRent] = useState<RentState>(loadRent);
  const [chores, setChores] = useState<ChoreRow[]>(loadChores);
  const [supplies, setSupplies] = useState<SupplyRow[]>(loadSupplies);
  const [supplyDraft, setSupplyDraft] = useState("");

  useEffect(() => {
    localStorage.setItem(RENT_KEY, JSON.stringify(rent));
  }, [rent]);

  useEffect(() => {
    localStorage.setItem(CHORE_KEY, JSON.stringify(chores));
  }, [chores]);

  useEffect(() => {
    localStorage.setItem(SUPPLIES_KEY, JSON.stringify(supplies));
  }, [supplies]);

  const rentBreakdown = useMemo(() => {
    const base = parseFloat(rent.monthlyRent.replace(/,/g, "")) || 0;
    const extra = parseFloat(rent.extras.replace(/,/g, "")) || 0;
    const total = base + extra;
    const n = Math.max(1, Math.min(12, rent.roommateCount));
    if (total <= 0 || n < 1) return null;
    const each = Math.floor((total * 100) / n) / 100;
    const remainder = Math.round((total - each * n) * 100) / 100;
    return { total, n, each, remainder };
  }, [rent.monthlyRent, rent.extras, rent.roommateCount]);

  const toggleChoreDay = useCallback((choreId: string, dayIndex: number) => {
    setChores((rows) =>
      rows.map((row) => {
        if (row.id !== choreId) return row;
        const next = [...row.done];
        next[dayIndex] = !next[dayIndex];
        return { ...row, done: next };
      })
    );
  }, []);

  const updateChoreLabel = useCallback((choreId: string, label: string) => {
    setChores((rows) => rows.map((row) => (row.id === choreId ? { ...row, label } : row)));
  }, []);

  const addChoreRow = useCallback(() => {
    setChores((rows) => [
      ...rows,
      {
        id: `c${Date.now()}`,
        label: "New chore",
        done: DAYS.map(() => false),
      },
    ]);
  }, []);

  const removeChoreRow = useCallback((choreId: string) => {
    setChores((rows) => rows.filter((r) => r.id !== choreId));
  }, []);

  const addSupply = useCallback(() => {
    const t = supplyDraft.trim();
    if (!t) return;
    setSupplies((s) => [...s, { id: `s${Date.now()}`, text: t, done: false }]);
    setSupplyDraft("");
  }, [supplyDraft]);

  const removeSupply = useCallback((id: string) => {
    setSupplies((s) => s.filter((row) => row.id !== id));
  }, []);

  const toggleSupply = useCallback((id: string) => {
    setSupplies((s) => s.map((row) => (row.id === id ? { ...row, done: !row.done } : row)));
  }, []);

  const hubTiles: {
    id: UtilityChoice;
    label: string;
    blurb: string;
    Icon: typeof IconRent;
  }[] = [
    {
      id: "rent",
      label: "Rent splitter",
      blurb: "Split rent evenly",
      Icon: IconRent,
    },
    {
      id: "chores",
      label: "Chore chart",
      blurb: "Weekly task grid",
      Icon: IconChores,
    },
    {
      id: "supplies",
      label: "Shared supplies",
      blurb: "Household shopping list",
      Icon: IconSupplies,
    },
  ];

  return (
    <section
      className="filters utilities-panel"
      {...(choice === null
        ? { "aria-label": "Utilities" }
        : {
            "aria-labelledby": `${baseId}-heading`,
          })}
    >
      {choice !== null ? (
        <h3 id={`${baseId}-heading`} className="section-title">
          {hubTiles.find((t) => t.id === choice)?.label}
        </h3>
      ) : null}

      {choice === null ? (
        <>
          <p className="small-note utilities-intro">Pick a tool.</p>
          <div className="utilities-hub-grid">
            {hubTiles.map(({ id, label, blurb, Icon }) => (
              <button
                key={id}
                type="button"
                className="utilities-hub-tile"
                onClick={() => setChoice(id)}
                aria-label={`${label}: ${blurb}`}
              >
                <span className="utilities-hub-icon-ring" aria-hidden="true">
                  <Icon className="utilities-hub-icon" />
                </span>
                <span className="utilities-hub-label">{label}</span>
                <span className="utilities-hub-blurb">{blurb}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="utilities-tool-header">
            <button type="button" className="utilities-back-btn" onClick={() => setChoice(null)}>
              ← All utilities
            </button>
          </div>

          {choice === "rent" ? (
            <article className="utilities-card" aria-labelledby={`${baseId}-rent-title`}>
              <h4 id={`${baseId}-rent-title`} className="utilities-card-title visually-hidden">
                Rent splitter
              </h4>
              <p className="small-note">
                Enter total monthly rent (and optional utilities or parking). Split is divided evenly
                across roommates.
              </p>
              <div className="utilities-field-row">
                <label className="utilities-label">
                  Monthly rent + fixed fees ($)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rent.monthlyRent}
                    onChange={(e) => setRent((r) => ({ ...r, monthlyRent: e.target.value }))}
                    placeholder="e.g. 2400"
                    autoComplete="off"
                  />
                </label>
                <label className="utilities-label">
                  Extra shared costs ($)
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rent.extras}
                    onChange={(e) => setRent((r) => ({ ...r, extras: e.target.value }))}
                    placeholder="Utilities, parking…"
                    autoComplete="off"
                  />
                </label>
                <label className="utilities-label utilities-label-narrow">
                  People splitting
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={rent.roommateCount}
                    onChange={(e) =>
                      setRent((r) => ({
                        ...r,
                        roommateCount: Math.min(12, Math.max(1, Number(e.target.value) || 1)),
                      }))
                    }
                  />
                </label>
              </div>
              {rentBreakdown ? (
                <div className="utilities-rent-result" role="status">
                  <p>
                    <strong>${rentBreakdown.each.toFixed(2)}</strong> per person ({rentBreakdown.n}{" "}
                    {rentBreakdown.n === 1 ? "person" : "people"}), from{" "}
                    <strong>${rentBreakdown.total.toFixed(2)}</strong> total.
                  </p>
                  {rentBreakdown.remainder !== 0 ? (
                    <p className="small-note">
                      Rounding left <strong>${Math.abs(rentBreakdown.remainder).toFixed(2)}</strong>{" "}
                      to assign manually (e.g. whoever has the parking spot pays a bit more).
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="small-note">Add amounts above to see each person&apos;s share.</p>
              )}
            </article>
          ) : null}

          {choice === "chores" ? (
            <article className="utilities-card" aria-labelledby={`${baseId}-chore-title`}>
              <h4 id={`${baseId}-chore-title`} className="utilities-card-title visually-hidden">
                Chore chart
              </h4>
              <p className="small-note">
                Check off when a task is done. Tap a chore name to edit it.
              </p>
              <div className="chore-chart-wrap" role="region" aria-label="Weekly chore checklist">
                <table className="chore-chart">
                  <thead>
                    <tr>
                      <th scope="col" className="chore-chart-task-col">
                        Task
                      </th>
                      {DAYS.map((d) => (
                        <th key={d} scope="col" className="chore-chart-day-col">
                          {d}
                        </th>
                      ))}
                      <th scope="col" className="chore-chart-actions-col" aria-label="Remove row" />
                    </tr>
                  </thead>
                  <tbody>
                    {chores.map((row) => (
                      <tr key={row.id}>
                        <td className="chore-chart-task-col">
                          <input
                            type="text"
                            className="chore-chart-task-input"
                            value={row.label}
                            onChange={(e) => updateChoreLabel(row.id, e.target.value)}
                            aria-label={`Chore: ${row.label}`}
                          />
                        </td>
                        {DAYS.map((_, di) => (
                          <td key={di} className="chore-chart-day-col">
                            <input
                              type="checkbox"
                              checked={row.done[di]}
                              onChange={() => toggleChoreDay(row.id, di)}
                              aria-label={`${row.label} done on ${DAYS[di]}`}
                            />
                          </td>
                        ))}
                        <td className="chore-chart-actions-col">
                          <button
                            type="button"
                            className="chore-remove-btn"
                            onClick={() => removeChoreRow(row.id)}
                            aria-label={`Remove ${row.label}`}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                className="actions-row"
                style={{ justifyContent: "flex-start", marginTop: "0.65rem" }}
              >
                <button type="button" onClick={addChoreRow}>
                  Add chore row
                </button>
              </div>
            </article>
          ) : null}

          {choice === "supplies" ? (
            <article className="utilities-card" aria-labelledby={`${baseId}-supply-title`}>
              <h4 id={`${baseId}-supply-title`} className="utilities-card-title visually-hidden">
                Shared supplies
              </h4>
              <p className="small-note">Whoever shops next can tick items off or add new ones.</p>
              <div className="message-composer utilities-supply-add">
                <input
                  type="text"
                  value={supplyDraft}
                  onChange={(e) => setSupplyDraft(e.target.value)}
                  placeholder="Add item (paper towels, coffee…)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSupply();
                    }
                  }}
                />
                <button type="button" onClick={addSupply}>
                  Add
                </button>
              </div>
              <ul className="utilities-supply-list">
                {supplies.map((row) => (
                  <li key={row.id} className="utilities-supply-item">
                    <label className="utilities-supply-label">
                      <input
                        type="checkbox"
                        checked={row.done}
                        onChange={() => toggleSupply(row.id)}
                      />
                      <span
                        className={
                          row.done ? "utilities-supply-text done" : "utilities-supply-text"
                        }
                      >
                        {row.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="chore-remove-btn"
                      onClick={() => removeSupply(row.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              {supplies.length === 0 ? (
                <p className="small-note">No items yet—add what you share as a household.</p>
              ) : null}
            </article>
          ) : null}
        </>
      )}
    </section>
  );
}
