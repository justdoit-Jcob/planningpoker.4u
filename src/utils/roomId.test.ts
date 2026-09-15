import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createRoomCode, createRoomId } from './roomId';

describe('createRoomId', () => {
  it('zawsze ma format ROOM-XXXX z alfabetu bez 0/O i 1/I', () => {
    for (let i = 0; i < 5000; i++) {
      assert.match(createRoomId(), /^ROOM-[A-HJ-NP-Z2-9]{4}$/);
    }
  });

  it('za każdym razem generuje inny identyfikator', () => {
    // 1000 losowań z ~1 mln kodów: oczekiwane ~0,5 kolizji.
    const ids = new Set(Array.from({ length: 1000 }, () => createRoomId()));
    assert.ok(ids.size >= 995, `unikalnych: ${ids.size}`);
  });

  it('używa wszystkich 32 znaków alfabetu', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) createRoomCode().split('').forEach((c) => seen.add(c));
    assert.equal(seen.size, 32);
  });
});
