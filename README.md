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

- ⚡ **Real-Time WebSocket Synchronization**:
  - Instant synchronization of card votes, reveals, participants, and session state across all connected clients with zero page reloads.
  - Live participant presence indicators showing who is online and who has submitted their vote.
- 🗂️ **Versatile Estimation Decks**:
  - **Fibonacci**: `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`
  - **Scrum Standard (Modified Fibonacci)**: `0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕`
  - **T-Shirt**: `XS, S, M, L, XL, XXL, ?, ☕`
  - **Powers of 2**: `0, 1, 2, 4, 8, 16, 32, 64, ?, ☕`
  - **Sequential**: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ?, ☕`
- 🃏 **Interactive Poker Table**:
  - Card backings stay concealed during active voting.
  - Smooth synchronous card reveal animation with Web Audio API sound effects and automatic confetti celebration upon 100% team consensus.
  - Instant automated round metrics: **Arithmetic Average**, **Median**, **Consensus Rate (%)**, and complete **Vote Distribution**.
- 👥 **Team Roles & Permissions**:
  - **Voter**: Engineers and team members who participate in estimating stories.
  - **Observer**: Scrum Masters, Product Owners, or stakeholders (spectates without voting or blocking auto-reveal triggers).
- ⏱️ **Synchronized Meeting Timer**:
  - Built-in countdown timer with quick presets (1m, 1.5m, 2m) and audio notification on completion to keep discussions focused and timeboxed.
- 🔁 **Agile Round Lifecycle & History**:
  - Optional topic/issue key input bar.
  - Single-click **Reset / Next Round** action to clear votes and start the next estimation immediately.
  - Round summary history log modal with past consensus scores and vote analytics.
- 💬 **Live Emoji Reactions**:
  - Lightweight animated floating emoji particles (👍, 🚀, 🤔, ☕, 🔥) sent across team screens in real time.
- 📱 **Mobile & Desktop First**:
  - Polished high-contrast dark theme (Slate & Indigo).
  - Touch-optimized card selection carousel with 44px+ hit targets on mobile, and spacious table layout on widescreen monitors.

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

---

## 🚀 Getting Started Locally

### Prerequisites
- **Node.js**: version `>= 18.0.0` (Node.js 20+ recommended)
- **npm**, **yarn**, or **pnpm**

### Installation
```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/planning-poker.git
cd planning-poker

# Install dependencies
npm install
```

### Development Mode
Runs the backend server with Vite middleware on port `3000`:
```bash
npm run dev
```
Open your browser at [http://localhost:3000](http://localhost:3000).

### Production Build & Run
```bash
# Compile frontend and bundle backend into /dist
npm run build

# Start the production server
npm start
```

---

## 📂 Project Structure

```text
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── CardDeck.tsx       # Bottom interactive card voting carousel
│   │   ├── Header.tsx         # Top bar (timer, deck selector, reactions, settings)
│   │   ├── HistoryModal.tsx   # Modal showing completed rounds history
│   │   ├── LobbyModal.tsx     # Welcome screen, name/avatar/role/room selection
│   │   ├── ParticipantsModal.tsx # Team roster and voting status modal
│   │   ├── PokerTable.tsx     # Oval table with participant cards and stats
│   │   ├── ReactionsOverlay.tsx  # Floating animated live emoji reactions
│   │   └── TopicBar.tsx       # Current story / round topic bar
│   ├── utils/
│   │   ├── audio.ts           # Web Audio API sound synthesis
│   │   ├── polyfill.ts        # Browser environment compatibility polyfills
│   │   └── stats.ts           # Median, average, and consensus calculations
│   ├── types.ts               # Shared TypeScript schemas & types
│   ├── App.tsx                # Main application orchestrator & WebSocket client
│   ├── main.tsx               # Application entry point
│   └── index.css              # Global styling with Tailwind CSS v4
├── server.ts                  # Express server & WebSocket room state manager
├── vite.config.ts             # Vite configuration
├── package.json               # Scripts and dependencies
├── README.md                  # Project documentation (English & Polish)
└── README.pl.md               # Polish documentation standalone file
```

---

## 💡 How It Works

1. **Join or Create a Room**:
   - Enter your name, select a role (**Voter** or **Observer**), choose an avatar color, and pick a Room Code (e.g. `SPRINT-42`).
   - Share the URL with colleagues (`?room=SPRINT-42`) to let them join the exact same table instantly.
2. **Vote on Stories**:
   - Anyone can update the current discussion topic or story title.
   - Team members click a card from the bottom deck. Cards stay face-down on the table until all votes are cast.
3. **Reveal**:
   - Click **Reveal Cards** (or let Auto-Reveal trigger when all voters finish) to turn over cards.
   - The team immediately sees the arithmetic mean, median, team agreement percentage, and consensus confetti when 100% agreement is met.
4. **Next Round**:
   - Click **Save Score & Next** or **Reset** to clear cards, archive the round into History, and continue seamlessly.

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

---

## ✨ Główne Funkcjonalności

- ⚡ **Wymiana danych w czasie rzeczywistym (Real-time WebSockets)**:
  - Błyskawiczna synchronizacja głosów, odkrywania kart i statusów uczestników bez przeładowywania strony.
  - Wskaźniki obecności uczestników online oraz informacja o tym, kto już oddał głos.
- 🗂️ **Wybór skali estymacji (Decks)**:
  - **Fibonacci**: `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`
  - **Scrum Standard**: `0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕`
  - **T-Shirt**: `XS, S, M, L, XL, XXL, ?, ☕`
  - **Potęgi 2 (Powers of 2)**: `0, 1, 2, 4, 8, 16, 32, 64, ?, ☕`
  - **Sekwencyjna (Sequential)**: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ?, ☕`
- 🃏 **Interaktywny stół pokerowy**:
  - Ukryte rewersy kart w trakcie trwania rundy.
  - Płynna animacja synchronicznego odkrycia kart (**Reveal**) z efektami dźwiękowymi Web Audio API i konfetti przy jednomyślności zespołu (**Consensus!**).
  - Automatyczne wyliczanie statystyk rundy: **średnia arytmetyczna**, **mediana**, **stopień zgodności zespołu (%)** oraz **rozkład głosów**.
- 👥 **Role w zespole**:
  - **Głosujący (Voter)**: Deweloperzy, inżynierowie biorący bezpośredni udział w wycenie.
  - **Obserwator (Observer)**: Scrum Master, Product Owner, goście (brak konieczności oddawania głosu, brak blokowania auto-reveal).
- ⏱️ **Wbudowany timer dyskusji**:
  - Konfigurowalny stoper (np. 30s, 1m, 1.5m, 2m, 3m, 5m) z synchronizowanym odliczaniem dla wszystkich uczestników i sygnałem dźwiękowym po upływie czasu.
- 🔁 **Prosty cykl rundowy & Historia**:
  - Pole tematu zadania / User Story.
  - Przycisk **Reset / Nowa runda** umożliwiający natychmiastowe przejście do kolejnej estymacji.
  - Zapis historii zakończonych rund z możliwością podejrzenia uzyskanych wyników i statystyk w oknie modalnym.
- 💬 **Reakcje na żywo**:
  - Pływające reakcje emoji (👍, ❤️, 🚀, 🤔, ☕, 🎉) widoczne natychmiast dla całego zespołu.
- 📱 **Mobile & Desktop First**:
  - Dopracowany interfejs w ciemnej tonacji (Dark Slate/Indigo).
  - Skrajnie dopasowany do ekranów dotykowych telefonów, tabletów oraz szerokich monitorów.

---

## 🛠️ Stos Technologiczny

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Motion](https://motion.dev/), [Canvas Confetti](https://github.com/catdad/canvas-confetti), Web Audio API.
- **Backend**: [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [ws (WebSocket)](https://github.com/websockets/ws), [Vite](https://vite.dev/), [esbuild](https://esbuild.github.io/).

---

## 🚀 Uruchomienie Lokalne

```bash
# Instalacja zależności
npm install

# Tryb deweloperski (http://localhost:3000)
npm run dev

# Budowanie i start produkcyjny
npm run build
npm start
```

---

## 📄 Licencja

Projekt udostępniany na licencji [MIT](LICENSE).
Możesz go swobodnie rozwijać, dostosowywać i wdrażać we własnym zespole!
