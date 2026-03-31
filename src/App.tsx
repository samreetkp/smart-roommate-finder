import { useMemo, useState } from "react";

type Budget = "Low" | "Medium" | "High";

type RoommateProfile = {
  id: number;
  name: string;
  city: string;
  budget: Budget;
  sleepSchedule: "Early Bird" | "Night Owl";
  cleanliness: number;
  pets: boolean;
  hobbies: string[];
  bio: string;
};

const profiles: RoommateProfile[] = [
  {
    id: 1,
    name: "Aarav",
    city: "Bengaluru",
    budget: "Medium",
    sleepSchedule: "Night Owl",
    cleanliness: 7,
    pets: false,
    hobbies: ["Gaming", "Cooking", "Movies"],
    bio: "Software engineer. Looking for a chill, respectful flatmate.",
  },
  {
    id: 2,
    name: "Riya",
    city: "Mumbai",
    budget: "High",
    sleepSchedule: "Early Bird",
    cleanliness: 9,
    pets: true,
    hobbies: ["Yoga", "Reading", "Running"],
    bio: "Marketing professional. Prefer a quiet and tidy home.",
  },
  {
    id: 3,
    name: "Kabir",
    city: "Pune",
    budget: "Low",
    sleepSchedule: "Night Owl",
    cleanliness: 6,
    pets: true,
    hobbies: ["Music", "Football", "Travel"],
    bio: "Designer who loves social weekends and a friendly vibe.",
  },
  {
    id: 4,
    name: "Sana",
    city: "Delhi",
    budget: "Medium",
    sleepSchedule: "Early Bird",
    cleanliness: 8,
    pets: false,
    hobbies: ["Art", "Cooking", "Podcasts"],
    bio: "Consultant. Looking for a responsible roommate with good communication.",
  },
];

function compatibilityScore(profile: RoommateProfile, prefersPets: boolean) {
  let score = 50;
  score += Math.max(0, 10 - Math.abs(profile.cleanliness - 8)) * 3;
  score += profile.sleepSchedule === "Early Bird" ? 8 : 5;
  score += prefersPets === profile.pets ? 12 : 0;
  return Math.min(99, score);
}

export default function App() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("All");
  const [petFriendlyOnly, setPetFriendlyOnly] = useState(false);

  const cityOptions = useMemo(
    () => ["All", ...new Set(profiles.map((profile) => profile.city))],
    []
  );

  const filteredProfiles = useMemo(() => {
    return profiles
      .filter((profile) => (city === "All" ? true : profile.city === city))
      .filter((profile) => (petFriendlyOnly ? profile.pets : true))
      .filter((profile) => {
        const text = `${profile.name} ${profile.hobbies.join(" ")} ${profile.bio}`;
        return text.toLowerCase().includes(search.toLowerCase());
      })
      .map((profile) => ({
        ...profile,
        score: compatibilityScore(profile, petFriendlyOnly),
      }))
      .sort((a, b) => b.score - a.score);
  }, [city, petFriendlyOnly, search]);

  return (
    <main className="page">
      <header className="hero">
        <p className="badge">RoomAi</p>
        <h1>Find a compatible roommate in minutes</h1>
        <p>
          This starter app includes search, city filters, and a basic AI-like
          compatibility score so you can quickly build your full platform.
        </p>
      </header>

      <section className="filters">
        <label>
          Search by name, hobby, or bio
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Try: cooking, yoga, engineer"
          />
        </label>

        <label>
          City
          <select value={city} onChange={(event) => setCity(event.target.value)}>
            {cityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={petFriendlyOnly}
            onChange={(event) => setPetFriendlyOnly(event.target.checked)}
          />
          Show only pet-friendly roommates
        </label>
      </section>

      <section className="results">
        {filteredProfiles.length === 0 ? (
          <p className="empty">No matches found. Try changing your filters.</p>
        ) : (
          filteredProfiles.map((profile) => (
            <article key={profile.id} className="card">
              <div className="card-top">
                <div>
                  <h2>{profile.name}</h2>
                  <p>
                    {profile.city} · {profile.budget} budget · {profile.sleepSchedule}
                  </p>
                </div>
                <span className="score">{profile.score}% match</span>
              </div>

              <p>{profile.bio}</p>

              <div className="meta">
                <span>Cleanliness: {profile.cleanliness}/10</span>
                <span>{profile.pets ? "Pet friendly" : "No pets"}</span>
              </div>

              <ul>
                {profile.hobbies.map((hobby) => (
                  <li key={hobby}>{hobby}</li>
                ))}
              </ul>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
