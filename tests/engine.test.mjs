import test from 'node:test';
import assert from 'node:assert/strict';
import * as e from '../dist/engine.js';
const copy = (x) => JSON.parse(JSON.stringify(x));
const other = (side) => side === 'player' ? 'enemy' : 'player';
const castle = (s, side, id) => s.castles[side].find((c) => c.id === id);
const attackSide = (s) => s.phase === 'playerAttack' ? 'player' : s.phase === 'aiAttack' ? 'enemy' : null;
const defendSide = (s) => s.phase === 'playerDefense' ? 'player' : s.phase === 'aiDefense' ? 'enemy' : null;
const ids = Object.keys(e.ORDERS);
function init(player = ['volley', 'ram'], enemy = ['catapult', 'mist'], neutralOrder = 'banner', options = {}) {
  return e.createGame({ seed: 'tests', hands: { player, enemy }, neutralOrder, ...options });
}
function payload(s, side, orderId, targetId = 'left', heroId = 'neris') {
  return e.legalAttacks(s, side).find((a) => a.orderId === orderId && a.targetId === targetId && a.heroId === heroId);
}
function strike(s, side, orderId, targetId = 'left', heroId = 'neris', defense = 'brace') {
  return e.applyDefense(e.applyAttack(s, side, payload(s, side, orderId, targetId, heroId)), other(side), { orderId: defense });
}
function openMain(s, side, id = 'left') {
  castle(s, side, id).hp = 0;
  for (const hero of Object.values(s.heroes[side])) if (hero.castleId === id) hero.castleId = 'main';
}
function freezeDeep(x) { Object.freeze(x); for (const value of Object.values(x)) if (value && typeof value === 'object' && !Object.isFrozen(value)) freezeDeep(value); return x; }
function assertValid(s) {
  assert.equal(e.validateState(s), true);
  assert.deepEqual([...s.hands.player, ...s.hands.enemy, s.neutralOrder].sort(), [...ids].sort());
  assert.deepEqual(copy(s), s);
  for (const side of ['player', 'enemy']) {
    assert.equal(s.hands[side].length, 2);
    for (const c of s.castles[side]) { assert.ok(c.hp >= 0 && c.hp <= c.maxHp); assert.ok([0, 12].includes(c.cover)); }
  }
  if (!s.winner) assert.ok(attackSide(s) ? e.legalAttacks(s, attackSide(s)).length > 0 : e.legalDefenses(s, defendSide(s)).length > 0);
}
test('v3 constants and five counter-family faces have no retired resource layers', () => {
  const s = init(); assert.equal(s.version, 3);
  assert.equal(ids.length, 5); assert.equal(e.ORDERS.ram.damage, 38);
  assert.deepEqual(ids.map((id) => e.ORDERS[id].guardType), ['stone', 'sound', 'arrow', 'steel', 'universal']);
  assert.equal(e.RULES.localGuardBonus, 4); assert.equal(e.RULES.braceBlock, 8);
  assert.equal(castle(s, 'player', 'left').hp, 90); assert.equal(castle(s, 'player', 'main').hp, 150);
  for (const key of ['energy', 'cooldowns', 'fatigue', 'decisionIndex']) assert.ok(!(key in s));
  assert.ok(Object.isFrozen(e.ORDERS)); assert.ok(Object.isFrozen(e.ORDERS.volley)); assertValid(s);
});
test('seeded deals and initiative are deterministic and cover all five cards', () => {
  for (let seed = 0; seed < 120; seed++) {
    assert.deepEqual(e.createGame({ seed, firstSide: 'random' }), e.createGame({ seed, firstSide: 'random' }));
    assertValid(e.createGame({ seed }));
  }
  assert.notDeepEqual(e.createGame({ seed: 1 }).hands, e.createGame({ seed: 2 }).hands);
  assert.equal(e.createGame({ firstSide: 'enemy' }).phase, 'aiAttack');
});
test('one exchange happens on declaration, in the spent card slot', () => {
  const s = init(), before = copy(s), a = e.applyAttack(s, 'player', { orderId: 'volley', heroId: 'ilda', targetId: 'left' });
  assert.deepEqual(s, before); assert.deepEqual(a.hands.player, ['banner', 'ram']);
  assert.deepEqual(a.hands.enemy, s.hands.enemy); assert.equal(a.neutralOrder, 'volley'); assert.equal(a.phase, 'aiDefense'); assert.equal(a.pendingAttack.damage, 33); assertValid(a);
});
test('guard commits a pre-existing held card and never changes any card ownership', () => {
  const a = e.applyAttack(init(), 'player', { orderId: 'volley', heroId: 'ilda', targetId: 'left' });
  assert.throws(() => e.applyDefense(a, 'enemy', { orderId: 'volley', heroId: 'kora' }));
  const d = e.applyDefense(a, 'enemy', { orderId: 'catapult', heroId: 'kora' });
  assert.deepEqual(d.hands, a.hands); assert.equal(d.neutralOrder, a.neutralOrder); assert.equal(d.committedOrder.enemy, 'catapult');
  assert.equal(d.phase, 'aiAttack'); assert.equal(d.lastEvent.heroId, 'ilda'); assert.equal(d.lastEvent.defendingHeroId, 'kora'); assert.deepEqual([...new Set(e.legalAttacks(d, 'enemy').map((x) => x.orderId))], ['mist']);
  assert.throws(() => e.applyAttack(d, 'enemy', { orderId: 'catapult', heroId: 'kora', targetId: 'left' }));
  const next = e.applyAttack(d, 'enemy', { orderId: 'mist', heroId: 'neris', targetId: 'left' });
  assert.equal(next.committedOrder.enemy, null); assert.deepEqual(next.hands.enemy, ['catapult', 'volley']); assert.equal(next.neutralOrder, 'mist'); assertValid(next);
});
test('brace preserves both next attack choices and has no local bonus', () => {
  const a = e.applyAttack(init(), 'player', { orderId: 'ram', heroId: 'kora', targetId: 'left' });
  const p = e.previewDefense(a, 'brace'); assert.equal(p.blocked, 8); assert.equal(p.localBonus, 0); assert.equal(p.nextAttackOrders.length, 2);
  const d = e.applyDefense(a, 'enemy', 'brace'); assert.equal(d.committedOrder.enemy, null); assert.equal(new Set(e.legalAttacks(d, 'enemy').map((x) => x.orderId)).size, 2);
});
test('cross-family matching and local bonuses use the guarding order and station', () => {
  const a = e.applyAttack(init(), 'player', { orderId: 'volley', heroId: 'ilda', targetId: 'left' });
  assert.equal(e.previewDefense(a, { orderId: 'catapult', heroId: 'kora' }).combinedBlock, 26);
  assert.equal(e.previewDefense(a, { orderId: 'catapult', heroId: 'neris' }).combinedBlock, 22);
  assert.equal(e.previewDefense(a, { orderId: 'mist', heroId: 'kora' }).combinedBlock, 0);
  assert.equal(e.previewDefense(a, { orderId: 'mist', heroId: 'kora' }).damage, 33);
  assert.equal(e.applyDefense(a, 'enemy', { orderId: 'mist', heroId: 'kora' }).committedOrder.enemy, 'mist');
});
test('Banner guards every family for 18 plus local 4', () => {
  for (const orderId of ['volley', 'ram', 'catapult', 'mist']) {
    const remaining = ids.filter((id) => ![orderId, 'banner'].includes(id));
    const s = init([orderId, remaining[0]], ['banner', remaining[1]], remaining[2]);
    const a = e.applyAttack(s, 'player', { orderId, heroId: 'kora', targetId: 'left' });
    assert.equal(e.previewDefense(a, { orderId: 'banner', heroId: 'kora' }).combinedBlock, 22);
  }
});
test('Mist pierces the first 8 combined guard, local and cover, once', () => {
  const s = init(['mist', 'catapult'], ['ram', 'banner'], 'volley'); castle(s, 'enemy', 'left').cover = 12;
  const a = e.applyAttack(s, 'player', { orderId: 'mist', heroId: 'neris', targetId: 'left' });
  const p = e.previewDefense(a, { orderId: 'ram', heroId: 'kora' });
  assert.equal(p.incoming, 27); assert.equal(p.combinedBlock, 38); assert.equal(p.pierced, 8); assert.equal(p.blocked, 27); assert.equal(p.damage, 0);
  assert.equal(e.previewDefense(a, 'brace').damage, 15);
  const withoutCover = copy(a); castle(withoutCover, 'enemy', 'left').cover = 0; assert.equal(e.previewDefense(withoutCover, 'brace').damage, 27);
});
test('Catapult repeat checks immediately previous own attack target, including another order', () => {
  const s = init(['catapult', 'ram'], ['mist', 'volley'], 'banner');
  const first = e.previewAttack(s, { side: 'player', orderId: 'catapult', heroId: 'kora', targetId: 'left' }); assert.equal(first.damage, 25); assert.equal(first.repeatBonus, 0);
  s.lastOwnTarget.player = 'left';
  assert.equal(e.previewAttack(s, { side: 'player', orderId: 'catapult', heroId: 'kora', targetId: 'left' }).damage, 43);
  assert.equal(e.previewAttack(s, { side: 'player', orderId: 'catapult', heroId: 'kora', targetId: 'right' }).damage, 25);
  const a = e.applyAttack(s, 'player', { orderId: 'ram', heroId: 'neris', targetId: 'right' }); assert.equal(a.lastOwnTarget.player, 'right');
});
test('native bonuses are type-specific and optional Kora training is visible/capped', () => {
  const s = init(['volley', 'catapult'], ['ram', 'mist'], 'banner', { trainingEnabled: true, trainingBySide: { player: 99, enemy: -1 } });
  assert.equal(s.trainingBySide.player, 3); assert.equal(s.trainingBySide.enemy, 0);
  const k = e.previewAttack(s, { side: 'player', orderId: 'catapult', heroId: 'kora', targetId: 'left' }); assert.equal(k.damage, 28); assert.equal(k.nativeBonus, 3); assert.equal(k.trainingBonus, 3);
  const i = e.previewAttack(s, { side: 'player', orderId: 'volley', heroId: 'ilda', targetId: 'left' }); assert.equal(i.damage, 33); assert.equal(i.trainingBonus, 0);
  assert.equal(e.previewAttack(s, { side: 'player', orderId: 'volley', heroId: 'kora', targetId: 'left' }).trainingBonus, 0);
  assert.equal(e.createGame({ trainingBySide: { player: 3 } }).trainingBySide.player, 0);
});
test('Banner creates source-only cover, overwrites and consumes it on the next targeted hit', () => {
  const s = init(['banner', 'volley'], ['ram', 'mist'], 'catapult'); castle(s, 'player', 'left').cover = 12;
  const a = e.applyAttack(s, 'player', { orderId: 'banner', heroId: 'kora', targetId: 'right' });
  assert.equal(castle(a, 'player', 'left').cover, 12); assert.equal(castle(a, 'player', 'right').cover, 0);
  const d = e.applyDefense(a, 'enemy', 'brace');
  const r = e.applyAttack(d, 'enemy', { orderId: 'ram', heroId: 'kora', targetId: 'left' });
  assert.equal(e.previewDefense(r, 'brace').damage, 18);
  const resolved = e.applyDefense(r, 'player', 'brace'); assert.equal(castle(resolved, 'player', 'left').cover, 0); assert.equal(castle(resolved, 'player', 'left').hp, 72);
});
test('fully blocked hits still consume Banner cover', () => {
  const s = init(); castle(s, 'enemy', 'left').cover = 12;
  const a = e.applyAttack(s, 'player', { orderId: 'volley', heroId: 'ilda', targetId: 'left' });
  const d = e.applyDefense(a, 'enemy', { orderId: 'catapult', heroId: 'kora' }); assert.equal(d.lastEvent.hpLost, 0); assert.equal(castle(d, 'enemy', 'left').cover, 0);
});
test('source and target may be any surviving castle with an active guardian; main is gated', () => {
  const s = init(); assert.deepEqual(e.legalTargets(s, 'player').map((c) => c.id), ['left', 'right']);
  assert.throws(() => e.applyAttack(s, 'player', { orderId: 'ram', heroId: 'neris', targetId: 'main' }));
  for (const heroId of ['kora', 'ilda', 'neris']) assert.ok(payload(s, 'player', 'ram', 'left', heroId));
  openMain(s, 'enemy'); assert.deepEqual(e.legalTargets(s, 'player').map((c) => c.id), ['main', 'right']); assertValid(s);
});
test('side fall retreats its guardian for exactly the next own attack, then it can guard main', () => {
  const s = init(); castle(s, 'enemy', 'left').hp = 1;
  const d = strike(s, 'player', 'ram'); assert.equal(d.heroes.enemy.kora.castleId, 'main'); assert.equal(d.heroes.enemy.kora.retreatRounds, 1);
  assert.equal(e.legalAttacks(d, 'enemy').some((a) => a.heroId === 'kora'), false);
  assert.throws(() => e.applyAttack(d, 'enemy', { orderId: 'mist', heroId: 'kora', targetId: 'left' }));
  const a = e.applyAttack(d, 'enemy', { orderId: 'mist', heroId: 'neris', targetId: 'left' }); assert.equal(a.heroes.enemy.kora.retreatRounds, 0);
  const next = e.applyDefense(a, 'player', 'brace'); const hit = e.applyAttack(next, 'player', { orderId: 'volley', heroId: 'ilda', targetId: 'main' });
  assert.ok(e.legalDefenses(hit, 'enemy').some((guard) => guard.heroId === 'kora' && guard.localBonus === 4)); assertValid(hit);
});
test('main destruction terminates immediately with clamped HP and no legal next actions', () => {
  const s = init(); openMain(s, 'enemy'); castle(s, 'enemy', 'main').hp = 1;
  const d = strike(s, 'player', 'ram', 'main'); assert.equal(d.winner, 'player'); assert.equal(d.phase, 'finished'); assert.equal(castle(d, 'enemy', 'main').hp, 0); assert.equal(d.pendingAttack, null);
  assert.deepEqual(e.legalAttacks(d, 'player'), []); assert.deepEqual(e.legalDefenses(d, 'enemy'), []); assertValid(d);
  assert.throws(() => e.applyAttack(d, 'player', { orderId: 'volley', heroId: 'ilda', targetId: 'right' }));
});
test('all public mutation paths preserve frozen inputs and previews match every exact guard outcome', () => {
  for (let seed = 0; seed < 12; seed++) {
    const s = freezeDeep(e.createGame({ seed }));
    for (const action of e.legalAttacks(s, 'player')) {
      const before = copy(s), preview = e.previewAttack(s, action), a = e.applyAttack(s, 'player', action); assert.deepEqual(s, before);
      assert.deepEqual(preview.handAfter, a.hands.player); assert.equal(preview.neutralAfter, a.neutralOrder); assert.equal(preview.nextReceivedOrder, s.neutralOrder);
      freezeDeep(a);
      for (const guard of e.legalDefenses(a, 'enemy')) {
        const p = e.previewDefense(a, guard), d = e.applyDefense(a, 'enemy', guard);
        assert.equal(d.lastEvent.hpLost, p.hpLost); assert.equal(d.lastEvent.blocked, p.blocked); assert.equal(castle(d, 'enemy', action.targetId).hp, p.hpAfter);
        assert.deepEqual(d.hands.enemy, p.handAfter); assert.equal(d.committedOrder.enemy, p.committedOrder); assertValid(d);
      }
    }
  }
});
test('illegal actions, repeated clicks, off-turn calls and stale revisions are rejected', () => {
  const s = init(), p = { orderId: 'ram', heroId: 'neris', targetId: 'left', revision: 0 }, a = e.applyAttack(s, 'player', p);
  assert.throws(() => e.applyAttack(a, 'player', p)); assert.throws(() => e.applyDefense(s, 'enemy', 'brace'));
  assert.throws(() => e.applyAttack(s, 'enemy', p)); assert.throws(() => e.applyAttack(s, 'player', { ...p, orderId: 'banner' }));
  assert.throws(() => e.applyAttack(s, 'player', { ...p, heroId: 'unknown' })); assert.throws(() => e.applyAttack(s, 'player', { ...p, targetId: 'unknown' }));
  assert.throws(() => e.applyDefense(a, 'enemy', { orderId: 'brace', revision: 0 }));
  const d = e.applyDefense(a, 'enemy', 'brace'); assert.throws(() => e.applyDefense(d, 'enemy', 'brace'));
  const before = copy(a); assert.throws(() => e.applyDefense(a, 'enemy', { orderId: 'missing' })); assert.deepEqual(a, before);
});
test('invalid serialized states and deals are rejected instead of silently repaired', () => {
  const mutations = [s => s.version = 2, s => s.phase = 'weird', s => s.hands.player[0] = s.neutralOrder, s => s.hands.enemy.pop(), s => s.committedOrder.player = s.neutralOrder,
    s => castle(s, 'player', 'left').hp = -1, s => castle(s, 'player', 'left').hp = NaN, s => castle(s, 'player', 'left').cover = 24, s => s.heroes.player.kora.castleId = 'nowhere',
    s => s.heroes.player.kora.retreatRounds = 2, s => s.trainingBySide.enemy = 4, s => s.pendingAttack = {}, s => s.winner = 'player', s => s.round = 0];
  for (const mutate of mutations) { const s = init(); mutate(s); assert.throws(() => e.validateState(s)); assert.throws(() => e.applyAttack(s, 'player', { orderId: 'ram', heroId: 'neris', targetId: 'left' })); }
  assert.throws(() => e.createGame({ hands: { player: ['ram', 'ram'], enemy: ['volley', 'mist'] }, neutralOrder: 'banner' }));
  assert.throws(() => e.createGame({ firstSide: 'nobody' }));
});
test('phase sequence alternates and round increments only after two complete attacks', () => {
  let s = init(); s = e.applyAttack(s, 'player', { orderId: 'volley', heroId: 'ilda', targetId: 'left' }); assert.equal(s.phase, 'aiDefense'); assert.equal(s.round, 1);
  s = e.applyDefense(s, 'enemy', 'brace'); assert.equal(s.phase, 'aiAttack'); assert.equal(s.round, 1);
  s = e.applyAttack(s, 'enemy', { orderId: 'mist', heroId: 'neris', targetId: 'left' }); assert.equal(s.phase, 'playerDefense');
  s = e.applyDefense(s, 'player', 'brace'); assert.equal(s.phase, 'playerAttack'); assert.equal(s.round, 2); assert.equal(s.turnIndex, 2);
});
test('AI is deterministic, legal, side-symmetric in mirrored public states and read-only', () => {
  const s = init(), before = copy(s), p = e.selectAttack(s, 'player'); assert.deepEqual(e.selectAttack(s, 'player'), p); assert.deepEqual(s, before);
  const mirror = copy(s); for (const key of ['hands', 'castles', 'heroes', 'committedOrder', 'lastOwnTarget', 'attackCount', 'trainingBySide']) [mirror[key].player, mirror[key].enemy] = [mirror[key].enemy, mirror[key].player]; mirror.phase = 'aiAttack'; mirror.firstSide = 'enemy';
  assert.deepEqual(e.selectAttack(mirror, 'enemy'), p);
  const a = e.applyAttack(s, 'player', p), g = e.selectDefense(a, 'enemy'); assert.deepEqual(e.chooseAIAction(a), g); assertValid(e.applyDefense(a, 'enemy', g));
});
test('500 seeded randomized games preserve card/HP/actionability invariants through termination', () => {
  for (let seed = 1; seed <= 500; seed++) {
    let s = e.createGame({ seed, firstSide: seed % 2 ? 'player' : 'enemy', trainingEnabled: seed % 3 === 0, trainingBySide: { player: seed % 4, enemy: (seed + 1) % 4 } }); let rng = seed;
    const pick = (list) => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return list[rng % list.length]; };
    for (let turn = 0; turn < 1000 && !s.winner; turn++) {
      assertValid(s); const side = attackSide(s) ?? defendSide(s);
      s = attackSide(s) ? e.applyAttack(s, side, pick(e.legalAttacks(s, side))) : e.applyDefense(s, side, pick(e.legalDefenses(s, side)));
    }
    assertValid(s); assert.ok(s.winner, `seed ${seed} did not terminate within 500 attacks`);
  }
});

test('corrupted pending attack fields fail before damage arithmetic or state mutation', () => {
  const pending = e.applyAttack(init(), 'player', { orderId: 'ram', heroId: 'neris', targetId: 'left' });
  for (const [key, value] of [['pierce', undefined], ['pierce', 'broken'], ['damage', 9999], ['baseDamage', 999], ['nativeBonus', 10], ['trainingBonus', NaN], ['repeatBonus', -18], ['sourceCover', 999], ['sourceId', 'right'], ['previousTarget', undefined]]) {
    const s = copy(pending); if (value === undefined) delete s.pendingAttack[key]; else s.pendingAttack[key] = value;
    assert.throws(() => e.validateState(s), key); assert.throws(() => e.applyDefense(s, 'enemy', 'brace'), key);
  }
});

test('malformed inactive commitment and all-retreat saves cannot create nonterminal dead ends', () => {
  const allRetreat = init(); for (const hero of Object.values(allRetreat.heroes.player)) { hero.castleId = 'main'; hero.retreatRounds = 1; }
  assert.throws(() => e.validateState(allRetreat));
  const invalidCommit = init(); invalidCommit.committedOrder.enemy = invalidCommit.hands.enemy[0]; assert.throws(() => e.validateState(invalidCommit));
});

test('prototype-property names are never valid order or guardian identities', () => {
  for (const invalid of ['toString', 'constructor', '__proto__']) {
    const hand = init(); hand.hands.player[0] = invalid;
    assert.throws(() => e.validateState(hand), `held order ${invalid}`);
    assert.throws(() => e.applyAttack(hand, 'player', { orderId: 'ram', heroId: 'neris', targetId: 'left' }));
    const neutral = init(); neutral.neutralOrder = invalid; assert.throws(() => e.validateState(neutral), `neutral ${invalid}`);
    const incomingOrder = e.applyAttack(init(), 'player', { orderId: 'ram', heroId: 'neris', targetId: 'left' }); incomingOrder.pendingAttack.orderId = invalid;
    assert.throws(() => e.validateState(incomingOrder), `pending order ${invalid}`);
    const incomingHero = e.applyAttack(init(), 'player', { orderId: 'ram', heroId: 'neris', targetId: 'left' }); incomingHero.pendingAttack.heroId = invalid;
    assert.throws(() => e.validateState(incomingHero), `pending guardian ${invalid}`); assert.throws(() => e.applyDefense(incomingHero, 'enemy', 'brace'));
    const extraHero = init(); Object.defineProperty(extraHero.heroes.player, invalid, { value: { castleId: 'left', retreatRounds: 0 }, enumerable: true });
    assert.throws(() => e.validateState(extraHero), `guardian table ${invalid}`);
  }
});
