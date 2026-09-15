/**
 * Połączenie z serwerem czasu rzeczywistego z transportem zapasowym.
 *
 * Najpierw próbujemy WebSocketu. Część sieci firmowych (proxy z inspekcją TLS,
 * bramki SWG) przepuszcza jednak zwykłe HTTPS, a ucina upgrade do WebSocketu:
 * strona się ładuje, a pokój nie. Gdy WebSocket nie dostarczy żadnej ramki,
 * połączenie przechodzi na HTTP long-polling, a jeśli ten zadziała —
 * zapamiętuje wybór do końca sesji karty.
 *
 * Reszta aplikacji widzi jeden interfejs i nie wie, którą drogą idą ramki.
 */

import { POLLING } from './protocol';

/**
 * Keep-alive na poziomie aplikacji (tylko WebSocket).
 *
 * Serwer ma własny heartbeat protokołowy (ping/pong biblioteki ws), który
 * wykrywa i usuwa martwe połączenia. Ten interwał rozwiązuje inny problem:
 * ruch wychodzący od klienta resetuje liczniki bezczynności na proxy
 * (Cloud Run, Nginx), które potrafią zamknąć cichy tunel WebSocket.
 * Long-polling tego nie potrzebuje — sam jest nieustannym ruchem.
 */
const KEEPALIVE_INTERVAL_MS = 15000;

/**
 * Ile czekamy na pierwszą ramkę z WebSocketu, zanim uznamy go za zablokowany.
 * Część proxy nie odrzuca upgrade'u, tylko wstrzymuje go bez odpowiedzi.
 */
const WEBSOCKET_PROBE_MS = 6000;

/** Zapas ponad czas, przez który serwer trzyma GET. */
const POLL_TIMEOUT_MS = POLLING.holdMs + 10000;
const REQUEST_TIMEOUT_MS = 10000;

const TRANSPORT_STORAGE_KEY = 'poker_transport';

export type ConnectionState = 'connecting' | 'open' | 'closed';

export interface ConnectionHandlers {
  /** Transport gotowy do wysyłki. Po przejściu na zapasowy wywoływane ponownie. */
  onOpen: () => void;
  onMessage: (data: unknown) => void;
  /** Połączenie utracone. Wywoływane co najwyżej raz i nigdy po close(). */
  onClose: () => void;
}

export interface Connection {
  /** Wysyła wiadomość; false, gdy połączenie nie jest otwarte i wiadomość przepadła. */
  send(msg: object): boolean;
  /** Rozłączenie na życzenie — nie wywołuje onClose. */
  close(): void;
  readonly state: ConnectionState;
}

interface TransportEvents {
  onOpen(): void;
  onMessage(data: unknown): void;
  onClose(): void;
}

interface Transport {
  send(frame: string): void;
  close(): void;
}

function prefersPolling(): boolean {
  try {
    return sessionStorage.getItem(TRANSPORT_STORAGE_KEY) === 'polling';
  } catch {
    return false;
  }
}

function rememberPolling(): void {
  try {
    sessionStorage.setItem(TRANSPORT_STORAGE_KEY, 'polling');
  } catch {
    // Bez pamięci kolejne połączenie znów spróbuje WebSocketu — kosztuje to tylko chwilę.
  }
}

/* ---------- WebSocket ---------- */

function createWebSocketTransport(events: TransportEvents): Transport {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const detach = () => {
    closed = true;
    if (keepAlive !== null) clearInterval(keepAlive);
    keepAlive = null;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
  };

  ws.onopen = () => {
    keepAlive = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'PING' }));
    }, KEEPALIVE_INTERVAL_MS);
    events.onOpen();
  };

  ws.onmessage = (event) => {
    let data: unknown;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
      return;
    }
    events.onMessage(data);
  };

  // Błąd kończy gniazdo. Przeglądarki wysyłają po nim jeszcze close, ale nie
  // każda implementacja robi to od razu — nie czekamy na nie.
  ws.onerror = (err) => {
    console.warn('WebSocket connection error:', err);
    if (closed) return;
    detach();
    ws.close();
    events.onClose();
  };

  ws.onclose = () => {
    if (closed) return;
    detach();
    events.onClose();
  };

  return {
    send(frame) {
      if (ws.readyState === WebSocket.OPEN) ws.send(frame);
    },
    close() {
      if (closed) return;
      detach();
      ws.close();
    },
  };
}

/* ---------- HTTP long-polling ---------- */

function createPollingTransport(events: TransportEvents): Transport {
  const base = `${location.origin}/api/rt`;
  const inflight = new Set<AbortController>();
  let sid: string | null = null;
  let closed = false;
  let outbox: string[] = [];
  let sending = false;

  /** Żądanie z limitem czasu; zwraca sparsowane ciało albo null dla 204. */
  const request = async (path: string, init: RequestInit, timeoutMs: number): Promise<unknown> => {
    const controller = new AbortController();
    inflight.add(controller);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}${path}`, { ...init, cache: 'no-store', signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${path.split('?')[0]}`);
      return res.status === 204 ? null : await res.json();
    } finally {
      clearTimeout(timer);
      inflight.delete(controller);
    }
  };

  const releaseSession = () => {
    if (!sid) return;
    // keepalive: żądanie przeżyje zamknięcie karty.
    fetch(`${base}/close?sid=${encodeURIComponent(sid)}`, { method: 'POST', keepalive: true }).catch(
      () => {}
    );
  };

  // Zamknięcie karty: bez tego uczestnik wisiałby jako online aż do wygaśnięcia sesji.
  const onPageHide = () => releaseSession();

  const detach = () => {
    closed = true;
    inflight.forEach((controller) => controller.abort());
    inflight.clear();
    outbox = [];
    removeEventListener('pagehide', onPageHide);
  };

  const fail = (reason: unknown) => {
    if (closed) return;
    console.warn('Long-polling przerwany:', reason);
    detach();
    events.onClose();
  };

  const deliver = (frame: unknown) => {
    try {
      events.onMessage(frame);
    } catch (e) {
      console.error('Failed to handle server message:', e);
    }
  };

  const flush = () => {
    if (closed || sending || !sid || outbox.length === 0) return;
    // Wysyłka jest szeregowa, więc serwer dostaje wiadomości w kolejności kliknięć.
    const batch = outbox.splice(0, POLLING.maxBatch);
    sending = true;
    request(
      `/send?sid=${encodeURIComponent(sid)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: `[${batch.join(',')}]`,
      },
      REQUEST_TIMEOUT_MS
    ).then(
      () => {
        sending = false;
        flush();
      },
      (err) => {
        sending = false;
        fail(err);
      }
    );
  };

  const run = async () => {
    try {
      const opened = await request('/open', { method: 'POST' }, REQUEST_TIMEOUT_MS);
      const id = (opened as { sid?: unknown } | null)?.sid;
      if (typeof id !== 'string') throw new Error('Serwer nie nadał identyfikatora sesji');
      if (closed) return;

      sid = id;
      addEventListener('pagehide', onPageHide);
      events.onOpen();

      while (!closed) {
        const frames = await request(
          `/poll?sid=${encodeURIComponent(id)}`,
          { method: 'GET' },
          POLL_TIMEOUT_MS
        );
        if (!Array.isArray(frames)) throw new Error('Nieprawidłowa odpowiedź long-pollingu');
        for (const frame of frames) {
          if (closed) return;
          deliver(frame);
        }
      }
    } catch (err) {
      fail(err);
    }
  };

  run();

  return {
    send(frame) {
      if (closed || !sid) return;
      outbox.push(frame);
      flush();
    },
    close() {
      if (closed) return;
      detach();
      releaseSession();
    },
  };
}

/* ---------- Połączenie z wyborem transportu ---------- */

export function openConnection(handlers: ConnectionHandlers): Connection {
  let state: ConnectionState = 'connecting';
  let transport: Transport;
  let probeTimer: ReturnType<typeof setTimeout> | null = null;

  const stopProbe = () => {
    if (probeTimer !== null) clearTimeout(probeTimer);
    probeTimer = null;
  };

  const lose = () => {
    if (state === 'closed') return;
    state = 'closed';
    handlers.onClose();
  };

  const usePolling = (afterWebSocketFailure: boolean) => {
    state = 'connecting';
    transport = createPollingTransport({
      onOpen: () => {
        // Zapamiętujemy dopiero, gdy HTTP działa. Jeśli leży cały serwer,
        // następna próba znów zacznie od WebSocketu.
        if (afterWebSocketFailure) {
          rememberPolling();
          console.warn('WebSocket jest blokowany w tej sieci — połączenie działa przez HTTP long-polling.');
        }
        state = 'open';
        handlers.onOpen();
      },
      onMessage: handlers.onMessage,
      onClose: lose,
    });
  };

  const useWebSocket = () => {
    let delivered = false;

    const fallBack = () => {
      stopProbe();
      transport.close();
      usePolling(true);
    };

    probeTimer = setTimeout(fallBack, WEBSOCKET_PROBE_MS);
    transport = createWebSocketTransport({
      onOpen: () => {
        state = 'open';
        handlers.onOpen();
      },
      onMessage: (data) => {
        if (!delivered) {
          delivered = true;
          stopProbe();
        }
        handlers.onMessage(data);
      },
      // Gniazdo, które nie dostarczyło ani jednej ramki, traktujemy jak zablokowane.
      onClose: () => (delivered ? lose() : fallBack()),
    });
  };

  if (prefersPolling()) usePolling(false);
  else useWebSocket();

  return {
    send(msg) {
      if (state !== 'open') return false;
      transport.send(JSON.stringify(msg));
      return true;
    },
    close() {
      stopProbe();
      state = 'closed';
      transport.close();
    },
    get state() {
      return state;
    },
  };
}
