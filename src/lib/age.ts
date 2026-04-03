/** ISO date string `YYYY-MM-DD` → age in full years, or null if invalid. */
export function calculateAgeFromBirthdate(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate.trim())) return null;
  const [ys, ms, ds] = isoDate.trim().split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

  // Build from local Y/M/D and reject calendar overflow (e.g. 2024-02-31).
  const birth = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (Number.isNaN(birth.getTime())) return null;
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/** Latest birthdate for someone who is at least `minAge` years old today (local calendar). */
export function maxBirthdateForMinAge(minAge: number): string {
  const t = new Date();
  t.setFullYear(t.getFullYear() - minAge);
  return formatLocalYMD(t);
}

/** Earliest birthdate for someone at most `maxAge` years old (local calendar). */
export function minBirthdateForMaxAge(maxAge: number): string {
  const t = new Date();
  t.setFullYear(t.getFullYear() - maxAge);
  return formatLocalYMD(t);
}

function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
