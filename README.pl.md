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
  - Automatyczne wznawianie połączenia z narastającym opóźnieniem (1 s → 30 s), a przy powrocie do karty lub odzyskaniu sieci — natychmiast.
  - Dwie uzupełniające się warstwy keep-alive: **`PING` z klienta co 15 s**, żeby proxy z limitem bezczynności (Cloud Run, Nginx) nie zamknęło cichego tunelu, oraz **protokołowy ping/pong serwera co 30 s**, który wykrywa faktycznie martwe połączenia i je usuwa, zamiast zostawiać duchy przy stole.
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

## 🐳 Docker i homelab

### Gotowy obraz (zalecane na NAS)

Każde wypchnięcie na `main` publikuje wieloarchitekturowy obraz (`linux/amd64` + `linux/arm64`) w GitHub Container Registry, więc maszyna docelowa nie musi niczego kompilować:

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
docker compose up -d                          # pierwsze uruchomienie
docker compose pull && docker compose up -d   # aktualizacja do najnowszego obrazu
```

To ścieżka dla OpenMediaVault, Synology, Unraida i każdej maszyny, na której wolisz nie instalować narzędzi budowania. Nie wymaga ani `gita`, ani lokalnej kopii repozytorium — wystarczy ten jeden plik.

### Budowanie lokalnie ze źródeł

```bash
cp .env.example .env          # opcjonalnie: ustaw HOST_PORT / SESSION_SECRET
docker compose up -d --build
```

Aplikacja jest wtedy dostępna pod `http://<adres-hosta>:3000` albo na porcie ustawionym w `HOST_PORT`.

> Budowanie potrzebuje około 1 GB RAM na etap Vite oraz odpowiednio nowego BuildKita. Na słabszym NAS-ie lepiej użyć gotowego obrazu powyżej.

### Jak zbudowany jest obraz

Build jest dwuetapowy. **Bun** kompiluje frontend i pakuje serwer w jeden plik CommonJS z wbudowanymi `express`, `ws` i `dotenv`; **node:22-alpine** uruchamia już tylko ten bundle wraz z plikami statycznymi. Obraz uruchomieniowy nie zawiera więc **ani `node_modules`, ani żadnych narzędzi deweloperskich** — Vite jest ładowany przez import dynamiczny, do którego dochodzi wyłącznie ścieżka deweloperska.

Kontener działa jako nieuprzywilejowany użytkownik `node` i ma `HEALTHCHECK` odpytujący `/api/health` busyboxowym `wget`, więc `docker ps` pokazuje faktyczną gotowość, a nie samo „proces żyje”.

### Codzienne komendy

```bash
docker compose logs -f              # podgląd logów
docker compose restart              # restart usługi
docker compose up -d --build        # przebudowa po pobraniu zmian
docker compose down                 # zatrzymanie i usunięcie kontenera
```

### Za reverse proxy

Aplikacja opiera się na WebSocketach, więc proxy musi przepuścić upgrade połączenia. W **Nginx** / Nginx Proxy Manager oznacza to włączenie obsługi WebSocket dla hosta albo dodanie:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 3600s;
```

W **Traefiku** nie trzeba nic dodawać — upgrade jest przepuszczany domyślnie.

Klient wysyła `PING` co 15 sekund właśnie po to, żeby proxy z limitem bezczynności nie zamknęło cichego tunelu, ale podniesienie `proxy_read_timeout` i tak warto zrobić.

**Sieci blokujące WebSockety.** Część sieci firmowych (proxy z inspekcją TLS, bramki SWG) przepuszcza zwykłe HTTPS, ale ucina upgrade do WebSocketu — strona się ładuje, a pokój nigdy się nie łączy. Klient radzi sobie z tym sam: jeśli WebSocket nie dostarczy żadnej ramki w ciągu 6 sekund, przechodzi na HTTP long-polling pod `/api/rt/*` (wstrzymany `GET` na ramki przychodzące, `POST` na wychodzące) i zostaje przy nim do końca sesji karty. Logika pokoi jest na obu transportach identyczna. Jedyny wymóg: nic po drodze nie może cache'ować `/api/rt/*` — odpowiedzi niosą `Cache-Control: no-store`.

### Skalowanie

Stan pokoi żyje w pamięci procesu serwera, więc **uruchamiaj jedną replikę**. Druga instancja obsługiwałaby własny, całkowicie odrębny zestaw pokoi. Nie ma też czego podpinać jako wolumen — restart świadomie kasuje wszystkie pokoje i historię.

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
│   ├── transport.ts           # Połączenie realtime: WebSocket z zapasowym long-pollingiem
│   ├── types.ts               # Wspólne typy, talie i pomocnicy ról
│   ├── App.tsx                # Orkiestracja aplikacji i klient czasu rzeczywistego
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
