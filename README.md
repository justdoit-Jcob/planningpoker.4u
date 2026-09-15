# ♠ Planning Poker Live

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A modern, fast, and responsive real-time Planning Poker (Scrum Poker) web application designed for agile, remote, and hybrid engineering teams.

---

### 🌐 Languages / Języki
- [English (Current)](#-features)
- [🇵🇱 Polska wersja README (Polish version)](#-pl-planning-poker-live---polska-wersja) or [README.pl.md](./README.pl.md)

---

## ✨ Features

- 🔒 **Genuinely Blind Estimation**:
  - Votes are redacted **on the server**. Until cards are revealed, every client receives only a `hasVoted` flag for other participants — never the card value. Opening DevTools does not reveal anyone's estimate.
  - You always see your own card; everyone else's arrives after the reveal.
- ⚡ **Real-Time WebSocket Synchronization**:
  - Instant synchronization of votes, reveals, participants, and session state with zero page reloads.
  - Automatic reconnection with exponential backoff, plus an immediate retry when the tab regains focus or the network comes back.
  - Two complementary keep-alive layers: a **client `PING` every 15s** so proxies with idle timeouts (Cloud Run, Nginx) don't drop a quiet tunnel, and a **server-side protocol ping/pong every 30s** that detects genuinely dead peers and reaps them instead of leaving ghosts at the table.
- 🗂️ **Versatile Estimation Decks**:
  - **Fibonacci**: `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`
  - **Scrum Standard (Modified Fibonacci)**: `0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕`
  - **T-Shirt**: `XS, S, M, L, XL, XXL, ?, ☕`
  - **Powers of 2**: `0, 1, 2, 4, 8, 16, 32, 64, ?, ☕`
  - **Sequential**: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ?, ☕`
- 🃏 **Interactive Poker Table**:
  - Card backings stay concealed during active voting.
  - Synchronized reveal with Web Audio API sound effects, confetti on full team consensus, and a **coffee confetti** shower when the majority votes ☕ — the team is asking for a break, not an estimate.
  - Instant round metrics: **Arithmetic Average**, **Median**, **Consensus Rate (%)**, **Vote Distribution**, and a separate **abstention** count.
- 🙋 **Abstentions Kept Out of the Maths**:
  - `?` and `☕` are not estimates. They never enter the average, median, mode, or consensus rate — a room where everyone picks `?` correctly reports 0% consensus, not 100%.
- 👥 **Team Roles & Permissions**:
  - **Voter** — engineers taking part in the estimate. Auto-reveal waits for them.
  - **Observer** — Scrum Masters, Product Owners, guests. Does not vote and never blocks a reveal.
  - **Moderator** — the room creator, assigned automatically. May estimate but is never required to, so the moderator never blocks auto-reveal. See [Roles & Trust Model](#-roles--trust-model).
- ⏱️ **Synchronized Meeting Timer**:
  - Shared countdown with quick presets (1m, 1.5m, 2m) and an audio notification on completion. Open to everyone, not just the moderator.
- 🔁 **Agile Round Lifecycle & History**:
  - Optional topic / issue key bar.
  - **Reset** clears the table without inflating the round number; **Save Score & Next** archives the round and advances it.
  - Starting a new round also clears out profiles of people who have left the session, so the table does not accumulate greyed-out ghosts.
  - Round history log with past consensus scores and vote analytics (capped at the 100 most recent rounds).
- 💬 **Live Emoji Reactions**:
  - Floating emoji particles (👍, 🚀, 🤔, ☕, 🔥) broadcast to the whole team, rate-limited to keep the overlay usable.
- 📱 **Mobile & Desktop First**:
  - Polished high-contrast dark theme (Slate & Indigo).
  - Touch-optimized card carousel with 44px+ hit targets, and a spacious table layout on widescreen monitors.

---

## 🛡️ Roles & Trust Model

The server — not the browser — is the source of truth. Every rule below is enforced server-side; the UI merely reflects it.

### Who may do what

| Action | Voter | Observer | Moderator |
| --- | :---: | :---: | :---: |
| Cast a vote | ✅ | — | ✅ *(optional)* |
| Set the round topic | ✅ | ✅ | ✅ |
| Send reactions | ✅ | ✅ | ✅ |
| Start / pause / set the timer | ✅ | ✅ | ✅ |
| Reveal cards | ✅ | ✅ | ✅ |
| Save score & advance the round | ✅ | ✅ | ✅ |
| Reset the round | ✅ | ✅ | ✅ |
| **Clear history** | — | — | ✅ |
| **Change the estimation deck** | — | — | ✅ |
| **Change room settings / rename** | — | — | ✅ |

The round flow — timer, revealing cards, saving the score and resetting — is deliberately left open to everyone: in a small team, gating it creates more friction than it prevents.

### How the moderator is chosen

1. The first person to enter a room becomes its **creator** and moderator.
2. If the moderator disconnects, the role passes to the next participant **in join order**.
3. When the creator comes back, the role returns to them and the stand-in reverts to their previous role.

A participant can only ever assign themselves `voter` or `observer`; `moderator` is granted by the server alone.

### Identity

On joining, the server issues a UUID plus an **HMAC-signed token** scoped to `roomId:userId`, which the client stores in `sessionStorage`. Reconnecting replays that token to resume the same participant entry. A forged or missing token simply results in a fresh identity — it can never take over someone else's seat.

> Set `SESSION_SECRET` in production. Without it a random secret is generated at boot, so a restart invalidates every resume token.

### Input handling

All WebSocket messages pass through a single runtime-validated schema (`src/protocol.ts`): unknown message types are dropped, votes must belong to the room's current deck, strings are length-capped, frames are limited to 64 KB, and reactions are throttled.

---

## 🛠️ Tech Stack

- **Frontend**:
  - [React 19](https://react.dev/)
  - [TypeScript](https://www.typescriptlang.org/)
  - [Tailwind CSS v4](https://tailwindcss.com/)
  - [Lucide React](https://lucide.dev/) (icon system)
  - [Motion](https://motion.dev/) (animations)
  - [Canvas Confetti](https://github.com/catdad/canvas-confetti) (celebration effects)
  - Web Audio API (synthesized sound effects with no external audio file dependencies)
- **Backend**:
  - [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
  - [ws (WebSocket)](https://github.com/websockets/ws) for real-time room communication
  - [Vite](https://vite.dev/) (development server & fast HMR asset bundling)
  - [esbuild](https://esbuild.github.io/) (single-bundle CommonJS production server output)

Room state lives in the server process memory. A restart clears all rooms and history, and the current design assumes a single instance.

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: version `>= 18.0.0` (Node.js 20+ recommended)
- **bun** (the repository ships a `bun.lock`), or **npm** / **yarn** / **pnpm**

### Installation
```bash
# Clone repository
git clone https://github.com/justdoit-Jcob/planningpoker.4u.git
cd planningpoker.4u

# Install dependencies
bun install     # or: npm install
```

### Scripts

| Script | What it does |
| --- | --- |
| `bun run dev` | Backend server with Vite middleware on port `3000` |
| `bun run build` | Compiles the frontend and bundles the backend into `/dist` |
| `bun run start` | Runs the production build (`NODE_ENV=production`) |
| `bun run test` | Unit tests for the statistics engine |
| `bun run lint` | `tsc --noEmit` type check |

Open your browser at [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Listening port. Injected automatically by most PaaS hosts (e.g. Cloud Run). |
| `NODE_ENV` | `development` | `production` serves the prebuilt `/dist` instead of starting Vite. Set by `bun run start`. |
| `SESSION_SECRET` | random per boot | Signs participant identity tokens. Set it in production so restarts don't drop everyone's session. |

> `.env.example` also lists `GEMINI_API_KEY` and `APP_URL`. Neither is currently read by the application — they are left over from the original AI Studio scaffold.

---

## 🐳 Docker & Homelab

### Prebuilt image (recommended for a NAS)

Every push to `main` publishes a multi-arch image (`linux/amd64` + `linux/arm64`) to GitHub Container Registry, so the target machine never has to compile anything:

```yaml
name: planning-poker

services:
  planning-poker:
    image: ghcr.io/justdoit-jcob/planningpoker.4u:latest
    container_name: planning-poker
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      TZ: Europe/Warsaw
      SESSION_SECRET: ""
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

```bash
docker compose up -d                      # first run
docker compose pull && docker compose up -d   # update to the latest image
```

This is the path to use on OpenMediaVault, Synology, Unraid or any box where you would rather not install a build toolchain. It needs neither `git` nor a local copy of the repository — only this file.

### Building locally from source

```bash
cp .env.example .env          # optional: adjust HOST_PORT / SESSION_SECRET
docker compose up -d --build
```

The app is then available on `http://<your-host>:3000`, or whatever `HOST_PORT` you set.

> Building requires roughly 1 GB of RAM for the Vite step, and a BuildKit new enough to be worth using. On a low-powered NAS, prefer the prebuilt image above.

### What the image looks like

The build is two-stage. **Bun** compiles the frontend and bundles the server into a single CommonJS file with `express`, `ws` and `dotenv` inlined; **node:22-alpine** then runs nothing but that bundle plus the static assets. The runtime image therefore carries **no `node_modules` and no build tooling at all** — Vite is loaded through a dynamic import that only the development path ever reaches.

The container runs as the unprivileged `node` user and ships a `HEALTHCHECK` that polls `/api/health` with busybox `wget`, so `docker ps` reports real readiness rather than just "process alive".

### Everyday commands

```bash
docker compose logs -f              # follow logs
docker compose restart              # restart the service
docker compose up -d --build        # rebuild after pulling changes
docker compose down                 # stop and remove the container
```

### Behind a reverse proxy

Planning Poker is WebSocket-first, so the proxy must forward the upgrade. In **Nginx** / Nginx Proxy Manager that means enabling WebSocket support on the host, or adding:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 3600s;
```

In **Traefik** no extra configuration is needed — upgrades are forwarded by default.

The client sends a `PING` every 15 seconds specifically so that proxies with idle timeouts do not tear down a quiet tunnel, but raising `proxy_read_timeout` is still worth doing.

**Networks that block WebSockets.** Some corporate networks (TLS-inspecting proxies, secure web gateways) let ordinary HTTPS through but drop the WebSocket upgrade — the page loads, the room never connects. The client handles this on its own: if the WebSocket delivers no frame within 6 seconds, it switches to HTTP long-polling on `/api/rt/*` (a held `GET` for incoming frames, `POST` for outgoing ones) and stays on it for the rest of the tab session. Room logic is identical on both transports. The only requirement is that nothing caches `/api/rt/*` — responses carry `Cache-Control: no-store`.

### Scaling

Room state lives in the server process memory, so **run a single replica**. A second instance would serve its own, entirely separate set of rooms. There is nothing to mount as a volume either — a restart intentionally clears all rooms and history.

---

## 🧪 Testing

```bash
bun run test
```

Runs the `node:test` suite through `tsx`. Coverage focuses on `src/utils/stats.ts`, the pure function behind every round summary: odd and even medians, non-numeric decks, abstention handling, the coffee-majority threshold, and the rules for which participants count toward a round. A separate suite checks the room ID generator (`src/utils/roomId.ts`): the `ROOM-XXXX` format, its alphabet, and uniqueness.

---

## 📂 Project Structure

```text
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── CardDeck.tsx       # Bottom interactive card voting carousel
│   │   ├── Header.tsx         # Top bar (home, timer, deck selector, reactions, settings)
│   │   ├── HistoryModal.tsx   # Modal showing completed rounds history
│   │   ├── LobbyModal.tsx     # Welcome screen, name/avatar/role/room selection
│   │   ├── ParticipantsModal.tsx # Team roster and voting status modal
│   │   ├── PokerTable.tsx     # Oval table with participant cards and stats
│   │   ├── ReactionsOverlay.tsx  # Floating animated live emoji reactions
│   │   └── TopicBar.tsx       # Current story / round topic bar
│   ├── hooks/
│   │   └── useDismissOnOutside.ts # Close menus & inline editors on outside click / Escape
│   ├── utils/
│   │   ├── audio.ts           # Web Audio API sound synthesis
│   │   ├── celebrate.ts       # Consensus and coffee-break confetti
│   │   ├── polyfill.ts        # Browser environment compatibility polyfills
│   │   ├── roomId.ts          # ROOM-XXXX room ID generator
│   │   ├── roomId.test.ts     # Unit tests for the room ID generator
│   │   ├── stats.ts           # Median, average, consensus and abstention calculations
│   │   └── stats.test.ts      # Unit tests for the statistics engine
│   ├── protocol.ts            # WebSocket message schema, runtime validation, limits
│   ├── transport.ts           # Realtime connection: WebSocket with HTTP long-polling fallback
│   ├── types.ts               # Shared TypeScript schemas, decks & role helpers
│   ├── App.tsx                # Main application orchestrator & realtime client
│   ├── main.tsx               # Application entry point
│   └── index.css              # Global styling with Tailwind CSS v4
├── server.ts                  # Express server, room state, identity & authorization
├── vite.config.ts             # Vite configuration
├── package.json               # Scripts and dependencies
├── README.md                  # Project documentation (English & Polish)
└── README.pl.md               # Polish documentation standalone file
```

---

## 💡 How It Works

1. **Join or Create a Room**:
   - Enter your name, pick a role (**Voter** or **Observer**) and choose an avatar color. Every visit generates a fresh room ID in the `ROOM-XXXX` format for a new room; to join an existing one, type the ID your team shared.
   - Share the URL (`?room=SPRINT-42`) so colleagues land at the same table. The first person in becomes the moderator.
2. **Vote on Stories**:
   - Anyone can set the current topic or story title.
   - Pick a card from the bottom deck. Other people see only that you are ready — never which card you chose.
3. **Reveal**:
   - Anyone at the table clicks **Reveal Cards**, or auto-reveal fires once every voter has chosen.
   - The team sees the average, median, agreement percentage and distribution, with confetti on full consensus — or coffee confetti if the room mostly voted ☕.
4. **Next Round**:
   - **Save Score & Next** archives the round to History and advances the counter; **Reset** just clears the table.
   - Either way, participants who have left the session are dropped from the table.
5. **Leave**:
   - Click the ♠ logo in the header to leave the room and return to the lobby. Your identity is kept, so rejoining the same room restores your seat.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<br />

---

# 🇵🇱 [PL] Planning Poker Live - Polska Wersja

[Przejdź do początku (English version)](#-planning-poker-live)

Nowoczesna, lekka i responsywna aplikacja internetowa do zwinnego szacowania (Planning Poker / Scrum Poker) w czasie rzeczywistym dla zdalnych i hybrydowych zespołów inżynieryjnych.

Zbudowana z użyciem **React 19**, **TypeScript**, **Tailwind CSS v4**, **Node.js/Express** oraz synchronicznych kanałów komunikacyjnych **WebSocket (ws)**.

Pełna dokumentacja po polsku znajduje się w pliku [README.pl.md](./README.pl.md).

---

## ✨ Główne Funkcjonalności

- 🔒 **Estymacja naprawdę ślepa**:
  - Głosy są redagowane **po stronie serwera**. Do momentu odkrycia kart każdy klient dostaje o innych uczestnikach wyłącznie informację `hasVoted` — nigdy wartości karty. Otwarcie DevTools nie ujawnia cudzych estymat.
  - Własną kartę widzisz zawsze; pozostałe pojawiają się dopiero po odkryciu.
- ⚡ **Wymiana danych w czasie rzeczywistym (Real-time WebSockets)**:
  - Błyskawiczna synchronizacja głosów, odkrywania kart i statusów uczestników bez przeładowywania strony.
  - Automatyczne wznawianie połączenia z narastającym opóźnieniem oraz heartbeat ping/pong po stronie serwera, który usuwa martwe połączenia zamiast zostawiać duchy przy stole.
- 🗂️ **Wybór skali estymacji (Decks)**:
  - **Fibonacci**: `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`
  - **Scrum Standard**: `0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕`
  - **T-Shirt**: `XS, S, M, L, XL, XXL, ?, ☕`
  - **Potęgi 2 (Powers of 2)**: `0, 1, 2, 4, 8, 16, 32, 64, ?, ☕`
  - **Sekwencyjna (Sequential)**: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ?, ☕`
- 🃏 **Interaktywny stół pokerowy**:
  - Ukryte rewersy kart w trakcie trwania rundy.
  - Synchroniczne odkrycie kart z efektami Web Audio API, konfetti przy pełnej zgodzie zespołu oraz **konfetti z kawą**, gdy większość wybierze ☕ — zespół prosi wtedy o przerwę, nie o estymatę.
  - Statystyki rundy: **średnia**, **mediana**, **stopień zgodności (%)**, **rozkład głosów** i osobno liczone **wstrzymania**.
- 🙋 **Wstrzymania poza matematyką**:
  - `?` i `☕` nie są estymatą — nie wchodzą do średniej, mediany, mody ani konsensusu. Pokój, w którym wszyscy wybrali `?`, pokazuje 0% zgody, a nie 100%.
- 👥 **Role w zespole**:
  - **Głosujący (Voter)** — bierze udział w wycenie; automatyczne odkrycie czeka na niego.
  - **Obserwator (Observer)** — Scrum Master, Product Owner, goście. Nie głosuje i nigdy nie blokuje odkrycia.
  - **Moderator** — twórca pokoju, wyznaczany automatycznie. Może estymować, ale nie musi, więc nigdy nie blokuje odkrycia.
- ⏱️ **Wbudowany timer dyskusji**: wspólne odliczanie z presetami (1m, 1.5m, 2m) i sygnałem dźwiękowym. Dostępny dla wszystkich, nie tylko moderatora.
- 🔁 **Cykl rundowy i historia**: **Resetuj** czyści stół bez zmiany numeru rundy, **Zapisz wynik i dalej** archiwizuje ją i przechodzi dalej. Start nowej rundy usuwa też profile osób, które opuściły sesję.
- 💬 **Reakcje na żywo**: pływające emoji (👍, 🚀, 🤔, ☕, 🔥) z ograniczeniem częstotliwości.
- 📱 **Mobile & Desktop First**: dopracowany interfejs w ciemnej tonacji (Dark Slate/Indigo), dopasowany do ekranów dotykowych i szerokich monitorów.

---

## 🛠️ Stos Technologiczny

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Motion](https://motion.dev/), [Canvas Confetti](https://github.com/catdad/canvas-confetti), Web Audio API.
- **Backend**: [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [ws (WebSocket)](https://github.com/websockets/ws), [Vite](https://vite.dev/), [esbuild](https://esbuild.github.io/).

---

## 🚀 Uruchomienie Lokalne

```bash
# Instalacja zależności
bun install        # lub: npm install

# Tryb deweloperski (http://localhost:3000)
bun run dev

# Testy jednostkowe i kontrola typów
bun run test
bun run lint

# Budowanie i start produkcyjny
bun run build
bun run start
```

Szczegóły ról, uprawnień, modelu zaufania i zmiennych środowiskowych: [README.pl.md](./README.pl.md).

---

## 📄 Licencja

Projekt udostępniany na licencji [MIT](LICENSE).
Możesz go swobodnie rozwijać, dostosowywać i wdrażać we własnym zespole!
