# ♠ Planning Poker Live (Wersja Polska)

[Go back to English README / Wróć do wersji angielskiej](./README.md)

Nowoczesna, lekka i responsywna aplikacja internetowa do zwinnego szacowania (Planning Poker / Scrum Poker) w czasie rzeczywistym dla zdalnych i hybrydowych zespołów inżynieryjnych.

Zbudowana z użyciem **React 19**, **TypeScript**, **Tailwind CSS v4**, **Node.js/Express** oraz synchronicznych kanałów komunikacyjnych **WebSocket (ws)**.

---

## ✨ Główne Funkcjonalności

- 🔒 **Estymacja naprawdę ślepa**:
  - Głosy są redagowane **po stronie serwera**. Do momentu odkrycia kart każdy klient dostaje o pozostałych uczestnikach wyłącznie informację `hasVoted` — nigdy wartości karty. Otwarcie DevTools nie ujawnia cudzych estymat.
  - Własną kartę widzisz zawsze; pozostałe pojawiają się dopiero po odkryciu.
- ⚡ **Wymiana danych w czasie rzeczywistym (Real-time WebSockets)**:
  - Błyskawiczna synchronizacja głosów, odkrywania kart i statusów uczestników bez przeładowywania strony.
  - Automatyczne wznawianie połączenia z narastającym opóźnieniem (1 s → 30 s) oraz heartbeat ping/pong co 30 s, który usuwa martwe połączenia zamiast zostawiać duchy przy stole.
- 🗂️ **Wybór skali estymacji (Decks)**:
  - **Fibonacci**: `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`
  - **Scrum Standard**: `0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕`
  - **T-Shirt**: `XS, S, M, L, XL, XXL, ?, ☕`
  - **Potęgi 2 (Powers of 2)**: `0, 1, 2, 4, 8, 16, 32, 64, ?, ☕`
  - **Sekwencyjna (Sequential)**: `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ?, ☕`
- 🃏 **Interaktywny stół pokerowy**:
  - Ukryte rewersy kart w trakcie trwania rundy.
  - Synchroniczne odkrycie kart z efektami dźwiękowymi Web Audio API, konfetti przy pełnej zgodzie zespołu oraz **konfetti z kawą**, gdy większość wybierze ☕ — zespół prosi wtedy o przerwę, nie o estymatę.
  - Automatyczne statystyki rundy: **średnia arytmetyczna**, **mediana**, **stopień zgodności zespołu (%)**, **rozkład głosów** oraz osobno liczone **wstrzymania**.
- 🙋 **Wstrzymania poza matematyką**:
  - `?` i `☕` nie są estymatą. Nie wchodzą do średniej, mediany, mody ani konsensusu — pokój, w którym wszyscy wybrali `?`, pokazuje 0% zgody, a nie 100%.
- 👥 **Role w zespole**:
  - **Głosujący (Voter)** — deweloperzy i inżynierowie biorący udział w wycenie. Automatyczne odkrycie czeka na nich.
  - **Obserwator (Observer)** — Scrum Master, Product Owner, goście. Nie głosuje i nigdy nie blokuje odkrycia.
  - **Moderator** — twórca pokoju, wyznaczany automatycznie. Może estymować, ale nie musi. Szczegóły: [Role i model zaufania](#-role-i-model-zaufania).
- ⏱️ **Wbudowany timer dyskusji**:
  - Wspólne odliczanie z presetami (1m, 1.5m, 2m) i sygnałem dźwiękowym po upływie czasu. Dostępny dla wszystkich uczestników, nie tylko moderatora.
- 🔁 **Cykl rundowy i historia**:
  - Pole tematu zadania / User Story.
  - **Resetuj** czyści stół bez zmiany numeru rundy; **Zapisz wynik i dalej** archiwizuje rundę i przechodzi do następnej.
  - Start nowej rundy usuwa profile osób, które opuściły sesję — stół nie zbiera wyszarzonych duchów.
  - Historia zakończonych rund z wynikami i statystykami (przechowywane 100 ostatnich rund).
- 💬 **Reakcje na żywo**:
  - Pływające reakcje emoji (👍, 🚀, 🤔, ☕, 🔥) widoczne natychmiast dla całego zespołu, z ograniczeniem częstotliwości.
- 📱 **Mobile & Desktop First**:
  - Dopracowany interfejs w ciemnej tonacji (Dark Slate/Indigo).
  - Dopasowany do ekranów dotykowych telefonów, tabletów oraz szerokich monitorów.

---

## 🛡️ Role i model zaufania

Źródłem prawdy jest serwer, nie przeglądarka. Każda reguła poniżej jest egzekwowana po stronie serwera, a interfejs jedynie ją odzwierciedla.

### Kto co może

| Akcja | Głosujący | Obserwator | Moderator |
| --- | :---: | :---: | :---: |
| Oddanie głosu | ✅ | — | ✅ *(opcjonalnie)* |
| Ustawienie tematu rundy | ✅ | ✅ | ✅ |
| Wysyłanie reakcji | ✅ | ✅ | ✅ |
| Start / pauza / ustawienie timera | ✅ | ✅ | ✅ |
| Reset rundy | ✅ | ✅ | ✅ |
| **Odkrycie kart** | — | — | ✅ |
| **Zapis wyniku i przejście dalej** | — | — | ✅ |
| **Czyszczenie historii** | — | — | ✅ |
| **Zmiana skali estymacji** | — | — | ✅ |
| **Zmiana ustawień i nazwy pokoju** | — | — | ✅ |

Timer i reset rundy są świadomie otwarte dla wszystkich — w małym zespole ich blokowanie generuje więcej tarcia niż pożytku.

### Jak wybierany jest moderator

1. Pierwsza osoba, która wejdzie do pokoju, zostaje jego **twórcą** i moderatorem.
2. Gdy moderator się rozłączy, rola przechodzi na kolejnego uczestnika **według kolejności dołączania**.
3. Gdy twórca wróci, rola wraca do niego, a zastępca odzyskuje swoją poprzednią rolę.

Uczestnik może nadać sobie wyłącznie rolę `voter` albo `observer`. Rolę `moderator` przyznaje sam serwer.

### Tożsamość uczestnika

Przy dołączeniu serwer nadaje UUID oraz **token podpisany HMAC** nad parą `roomId:userId`, który klient trzyma w `sessionStorage`. Ponowne połączenie odsyła ten token i wznawia dotychczasowy wpis uczestnika. Brak lub podrobiony token kończy się przydzieleniem nowej, własnej tożsamości — nigdy przejęciem cudzego miejsca przy stole.

> Na produkcji ustaw `SESSION_SECRET`. Bez niego sekret jest losowany przy starcie, więc restart unieważnia wszystkie tokeny wznowienia.

### Walidacja wejścia

Wszystkie wiadomości WebSocket przechodzą przez jeden schemat z walidacją runtime (`src/protocol.ts`): nieznane typy są odrzucane, głos musi należeć do aktualnej talii pokoju, długości tekstów są ograniczone, ramka nie może przekroczyć 64 KB, a reakcje są throttlowane.

---

## 🛠️ Stos Technologiczny

- **Frontend**:
  - [React 19](https://react.dev/)
  - [TypeScript](https://www.typescriptlang.org/)
  - [Tailwind CSS v4](https://tailwindcss.com/)
  - [Lucide React](https://lucide.dev/) (ikony)
  - [Motion](https://motion.dev/) (animacje)
  - [Canvas Confetti](https://github.com/catdad/canvas-confetti) (efekty celebracji)
  - Web Audio API (natywne, lekkie efekty dźwiękowe bez zewnętrznych plików audio)
- **Backend**:
  - [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
  - [ws (WebSocket)](https://github.com/websockets/ws) do synchronicznego przesyłania zdarzeń
  - [Vite](https://vite.dev/) (serwowanie deweloperskie i optymalizacja buildu)
  - [esbuild](https://esbuild.github.io/) (kompilacja serwera produkcyjnego do pojedynczego pliku CJS)

Stan pokoi żyje w pamięci procesu serwera. Restart kasuje wszystkie pokoje i historię, a obecny projekt zakłada jedną instancję aplikacji.

---

## 🚀 Uruchomienie Lokalne

### Wymagania wstępne
- **Node.js**: w wersji `>= 18.0.0` (zalecany Node.js 20+)
- **bun** (repozytorium zawiera `bun.lock`) lub **npm** / **yarn** / **pnpm**

### Instalacja zależności
```bash
git clone https://github.com/justdoit-Jcob/planningpoker.4u.git
cd planningpoker.4u

bun install        # lub: npm install
```

### Dostępne skrypty

| Skrypt | Działanie |
| --- | --- |
| `bun run dev` | Serwer z Vite middleware na porcie `3000` |
| `bun run build` | Budowa frontendu i spakowanie serwera do `/dist` |
| `bun run start` | Uruchomienie builda produkcyjnego (`NODE_ENV=production`) |
| `bun run test` | Testy jednostkowe silnika statystyk |
| `bun run lint` | Kontrola typów `tsc --noEmit` |

Aplikacja będzie dostępna pod adresem: `http://localhost:3000`.

### Zmienne środowiskowe

| Zmienna | Domyślnie | Do czego służy |
| --- | --- | --- |
| `PORT` | `3000` | Port nasłuchu. Wstrzykiwany automatycznie przez większość platform PaaS (np. Cloud Run). |
| `NODE_ENV` | `development` | Wartość `production` serwuje gotowy katalog `/dist` zamiast uruchamiać Vite. Ustawiana przez `bun run start`. |
| `SESSION_SECRET` | losowy przy starcie | Podpisuje tokeny tożsamości uczestników. Ustaw na produkcji, żeby restart nie wyrzucał wszystkich z sesji. |

> Plik `.env.example` wymienia także `GEMINI_API_KEY` oraz `APP_URL`. Żadna z tych zmiennych nie jest obecnie odczytywana przez aplikację — to pozostałość po pierwotnym szkielecie z AI Studio.

---

## 🧪 Testy

```bash
bun run test
```

Uruchamia zestaw `node:test` przez `tsx`. Testy pokrywają `src/utils/stats.ts`, czystą funkcję stojącą za każdym podsumowaniem rundy: mediana parzysta i nieparzysta, talie nieliczbowe, obsługa wstrzymań, próg większości dla kawy oraz reguły określające, kto liczy się do rundy.

---

## 📂 Struktura Projektu

```text
├── src/
│   ├── components/            # Komponenty interfejsu
│   │   ├── CardDeck.tsx       # Dolny pasek z kartami do głosowania
│   │   ├── Header.tsx         # Górny pasek (powrót, timer, skala, reakcje, ustawienia)
│   │   ├── HistoryModal.tsx   # Historia zakończonych rund
│   │   ├── LobbyModal.tsx     # Ekran powitalny: imię, awatar, rola, pokój
│   │   ├── ParticipantsModal.tsx # Lista zespołu i status głosowania
│   │   ├── PokerTable.tsx     # Stół z kartami uczestników i statystykami
│   │   ├── ReactionsOverlay.tsx  # Pływające reakcje emoji
│   │   └── TopicBar.tsx       # Pasek tematu bieżącej rundy
│   ├── hooks/
│   │   └── useDismissOnOutside.ts # Zamykanie menu i pól edycji po kliknięciu obok
│   ├── utils/
│   │   ├── audio.ts           # Synteza dźwięku przez Web Audio API
│   │   ├── celebrate.ts       # Konfetti zgodności i konfetti z kawą
│   │   ├── polyfill.ts        # Zgodność ze środowiskiem przeglądarki
│   │   ├── stats.ts           # Średnia, mediana, konsensus, wstrzymania
│   │   └── stats.test.ts      # Testy jednostkowe silnika statystyk
│   ├── protocol.ts            # Schemat wiadomości WebSocket, walidacja, limity
│   ├── types.ts               # Wspólne typy, talie i pomocnicy ról
│   ├── App.tsx                # Orkiestracja aplikacji i klient WebSocket
│   ├── main.tsx               # Punkt wejścia aplikacji
│   └── index.css              # Style globalne (Tailwind CSS v4)
├── server.ts                  # Serwer Express, stan pokoi, tożsamość, autoryzacja
├── vite.config.ts             # Konfiguracja Vite
├── package.json               # Skrypty i zależności
├── README.md                  # Dokumentacja (angielska i polska)
└── README.pl.md               # Pełna dokumentacja polska
```

---

## 💡 Jak działa aplikacja?

1. **Dołączenie lub utworzenie pokoju**:
   - Podajesz imię, wybierasz kolor awatara, rolę (**Głosujący** lub **Obserwator**) oraz identyfikator pokoju (np. `SPRINT-42`).
   - Udostępnienie linku w formacie `?room=KOD_POKOJU` kieruje współpracowników do tego samego stołu. Pierwsza osoba zostaje moderatorem.
2. **Wybór tematu i kart**:
   - Dowolna osoba może wpisać tytuł estymowanego zadania.
   - Uczestnicy wybierają kartę z dolnego paska. Pozostali widzą wyłącznie to, że jesteś gotowy — nigdy którą kartę wybrałeś.
3. **Odkrycie kart (Reveal)**:
   - Moderator klika „Odkryj karty" albo odkrycie następuje automatycznie, gdy wszyscy głosujący oddadzą głos.
   - Pojawia się podsumowanie: średnia, mediana, stopień zgodności i rozkład głosów — z konfetti przy pełnej zgodzie albo konfetti z kawą, gdy pokój wybrał głównie ☕.
4. **Kolejna runda**:
   - „Zapisz wynik i dalej" archiwizuje rundę w historii i podbija licznik; „Resetuj" tylko czyści stół.
   - W obu przypadkach z pokoju znikają profile osób, które opuściły sesję.
5. **Wyjście z pokoju**:
   - Kliknięcie logo ♠ w nagłówku opuszcza pokój i wraca do lobby. Tożsamość zostaje zachowana, więc ponowne wejście do tego samego pokoju przywraca Twoje miejsce przy stole.

---

## 📄 Licencja

Projekt udostępniany na licencji [MIT](LICENSE).
Możesz go swobodnie rozwijać, dostosowywać i wdrażać we własnym zespole!
