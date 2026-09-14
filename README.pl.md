# ♠ Planning Poker Live (Wersja Polska)

[Go back to English README / Wróć do wersji angielskiej](./README.md)

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

- **Frontend**:
  - [React 19](https://react.dev/)
  - [TypeScript](https://www.typescriptlang.org/)
  - [Tailwind CSS v4](https://tailwindcss.com/)
  - [Lucide React](https://lucide.dev/) (ikony)
  - [Motion](https://motion.dev/) (animacje)
  - [Canvas Confetti](https://github.com/catdad/canvas-confetti) (efekt celebracji zgodności)
  - Web Audio API (natywne, lekkie efekty dźwiękowe bez zewnętrznych plików audio)
- **Backend**:
  - [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
  - [ws (WebSocket)](https://github.com/websockets/ws) do synchronicznego przesyłania zdarzeń
  - [Vite](https://vite.dev/) (serwowanie deweloperskie i optymalizacja buildu)
  - [esbuild](https://esbuild.github.io/) (kompilacja serwera produkcyjnego do pojedynczego pliku CJS)

---

## 🚀 Uruchomienie Lokalne

### Wymagania wstępne
- **Node.js**: w wersji `>= 18.0.0` (zalecany Node.js 20+)
- **npm** lub **yarn** / **pnpm**

### Instalacja zależności
```bash
npm install
```

### Tryb deweloperski
Uruchomienie serwera wraz z Vite middleware na porcie `3000`:
```bash
npm run dev
```
Aplikacja będzie dostępna pod adresem: `http://localhost:3000`.

### Budowanie i start produkcyjny
```bash
# Zbudowanie frontendu Vite oraz serwera esbuild do katalogu /dist
npm run build

# Uruchomienie produkcyjnego serwera Node.js
npm start
```

---

## 💡 Jak działa aplikacja?

1. **Dołączenie lub utworzenie pokoju**:
   - Użytkownik wchodzi do aplikacji i podaje swoje imię, wybiera kolor awatara, rolę oraz identyfikator pokoju (np. `SPRINT-42`).
   - Udostępnienie linku w formacie `?room=KOD_POKOJU` automatycznie kieruje współpracowników do tego samego stołu.
2. **Wybór tematu i kart**:
   - Dowolna osoba może wpisać tytuł estymowanego zadania.
   - Uczestnicy wybierają kartę z dolnego paska – ich wybór jest oznaczany na stole (karta zakryta).
3. **Odkrycie kart (Reveal)**:
   - Po kliknięciu „Odkryj karty” (lub automatycznie przy włączonej opcji Auto-Reveal) karty obracają się, ujawniając wyceny wszystkich osób.
   - Wyświetla się podsumowanie: średnia, mediana, stopień zgodności i ewentualne konfetti.
4. **Zakończenie rundy (Reset)**:
   - Kliknięcie przycisku zapisu lub nowej rundy czyści stół i inkrementuje numer rundy, archiwizując wynik w historii sesji.

---

## 📄 Licencja

Projekt udostępniany na licencji [MIT](LICENSE).
Możesz go swobodnie rozwijać, dostosowywać i wdrażać we własnym zespole!
