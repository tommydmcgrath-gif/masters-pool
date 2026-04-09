# Masters Pool Leaderboard

A simple live leaderboard for a 6-team Masters snake draft pool. Built with Next.js and deployed to Vercel.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

### Data Source

The app uses **ESPN's public leaderboard API** — no API key required. Data is fetched server-side via a Next.js API route (`/api/scores`) so no keys are ever exposed to the client.

If you want to swap to a different provider (e.g., SportsData.io), implement the `LeaderboardProvider` interface in `lib/api/` and update the factory in `lib/api/provider.ts`.

### Scoring

- Each team has **5 golfers**; only the **best 4 scores** count toward the team total.
- Lower score wins.
- **Missed-cut rule:** If a player misses the cut, their effective score = their actual 36-hole score + the worst round-3 score among the field + the worst round-4 score among the field. This ensures missed-cut players are penalized realistically.
- Ties are supported — tied teams share the same rank.

### Refresh

The page auto-refreshes every **60 seconds**. There's also a manual refresh button.

## Deploy to Vercel

### Option A: GitHub import (recommended)

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Vercel auto-detects Next.js — no build settings needed.
4. Click **Deploy**.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts. That's it.

### Environment Variables

The default ESPN provider **does not require any API key**. No environment variables are needed.

If you later switch to a paid API provider, add your key in the Vercel dashboard:
- Go to your project → **Settings** → **Environment Variables**
- Add `GOLF_API_KEY` with your key value.

## Changing Teams

Edit `lib/teams.ts`. Each team has a `name` and a `players` array. Player names should match what the ESPN leaderboard uses — the app normalizes names (strips accents, case-insensitive) for matching.

## Running Tests

```bash
npm test
```

Tests cover the scoring module: name normalization, player mapping, missed-cut rule, team scoring, and ranking.

## Project Structure

```
app/
  page.tsx           — Main leaderboard UI (client component)
  layout.tsx         — Root layout
  globals.css        — Styles
  api/scores/route.ts — Server-side API route
lib/
  types.ts           — TypeScript interfaces
  teams.ts           — Team/player definitions
  scoring.ts         — All scoring logic (testable)
  api/
    provider.ts      — Provider factory
    espn.ts          — ESPN API adapter
  __tests__/
    scoring.test.ts  — Unit tests
```
