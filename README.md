# RoomAi - Smart, Reliable AI Roommate Finder

RoomAi is a full-stack platform focused on one core mission: helping users find highly compatible roommates they can actually live with.  
It uses structured onboarding + AI-style compatibility logic, then supports the full post-match journey with messaging, conflict-resolution chat, utilities, and rent planning.

---

## Project focus

### Core goal
- **Smart and reliable roommate finding first**: matching quality is the center of the product.
- **AI-assisted compatibility**: structured preference onboarding feeds a compatibility-scoring engine.
- **Trustworthy UX**: fallback data paths keep core flows usable even when live services are limited.

### Secondary value
- Apartment discovery supports roommate decisions (location + budget), but is not the primary product axis.

---

## Why this project stands out

- **Innovation & Creativity**: goes beyond swipe matching by connecting compatibility, communication, and co-living tools in one system.
- **Technical Depth**: production-style architecture with typed frontend modules, Supabase auth/data/storage, SQL migrations, and policy-aware data access.
- **Impact & Usefulness**: addresses real roommate pain points: poor fit, communication breakdowns, and shared-living logistics.
- **Presentation & Demo**: deterministic demo path with both live integrations and robust fallback data.
- **Feasibility & Sustainability**: deployable architecture now, with clear scaling path for backend AI services and workflow automation.

---

## Full Tech Stack

### Frontend
- **React 19** + **TypeScript**
- **Vite 8** build/dev pipeline
- **Custom CSS** (no heavyweight UI dependency)
- Feature modules for onboarding, compatibility logic, messaging, AI chat, apartment search, profile flows, and utilities

### Backend / Data Platform
- **Supabase**
  - **Postgres** (core app data)
  - **Supabase Auth** (session + account lifecycle)
  - **Supabase Storage** (profile photos)
  - **Row-Level Security (RLS) policies**
  - SQL migrations in `supabase/migrations`

### External Data + APIs
- **RentCast API** (live rental listings when key is provided)
- **OpenStreetMap / Overpass API** (live apartment building discovery)
- **Nominatim geocoding** (typed location -> coordinates)
- **Browser Geolocation API** (current-user location)

### Tooling / Quality
- **ESLint 9**
- **TypeScript compiler checks** (`tsc -b`)
- **Vite preview proxy** for secure local API key usage

---

## Core capabilities

- **Smart onboarding questionnaire** persisted per-user with structured answer parsing
- **Compatibility scoring engine** for roommate recommendations
- **Profile system** (name, photo, visibility, preferences)
- **Discover + swipe-style roommate interactions**
- **In-app messaging** with read-state support for matched users
- **AI chat assistant** for roommate communication support and conflict-resolution guidance
- **Utility hub** for shared-living operations:
  - rent splitter/planning
  - weekly chore board
  - shared supplies checklist
- **Notifications** for in-app activity (including unread message awareness)
- **Rent reminder workflow** supported through the utilities + notification-oriented UX pattern
- **User reporting / moderation-ready hooks**
- **Apartment search**:
  - Uses current location when available
  - Falls back to onboarding city/area
  - Pulls live results from RentCast/OSM
  - Always remains demo-safe with curated mock listings
- **Graceful fallback architecture** so the demo works even with API limits/outages

---

## Architecture at a glance

1. User authenticates via Supabase Auth.
2. Onboarding + profile data is stored in Supabase tables (with local persistence where appropriate).
3. Matching/recommendation logic runs in typed client modules.
4. Apartment discovery resolves coordinates from:
   - geolocation (preferred),
   - or onboarding city area (fallback).
5. Listings are fetched from live providers, then merged with local mock inventory to guarantee reliable UX.
6. Messaging, reports, and profile updates persist in Supabase with policy-backed access control.

---

## Getting started

### 1) Install

```bash
npm install
```

### 2) Environment setup

Copy `.env` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RENTCAST_API_KEY`

`vite.config.ts` includes a `/api/rentcast` proxy for dev/preview so API keys are not exposed directly in browser calls.

### 3) Run

```bash
npm run dev
```

---

## Scripts

- `npm run dev` - start development server
- `npm run build` - type-check + production build
- `npm run preview` - run production preview
- `npm run lint` - run ESLint

---

## Demo flow (recommended for judges)

1. Sign up and complete onboarding preferences.
2. Open roommate discovery and explain compatibility highlights (main value demo).
3. Show messaging between users and unread notification behavior.
4. Open AI chat to show conflict-resolution or roommate communication support.
5. Open Utilities and demonstrate rent planning, chores, and supplies tracking.
6. Open Apartments without typing a location:
   - app uses current location or onboarding city automatically,
   - shows live listings when available,
   - and still shows robust demo listings if APIs are limited.
7. Update profile details/photo and show persistence.

This flow demonstrates both technical depth and reliability under real demo constraints.

---

## Feasibility, deployment, and scale path

- **Feasible now**: core features are implemented and runnable locally end-to-end.
- **Deployment ready path**: static frontend deploy + Supabase project configuration.
- **Scale path**:
  - move matching logic to backend services,
  - add caching for listing providers,
  - add observability + analytics,
  - introduce queue-based enrichment for profiles/listings.

---

## Repository structure (high level)

- `src/` - React app, matching logic, API adapters, components, types, styles
- `supabase/migrations/` - schema and policy evolution
- `public/` - static assets
- `vite.config.ts` - build + proxy configuration

---
