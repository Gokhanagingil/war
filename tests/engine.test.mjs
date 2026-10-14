import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEROES, ATTACKS, DEFENSES, RULES, createGame, legalTargets, availableAttacks,
  availableDefenses, previewAttack, previewDefense, applyAttack, applyDefense,
  playerAttack, resolveAiDefense, chooseAiAttack, playerDefend, describeState,
} from '../dist/engine.js';

const SIDES = ['player', 'enemy'];
const HERO_IDS = ['kora', 'ilda', 'neris'];
const QUICK = { kora: 50, ilda: 42, neris: 46 };
const GUARD = { kora: 34, ilda: 30, neris: 32 };
const STATION = { kora: 'left', ilda: 'right', neris: 'main' };
const other = (side) => side === 'player' ? 'enemy' : 'player';
const copy = (value) => JSON.parse(JSON.stringify(value));
const castle = (state, side, id) => state.castles[side].find((entry) => entry.id === id);
const attack = (state, side, id) => availableAttacks(state, side).find((entry) => entry.id === id);
const defense = (state, side, id) => availableDefenses(state, side).find((entry) => entry.id === id);
const attackPhase = (side) => side === 'player' ? 'playerAttack' : 'aiAttack';
const defensePhase = (side) => side === 'player' ? 'playerDefense' : 'aiDefense';
const attackingSide = (state) => state.phase === 'playerAttack' ? 'player' : state.phase === 'aiAttack' ? 'enemy' : null;
const defendingSide = (state) => state.phase === 'playerDefense' ? 'player' : state.phase === 'aiDefense' ? 'enemy' : null;
const init = (options = {}) => createGame({ trainingEnabled: false, ...options });
const preferredTarget = (state, side) => {
  const targets = legalTargets(state, side);
  return targets.find((entry) => entry.id === 'main')?.id
    ?? [...targets].sort((a, b) => a.hp - b.hp)[0]?.id;
};
function freezeDeep(value) {
  Object.freeze(value);
  for (const entry of Object.values(value)) {
    if (entry && typeof entry === 'object' && !Object.isFrozen(entry)) freezeDeep(entry);
  }
  return value;
}
function strike(state, side, attackId = 'rally', targetId = preferredTarget(state, side), defenseId = 'brace') {
  const next = applyAttack(state, side, { attackId, targetId });
  return next.pendingAttack ? applyDefense(next, other(side), { defenseId }) : next;
}
function finishToRound(state, wanted) {
  let next = state;
  for (let steps = 0; next.round < wanted && !next.winner && steps < 16; steps += 1) {
    if (attackingSide(next)) next = strike(next, attackingSide(next));
    else next = applyDefense(next, defendingSide(next), { defenseId: 'brace' });
  }
  assert.equal(next.round, wanted);
  return next;
}
function incoming({ defender = 'enemy', heroId = 'kora', mode = 'quick', targetId = 'left', configure } = {}) {
  const side = other(defender);
  const state = init({ firstSide: side });
  // Heavy-damage fixtures model a funded attack; the opening attacker itself has only three.
  if (mode === 'heavy') state.energy[side] = 4;
  if (configure) configure(state);
  return applyAttack(state, side, { attackId: `${heroId}:${mode}`, targetId });
}
function assertStateBounds(state) {
  assert.equal(state.version, 2);
  assert.ok(Number.isInteger(state.round) && state.round >= 1);
  assert.deepEqual(copy(state), state, 'state is composed entirely of JSON values');
  for (const side of SIDES) {
    assert.ok(Number.isInteger(state.energy[side]) && state.energy[side] >= 0 && state.energy[side] <= 6, `${side} energy bounds`);
    assert.ok(Number.isInteger(state.decisionIndex[side]) && state.decisionIndex[side] >= 0);
    for (const entry of state.castles[side]) {
      assert.ok(Number.isInteger(entry.hp) && entry.hp >= 0 && entry.hp <= entry.maxHp, `${side} ${entry.id} HP bounds`);
    }
    for (const hero of Object.values(state.heroes[side])) {
      assert.ok(Number.isInteger(hero.readyAt) && hero.readyAt >= 0);
      assert.ok([0, 18].includes(hero.charge));
      assert.ok([0, 1].includes(hero.retreatRounds));
      assert.ok(Number.isInteger(hero.retreatUntilRound) && hero.retreatUntilRound >= 0);
      assert.ok(['left', 'main', 'right'].includes(hero.castleId));
    }
  }
  if (state.winner) {
    assert.equal(state.phase, 'finished');
    assert.equal(state.pendingAttack, null);
    assert.equal(castle(state, other(state.winner), 'main').hp, 0);
  } else if (defendingSide(state)) {
    assert.ok(state.pendingAttack);
    assert.equal(state.pendingAttack.side, other(defendingSide(state)));
  } else {
    assert.ok(attackingSide(state));
    assert.equal(state.pendingAttack, null);
  }
}

// Initialization, public descriptors, and board legality.
test('v2 starts with the three/four opening budget, symmetric castles, and three original heroes', () => {
  const state = init({ seed: 42 });
  assert.equal(state.version, 2);
  assert.equal(state.firstSide, 'player');
  assert.equal(state.phase, 'playerAttack');
  assert.equal(state.round, 1);
  assert.equal(state.winner, null);
  assert.deepEqual(state.energy, { player: 3, enemy: 4 });
  assert.equal(RULES.firstAttackerEnergy, 3);
  assert.equal(RULES.startingEnergy, 4);
  assert.deepEqual(state.decisionIndex, { player: 1, enemy: 0 });
  assert.deepEqual(state.castles.player, state.castles.enemy);
  assert.deepEqual(state.heroes.player, state.heroes.enemy);
  assert.deepEqual(state.castles.player.map((c) => [c.id, c.hp, c.maxHp]), [
    ['left', 240, 240], ['main', 420, 420], ['right', 240, 240],
  ]);
  assert.deepEqual(Object.keys(state.heroes.player), HERO_IDS);
  for (const id of HERO_IDS) {
    assert.equal(state.heroes.player[id].castleId, STATION[id]);
    assert.equal(state.heroes.player[id].charge, 0);
    assert.equal(state.heroes.player[id].readyAt, 0);
    assert.equal(state.heroes.player[id].retreatRounds, 0);
  }
  assertStateBounds(state);
});

test('exported catalogs are frozen and each game has isolated state', () => {
  for (const catalog of [HEROES, ATTACKS, DEFENSES]) {
    assert.ok(Object.isFrozen(catalog));
    for (const value of Object.values(catalog)) assert.ok(Object.isFrozen(value));
  }
  const first = init();
  const second = init();
  first.energy.player = 0;
  first.heroes.player.kora.charge = 18;
  castle(first, 'enemy', 'left').hp = 1;
  assert.equal(second.energy.player, 3);
  assert.equal(second.heroes.player.kora.charge, 0);
  assert.equal(castle(second, 'enemy', 'left').hp, 240);
});

for (const side of SIDES) {
  test(`${side} initiative is respected through both halves and later rounds`, () => {
    let state = init({ firstSide: side });
    const second = other(side);
    assert.equal(state.phase, attackPhase(side));
    assert.equal(state.decisionIndex[side], 1);
    assert.equal(state.decisionIndex[second], 0);
    state = applyAttack(state, side, { attackId: 'kora:quick', targetId: 'left' });
    assert.equal(state.phase, defensePhase(second));
    assert.equal(state.round, 1);
    assert.equal(state.decisionIndex[side], 1);
    assert.equal(state.decisionIndex[second], 1);
    state = applyDefense(state, second, { defenseId: 'brace' });
    assert.equal(state.phase, attackPhase(second));
    assert.equal(state.decisionIndex[second], 2);
    assert.equal(state.energy[second], 4, 'first attack never receives regeneration');
    state = applyAttack(state, second, { attackId: 'ilda:quick', targetId: 'right' });
    assert.equal(state.phase, defensePhase(side));
    assert.equal(state.decisionIndex[side], 2);
    state = applyDefense(state, side, { defenseId: 'brace' });
    assert.equal(state.phase, attackPhase(side));
    assert.equal(state.round, 2);
    assert.equal(state.decisionIndex[side], 3);
    assert.equal(state.decisionIndex[second], 2);
    assert.equal(state.energy[side], 5);
    assert.equal(state.energy[second], 3);
  });

  test(`${side} opens with three energy, while the second side keeps four without first-attack regeneration`, () => {
    let state = init({ firstSide: side });
    const second = other(side);
    assert.equal(state.energy[side], 3);
    assert.equal(state.energy[second], 4);
    for (const heroId of HERO_IDS) {
      assert.equal(attack(state, side, `${heroId}:heavy`).available, false);
      assert.equal(attack(state, second, `${heroId}:heavy`).available, true);
      assert.throws(() => applyAttack(state, side, { attackId: `${heroId}:heavy`, targetId: 'left' }));
    }
    state = strike(state, side, 'rally', 'left');
    assert.equal(state.phase, attackPhase(second));
    assert.equal(state.energy[side], 3);
    assert.equal(state.energy[second], 4);
    state = applyAttack(state, second, { attackId: 'kora:heavy', targetId: 'left' });
    assert.equal(state.energy[second], 0);
    assert.equal(state.energy[side], 3, 'being asked to defend does not regenerate opening energy');
    state = applyDefense(state, side, { defenseId: 'brace' });
    assert.equal(state.round, 2);
    assert.equal(state.energy[side], 6);
    assert.equal(state.energy[second], 0);
  });

  test(`${side} main unlocks only when one of that defender's own side castles falls`, () => {
    const state = init({ firstSide: side });
    assert.deepEqual(legalTargets(state, side).map((c) => c.id), ['left', 'right']);
    assert.throws(() => applyAttack(state, side, { attackId: 'kora:quick', targetId: 'main' }));
    castle(state, side, 'right').hp = 0;
    assert.deepEqual(legalTargets(state, side).map((c) => c.id), ['left', 'right']);
    castle(state, other(side), 'left').hp = 0;
    assert.deepEqual(legalTargets(state, side).map((c) => c.id), ['main', 'right']);
    assert.throws(() => applyAttack(state, side, { attackId: 'rally', targetId: 'left' }));
    castle(state, other(side), 'right').hp = 0;
    assert.deepEqual(legalTargets(state, side).map((c) => c.id), ['main']);
  });
}

test('random initiative and AI choices are seeded rather than ambient randomness', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed += 1) {
    const a = init({ firstSide: 'random', seed });
    const b = init({ firstSide: 'random', seed });
    assert.deepEqual(a, b);
    assert.ok(SIDES.includes(a.firstSide));
    assert.equal(a.phase, attackPhase(a.firstSide));
    assert.equal(a.energy[a.firstSide], 3);
    assert.equal(a.energy[other(a.firstSide)], 4);
    seen.add(a.firstSide);
  }
  assert.equal(seen.size, 2, 'random initiative can produce either side');
  for (const seed of [0, -1, 1, 42, 'replay-seed']) {
    assert.deepEqual(init({ seed }), init({ seed }));
  }
});

for (const heroId of HERO_IDS) {
  for (const [mode, cost, delta] of [['quick', 1, 0], ['heavy', 4, 26], ['disrupt', 2, -16]]) {
    test(`${heroId} ${mode} exposes the agreed power, cost, and shared fatigue`, () => {
      const state = init(); state.energy.player = 4;
      const id = `${heroId}:${mode}`;
      const entry = attack(state, 'player', id);
      assert.ok(entry, `missing ${id}`);
      assert.equal(entry.mode, mode);
      assert.equal(entry.heroId, heroId);
      assert.equal(entry.cost, cost);
      assert.equal(entry.baseDamage, QUICK[heroId] + delta);
      assert.equal(entry.damage, QUICK[heroId] + delta);
      assert.equal(entry.chargeBonus, 0);
      assert.equal(entry.trainingBonus, 0);
      assert.equal(entry.available, true);
      assert.equal(typeof entry.reason, 'string');
      assert.equal(entry.fatigues, true);
      assert.equal(entry.consumesCharge, false);
      const next = applyAttack(state, 'player', { attackId: id, targetId: 'left' });
      assert.equal(next.energy.player, 4 - cost);
      assert.equal(next.heroes.player[heroId].readyAt, state.decisionIndex.player + 2);
      assert.equal(next.pendingAttack.damage, QUICK[heroId] + delta);
    });
  }
}

test('all actions publish enough metadata for a rule-transparent interface', () => {
  const state = init();
  for (const entry of availableAttacks(state, 'player')) {
    for (const field of ['mode', 'cost', 'baseDamage', 'chargeBonus', 'trainingBonus', 'damage', 'available', 'reason', 'heroId', 'consumesCharge', 'fatigues']) {
      assert.ok(Object.hasOwn(entry, field), `${entry.id} lacks ${field}`);
    }
  }
  for (const entry of availableDefenses(state, 'player')) {
    for (const field of ['cost', 'localBonus', 'chargeBonus', 'available', 'reason', 'heroId', 'consumesCharge', 'fatigues']) {
      assert.ok(Object.hasOwn(entry, field), `${entry.id} lacks ${field}`);
    }
  }
});

// Resources and shared decision fatigue.
for (const side of SIDES) {
  test(`${side} gets +3 only before attacks after its first, capped at six`, () => {
    let state = init({ firstSide: side });
    state = applyAttack(state, side, { attackId: 'kora:disrupt', targetId: 'left' });
    assert.equal(state.energy[side], 1);
    assert.equal(state.energy[other(side)], 4, 'no defense regeneration');
    state = applyDefense(state, other(side), { defenseId: 'kora' });
    assert.equal(state.energy[other(side)], 2, 'first attack does not replenish a paid defense');
    state = applyAttack(state, other(side), { attackId: 'neris:quick', targetId: 'right' });
    assert.equal(state.energy[side], 1, 'incoming defense does not regenerate energy');
    state = applyDefense(state, side, { defenseId: 'brace' });
    assert.equal(state.energy[side], 4);
    state = strike(state, side, 'rally');
    assert.equal(state.energy[other(side)], 4, 'second side also gains exactly three at second attack');
    state = strike(state, other(side), 'rally');
    assert.equal(state.energy[side], 6, 'regeneration respects cap');
  });

  test(`${side} special cannot be reused for its next own decision but returns for the following one`, () => {
    const initial = init({ firstSide: side });
    let state = applyAttack(initial, side, { attackId: 'kora:quick', targetId: 'left' });
    const readyAt = state.heroes[side].kora.readyAt;
    assert.equal(readyAt, initial.decisionIndex[side] + 2);
    state = applyDefense(state, other(side), { defenseId: 'brace' });
    state = applyAttack(state, other(side), { attackId: 'ilda:quick', targetId: 'right' });
    assert.equal(state.decisionIndex[side], readyAt - 1);
    assert.equal(defense(state, side, 'kora').available, false);
    assert.throws(() => applyDefense(state, side, { defenseId: 'kora' }));
    state = applyDefense(state, side, { defenseId: 'brace' });
    assert.equal(state.decisionIndex[side], readyAt);
    assert.equal(attack(state, side, 'kora:quick').available, true);
  });

  test(`${side} typed defense fatigues the same hero for the immediately following attack`, () => {
    let state = incoming({ defender: side });
    const guardIndex = state.decisionIndex[side];
    state = applyDefense(state, side, { defenseId: 'kora' });
    assert.equal(state.phase, attackPhase(side));
    assert.equal(state.decisionIndex[side], guardIndex + 1);
    assert.equal(state.heroes[side].kora.readyAt, guardIndex + 2);
    for (const mode of ['quick', 'heavy', 'disrupt', 'prepare']) {
      assert.equal(attack(state, side, `kora:${mode}`).available, false);
      assert.throws(() => applyAttack(state, side, { attackId: `kora:${mode}`, targetId: 'left' }));
    }
    assert.equal(attack(state, side, 'rally').available, true);
  });
}

test('insufficient energy disables paid actions without disabling brace, rally, or ready preparation', () => {
  const state = init();
  state.energy.player = 0;
  for (const entry of availableAttacks(state, 'player')) {
    assert.equal(entry.available, entry.cost === 0, entry.id);
    if (entry.cost > 0) {
      assert.ok(entry.reason);
      assert.throws(() => playerAttack(state, { attackId: entry.id, targetId: 'left' }));
    }
  }
  const defended = incoming({ defender: 'player', configure: (s) => { s.energy.player = 0; } });
  for (const id of HERO_IDS) {
    assert.equal(defense(defended, 'player', id).available, false);
    assert.throws(() => playerDefend(defended, { defenseId: id }));
  }
  assert.equal(defense(defended, 'player', 'brace').available, true);
  assert.doesNotThrow(() => playerDefend(defended, { defenseId: 'brace' }));
});

test('exact-energy payments succeed and never go negative', () => {
  for (const [mode, cost] of [['quick', 1], ['heavy', 4], ['disrupt', 2]]) {
    const state = init(); state.energy.player = cost;
    assert.equal(playerAttack(state, { attackId: `kora:${mode}`, targetId: 'left' }).energy.player, 0);
  }
  const state = incoming({ configure: (s) => { s.energy.enemy = 2; } });
  // Enemy immediately enters its first attack after defending, so no regeneration obscures payment.
  assert.equal(applyDefense(state, 'enemy', { defenseId: 'kora' }).energy.enemy, 0);
});

// Preparation and charge are deliberately separate from fatigue and basic actions.
for (const side of SIDES) {
  test(`${side} preparation adds two energy, charges one hero, and skips the defense decision`, () => {
    const state = init({ firstSide: side });
    state.energy[side] = 1;
    const entry = attack(state, side, 'neris:prepare');
    assert.equal(entry.mode, 'prepare');
    assert.equal(entry.cost, 0);
    assert.equal(entry.damage, 0);
    assert.equal(entry.fatigues, false);
    const next = applyAttack(state, side, { attackId: 'neris:prepare' });
    assert.equal(next.phase, attackPhase(other(side)));
    assert.equal(next.pendingAttack, null);
    assert.equal(next.energy[side], 3);
    assert.equal(next.energy[other(side)], 4);
    assert.equal(next.heroes[side].neris.charge, 18);
    assert.equal(next.heroes[side].neris.readyAt, state.heroes[side].neris.readyAt);
    assert.equal(next.decisionIndex[other(side)], 1, 'skipped defense must not count as a decision');
    assert.deepEqual(next.castles, state.castles);
    assert.deepEqual(HERO_IDS.filter((id) => id !== 'neris').map((id) => next.heroes[side][id].charge), [0, 0]);
  });

  test(`${side} repeated preparation never stacks charge or exceeds energy cap`, () => {
    let state = init({ firstSide: side });
    state = applyAttack(state, side, { attackId: 'kora:prepare' });
    assert.equal(state.energy[side], 5);
    state = applyAttack(state, other(side), { attackId: 'neris:prepare' });
    assert.equal(state.phase, attackPhase(side));
    assert.equal(state.round, 2);
    assert.equal(state.decisionIndex[side], 2);
    assert.equal(state.decisionIndex[other(side)], 1);
    state = applyAttack(state, side, { attackId: 'kora:prepare' });
    assert.equal(state.energy[side], 6);
    assert.equal(state.heroes[side].kora.charge, 18);
    assert.equal(state.heroes[side].kora.readyAt, 0);
  });
}

test('a prepared hero can immediately use a charged matching guard', () => {
  let state = playerAttack(init(), { attackId: 'kora:prepare' });
  state = applyAttack(state, 'enemy', { attackId: 'kora:quick', targetId: 'left' });
  assert.equal(defense(state, 'player', 'kora').available, true);
  const preview = previewDefense(state, 'kora');
  assert.equal(preview.chargeBonus, 18);
  assert.equal(preview.blocked, 50, 'capacity 34+8+18 clamps to incoming damage');
  const next = playerDefend(state, { defenseId: 'kora' });
  assert.equal(next.heroes.player.kora.charge, 0);
  assert.equal(castle(next, 'player', 'left').hp, 240);
  assert.equal(next.heroes.player.kora.readyAt, state.decisionIndex.player + 2);
});

for (const mode of ['quick', 'heavy', 'disrupt']) {
  test(`charge adds exactly eighteen to next ${mode} attack and is spent on declaration`, () => {
    const state = init(); state.energy.player = 4; state.heroes.player.kora.charge = 18;
    const entry = attack(state, 'player', `kora:${mode}`);
    assert.equal(entry.chargeBonus, 18);
    assert.equal(entry.damage, entry.baseDamage + 18);
    assert.equal(entry.consumesCharge, true);
    const next = playerAttack(state, { attackId: entry.id, targetId: 'left' });
    assert.equal(next.pendingAttack.damage, entry.baseDamage + 18);
    assert.equal(next.heroes.player.kora.charge, 0);
    assert.equal(state.heroes.player.kora.charge, 18);
  });
}

test('rally is a free eighteen-point attack by an active hero, ignores fatigue, and preserves charge', () => {
  const state = init();
  state.energy.player = 0;
  for (const hero of Object.values(state.heroes.player)) { hero.readyAt = 99; hero.charge = 18; }
  state.heroes.player.kora.retreatRounds = 1;
  state.heroes.player.kora.retreatUntilRound = 3;
  state.heroes.player.kora.castleId = 'main';
  const entry = attack(state, 'player', 'rally');
  assert.equal(entry.available, true);
  assert.equal(entry.cost, 0);
  assert.equal(entry.damage, 18);
  assert.equal(entry.chargeBonus, 0);
  assert.equal(entry.fatigues, false);
  assert.equal(entry.consumesCharge, false);
  assert.notEqual(entry.heroId, 'kora');
  assert.equal(state.heroes.player[entry.heroId].retreatRounds, 0);
  const next = playerAttack(state, { attackId: 'rally', targetId: 'left' });
  assert.equal(next.pendingAttack.heroId, entry.heroId);
  assert.equal(next.pendingAttack.damage, 18);
  assert.equal(next.energy.player, 0);
  assert.deepEqual(next.heroes.player, state.heroes.player);
});

test('brace is free, blocks up to twelve of every attack type, and never consumes a hero charge', () => {
  for (const heroId of HERO_IDS) {
    const state = incoming({ heroId, configure: (s) => {
      s.energy.enemy = 0;
      for (const hero of Object.values(s.heroes.enemy)) { hero.readyAt = 99; hero.charge = 18; }
    } });
    const entry = defense(state, 'enemy', 'brace');
    assert.equal(entry.cost, 0);
    assert.equal(entry.available, true);
    assert.equal(entry.fatigues, false);
    assert.equal(entry.consumesCharge, false);
    assert.equal(previewDefense(state, 'brace').blocked, 12);
    const next = applyDefense(state, 'enemy', { defenseId: 'brace' });
    assert.equal(next.energy.enemy, 0);
    assert.deepEqual(next.heroes.enemy, state.heroes.enemy);
  }
  const tiny = incoming(); tiny.pendingAttack.damage = 7;
  assert.equal(previewDefense(tiny, 'brace').blocked, 7);
  assert.equal(previewDefense(tiny, 'brace').damage, 0);
});

test('an opponent preparing skips a real decision, so fatigue does not recover through a phantom defense', () => {
  let state = strike(init(), 'player', 'kora:quick', 'left');
  assert.equal(state.phase, 'aiAttack');
  const before = state.decisionIndex.player;
  state = applyAttack(state, 'enemy', { attackId: 'neris:prepare' });
  assert.equal(state.phase, 'playerAttack');
  assert.equal(state.decisionIndex.player, before + 1);
  assert.equal(attack(state, 'player', 'kora:quick').available, false);
  assert.equal(attack(state, 'player', 'kora:prepare').available, false);
  state = strike(state, 'player', 'rally', 'left');
  state = applyAttack(state, 'enemy', { attackId: 'ilda:quick', targetId: 'right' });
  assert.equal(defense(state, 'player', 'kora').available, true);
});

test('brace leaves a prepared charge intact for the next special attack', () => {
  let state = playerAttack(init(), { attackId: 'neris:prepare' });
  state = applyAttack(state, 'enemy', { attackId: 'ilda:quick', targetId: 'right' });
  state = playerDefend(state, { defenseId: 'brace' });
  assert.equal(state.heroes.player.neris.charge, 18);
  assert.equal(attack(state, 'player', 'neris:quick').damage, 64);
  state = playerAttack(state, { attackId: 'neris:quick', targetId: 'left' });
  assert.equal(state.heroes.player.neris.charge, 0);
  assert.equal(state.pendingAttack.damage, 64);
});

// Guard matching, local stations, and disruption outcomes.
for (const heroId of HERO_IDS) {
  test(`${heroId} typed guard costs two, blocks only its type, and gets eight local bonus`, () => {
    for (const targetId of ['left', 'right']) {
      const state = incoming({ heroId, targetId });
      const entry = defense(state, 'enemy', heroId);
      const preview = previewDefense(state, heroId);
      const local = STATION[heroId] === targetId ? 8 : 0;
      assert.equal(entry.cost, 2);
      assert.equal(preview.localBonus, local);
      assert.equal(preview.chargeBonus, 0);
      assert.equal(preview.effective, true);
      assert.equal(preview.blocked, Math.min(QUICK[heroId], GUARD[heroId] + local));
      assert.equal(preview.damage, QUICK[heroId] - preview.blocked);
      const next = applyDefense(state, 'enemy', { defenseId: heroId });
      assert.equal(next.energy.enemy, 2);
      assert.equal(castle(next, 'enemy', targetId).hp, 240 - preview.damage);
    }
  });
}

test('Neris and relocated heroes receive their local bonus at the main castle', () => {
  for (const heroId of HERO_IDS) {
    const state = incoming({ heroId, targetId: 'main', configure: (s) => {
      castle(s, 'enemy', 'left').hp = 0;
      s.heroes.enemy[heroId].castleId = 'main';
    } });
    assert.equal(previewDefense(state, heroId).localBonus, 8);
  }
});

test('charged correct guard adds eighteen, spends charge, and clamps total block to incoming damage', () => {
  for (const heroId of HERO_IDS) {
    const state = incoming({ heroId, mode: 'heavy', configure: (s) => { s.heroes.enemy[heroId].charge = 18; } });
    const preview = previewDefense(state, heroId);
    assert.equal(preview.chargeBonus, 18);
    assert.equal(preview.blocked, Math.min(QUICK[heroId] + 26, GUARD[heroId] + (heroId === 'kora' ? 8 : 0) + 18));
    assert.equal(defense(state, 'enemy', heroId).consumesCharge, true);
    const next = applyDefense(state, 'enemy', { defenseId: heroId });
    assert.equal(next.heroes.enemy[heroId].charge, 0);
  }
});

test('wrong typed guard blocks zero, still spends two and fatigues, but preserves charge', () => {
  for (const incomingHero of HERO_IDS) {
    for (const guardHero of HERO_IDS.filter((id) => id !== incomingHero)) {
      const state = incoming({ heroId: incomingHero, configure: (s) => { s.heroes.enemy[guardHero].charge = 18; } });
      const preview = previewDefense(state, guardHero);
      assert.equal(preview.effective, false);
      assert.equal(preview.blocked, 0);
      assert.equal(preview.damage, QUICK[incomingHero]);
      assert.equal(preview.chargeBonus, 0);
      assert.equal(defense(state, 'enemy', guardHero).consumesCharge, false);
      const next = applyDefense(state, 'enemy', { defenseId: guardHero });
      assert.equal(next.energy.enemy, 2);
      assert.equal(next.heroes.enemy[guardHero].charge, 18);
      assert.equal(next.heroes.enemy[guardHero].readyAt, state.decisionIndex.enemy + 2);
      assert.equal(next.lastEvent.blocked, 0);
      assert.equal(castle(next, 'enemy', 'left').hp, 240 - QUICK[incomingHero]);
    }
  }
});

test('positive disruption damage clears every charge stationed at target, drains exactly one energy', () => {
  const state = incoming({ mode: 'disrupt', configure: (s) => {
    for (const id of HERO_IDS) s.heroes.enemy[id].charge = 18;
    s.heroes.enemy.ilda.castleId = 'left';
  } });
  const next = applyDefense(state, 'enemy', { defenseId: 'brace' });
  assert.equal(next.lastEvent.damage, 22);
  assert.equal(castle(next, 'enemy', 'left').hp, 218);
  assert.equal(next.energy.enemy, 3);
  assert.equal(next.heroes.enemy.kora.charge, 0);
  assert.equal(next.heroes.enemy.ilda.charge, 0);
  assert.equal(next.heroes.enemy.neris.charge, 18);
});

test('fully blocked disruption neither drains energy nor clears any stored charge', () => {
  const state = incoming({ mode: 'disrupt', configure: (s) => {
    s.heroes.enemy.ilda.castleId = 'left';
    s.heroes.enemy.ilda.charge = 18;
    s.heroes.enemy.neris.charge = 18;
  } });
  assert.equal(previewDefense(state, 'kora').damage, 0);
  const next = applyDefense(state, 'enemy', { defenseId: 'kora' });
  assert.equal(next.energy.enemy, 2, 'only guard cost is paid');
  assert.equal(next.heroes.enemy.ilda.charge, 18);
  assert.equal(next.heroes.enemy.neris.charge, 18);
  assert.equal(castle(next, 'enemy', 'left').hp, 240);
});

test('disruption drains after paid guard and saturates at zero rather than making negative energy', () => {
  for (const startingEnergy of [0, 1, 2]) {
    const state = incoming({ mode: 'disrupt', configure: (s) => { s.energy.enemy = startingEnergy; } });
    const next = applyDefense(state, 'enemy', { defenseId: startingEnergy === 2 ? 'ilda' : 'brace' });
    assert.equal(next.energy.enemy, 0);
  }
});

test('disruption effects require real positive HP loss and also apply on a side-castle killing blow', () => {
  const state = incoming({ mode: 'disrupt', configure: (s) => {
    castle(s, 'enemy', 'left').hp = 1;
    s.heroes.enemy.kora.charge = 18;
  } });
  const next = applyDefense(state, 'enemy', { defenseId: 'brace' });
  assert.equal(castle(next, 'enemy', 'left').hp, 0);
  assert.equal(next.lastEvent.hpLost, 1);
  assert.equal(next.heroes.enemy.kora.charge, 0);
  assert.equal(next.energy.enemy, 3);
  assert.equal(next.heroes.enemy.kora.retreatRounds, 1);
});

test('disruption defense previews match actual HP loss, resource drain, and cleared preparation', () => {
  const scenarios = [
    { defenseId: 'brace', energy: 4, hp: 240, targetId: 'left', damage: 22, drain: 1, after: 3 },
    { defenseId: 'ilda', energy: 4, hp: 240, targetId: 'left', damage: 34, drain: 1, after: 1 },
    { defenseId: 'kora', energy: 4, hp: 240, targetId: 'left', damage: 0, drain: 0, after: 2 },
    { defenseId: 'kora', energy: 4, hp: 240, targetId: 'right', attackCharge: 18, damage: 18, drain: 1, after: 1 },
    { defenseId: 'brace', energy: 4, hp: 1, targetId: 'left', damage: 22, drain: 1, after: 3 },
    { defenseId: 'brace', energy: 0, hp: 240, targetId: 'left', damage: 22, drain: 0, after: 0 },
    { defenseId: 'ilda', energy: 2, hp: 240, targetId: 'left', damage: 34, drain: 0, after: 0 },
  ];
  for (const side of SIDES) {
    for (const scenario of scenarios) {
      const state = incoming({ defender: side, mode: 'disrupt', targetId: scenario.targetId, configure: (s) => {
        s.energy[side] = scenario.energy;
        castle(s, side, scenario.targetId).hp = scenario.hp;
        s.heroes[other(side)].kora.charge = scenario.attackCharge ?? 0;
        s.heroes[side].neris.castleId = scenario.targetId;
        s.heroes[side].neris.charge = 18;
      } });
      const before = JSON.stringify(state);
      const preview = previewDefense(freezeDeep(state), scenario.defenseId);
      assert.equal(preview.damage, scenario.damage);
      assert.equal(preview.hpLost, Math.min(scenario.damage, scenario.hp));
      assert.equal(preview.energyDrained, scenario.drain);
      assert.equal(preview.energyDrain, scenario.drain);
      assert.equal(preview.energyAfter, scenario.after);
      assert.deepEqual(preview.preparationCleared, scenario.damage > 0 ? ['neris'] : []);
      const next = applyDefense(state, side, { defenseId: scenario.defenseId });
      assert.equal(next.lastEvent.hpLost, preview.hpLost);
      assert.equal(next.lastEvent.energyDrained, preview.energyDrained);
      assert.deepEqual(next.lastEvent.preparationCleared, preview.preparationCleared);
      assert.equal(next.energy[side], preview.energyAfter, 'first attack has no regeneration to obscure drain');
      assert.equal(JSON.stringify(state), before);
    }
  }
});

test('defense preview energy is after disruption but before the following attack regeneration', () => {
  for (const side of SIDES) {
    let state = strike(init({ firstSide: side }), side, 'rally', 'left');
    state = applyAttack(state, other(side), { attackId: 'kora:disrupt', targetId: 'left' });
    assert.equal(state.energy[side], 3);
    const preview = previewDefense(state, 'brace');
    assert.equal(preview.energyDrained, 1);
    assert.equal(preview.energyAfter, 2);
    const next = applyDefense(state, side, { defenseId: 'brace' });
    assert.equal(next.phase, attackPhase(side));
    assert.equal(next.energy[side], 5);
    assert.equal(next.energy[side], Math.min(6, preview.energyAfter + 3));
    assert.equal(next.lastEvent.energyDrained, preview.energyDrained);
  }
});

test('charged matching guard is consumed before remaining target charges are listed as disrupted', () => {
  const state = incoming({ mode: 'disrupt', configure: (s) => {
    s.heroes.enemy.kora.charge = 18;
    s.heroes.enemy.ilda.castleId = 'left';
    s.heroes.enemy.ilda.charge = 18;
  } });
  // A high incoming-damage fixture isolates the ordering of the two charge-removal effects.
  state.pendingAttack.damage = 80;
  const preview = previewDefense(state, 'kora');
  assert.equal(preview.chargeConsumed, true);
  assert.equal(preview.blocked, 60);
  assert.equal(preview.hpLost, 20);
  assert.deepEqual(preview.preparationCleared, ['ilda']);
  assert.equal(preview.energyAfter, 1);
  const next = applyDefense(state, 'enemy', { defenseId: 'kora' });
  assert.equal(next.heroes.enemy.kora.charge, 0);
  assert.equal(next.heroes.enemy.ilda.charge, 0);
  assert.deepEqual(next.lastEvent.preparationCleared, preview.preparationCleared);
  assert.equal(next.lastEvent.energyDrained, preview.energyDrained);
});

test('attack preview defense alternatives include post-cost disruption drain and exact charge clears', () => {
  const state = init();
  state.heroes.player.kora.charge = 18;
  state.heroes.enemy.neris.castleId = 'left';
  state.heroes.enemy.neris.charge = 18;
  const preview = previewAttack(state, { attackId: 'kora:disrupt', targetId: 'left' });
  const declared = playerAttack(state, { attackId: 'kora:disrupt', targetId: 'left' });
  for (const alternative of preview.possibleBlocks) {
    const next = applyDefense(declared, 'enemy', { defenseId: alternative.defenseId });
    assert.equal(alternative.hpLost, next.lastEvent.hpLost);
    assert.equal(alternative.energyDrained, next.lastEvent.energyDrained);
    assert.equal(alternative.energyDrain, next.lastEvent.energyDrained);
    assert.equal(alternative.energyAfter, next.energy.enemy);
    assert.deepEqual(alternative.preparationCleared, next.lastEvent.preparationCleared);
  }
  assert.equal(preview.possibleBlocks.find((entry) => entry.defenseId === 'brace').energyAfter, 3);
  assert.equal(preview.possibleBlocks.find((entry) => entry.defenseId === 'kora').energyAfter, 1);
});

test('unaffordable theoretical defense previews clamp remaining energy and drain at zero', () => {
  const state = incoming({ mode: 'disrupt', configure: (s) => { s.energy.enemy = 0; } });
  for (const defenseId of HERO_IDS) {
    const preview = previewDefense(state, defenseId);
    assert.equal(preview.available, false);
    assert.equal(preview.energyAfter, 0);
    assert.equal(preview.energyDrained, 0);
    assert.equal(preview.energyDrain, 0);
    assert.throws(() => applyDefense(state, 'enemy', { defenseId }));
  }
});

// Retreat, side-fall unlocking, and terminal states.
for (const firstSide of SIDES) {
  for (const fallenSide of SIDES) {
    test(`${fallenSide} retreat lasts rest of current round plus all next round (${firstSide} initiative)`, () => {
      let state = init({ firstSide });
      const attacker = other(fallenSide);
      if (attacker !== firstSide) state = strike(state, firstSide, 'rally', 'right');
      const fallRound = state.round;
      castle(state, fallenSide, 'left').hp = 1;
      state = strike(state, attacker, 'kora:quick', 'left');
      const hero = state.heroes[fallenSide].kora;
      assert.equal(hero.castleId, 'main');
      assert.equal(hero.retreatUntilRound, fallRound + 2);
      assert.equal(hero.retreatRounds, 1);
      for (const mode of ['quick', 'heavy', 'disrupt', 'prepare']) {
        assert.equal(attack(state, fallenSide, `kora:${mode}`).available, false);
      }
      assert.equal(defense(state, fallenSide, 'kora').available, false);
      assert.ok(legalTargets(state, attacker).some((c) => c.id === 'main'));
      state = finishToRound(state, fallRound + 1);
      assert.equal(state.heroes[fallenSide].kora.retreatRounds, 1);
      assert.equal(attack(state, fallenSide, 'kora:quick').available, false);
      state = finishToRound(state, fallRound + 2);
      assert.equal(state.heroes[fallenSide].kora.retreatRounds, 0);
      assert.equal(state.heroes[fallenSide].kora.castleId, 'main');
      assert.equal(attack(state, fallenSide, 'kora:quick').available, true);
      assert.ok(Object.hasOwn(state.heroes[fallenSide], 'kora'), 'retreat never deletes a hero');
    });
  }
}

test('right-castle destruction retreats Ilda while main-resident Neris stays active', () => {
  const state = init(); castle(state, 'enemy', 'right').hp = 1;
  const next = strike(state, 'player', 'neris:quick', 'right');
  assert.equal(next.heroes.enemy.ilda.retreatRounds, 1);
  assert.equal(next.heroes.enemy.ilda.castleId, 'main');
  assert.equal(next.heroes.enemy.neris.retreatRounds, 0);
  assert.equal(next.heroes.enemy.kora.retreatRounds, 0);
});

for (const winner of SIDES) {
  test(`${winner} victory is immediate, clamps HP to zero, and blocks every subsequent transition`, () => {
    const state = init({ firstSide: winner }); state.energy[winner] = 4;
    castle(state, other(winner), 'left').hp = 0;
    castle(state, other(winner), 'main').hp = 1;
    const next = strike(state, winner, 'kora:heavy', 'main');
    assert.equal(next.winner, winner);
    assert.equal(next.phase, 'finished');
    assert.equal(next.round, 1);
    assert.equal(next.lastEvent.winner, winner);
    assert.equal(next.lastEvent.hpLost, 1);
    assert.equal(castle(next, other(winner), 'main').hp, 0);
    assert.equal(next.pendingAttack, null);
    for (const side of SIDES) {
      assert.deepEqual(legalTargets(next, side), []);
      assert.throws(() => applyAttack(next, side, { attackId: 'rally', targetId: 'right' }));
      assert.throws(() => applyDefense(next, side, { defenseId: 'brace' }));
    }
    assert.throws(() => playerAttack(next, { attackId: 'rally', targetId: 'right' }));
    assert.throws(() => playerDefend(next, { defenseId: 'brace' }));
    assert.throws(() => resolveAiDefense(next));
    assert.throws(() => chooseAiAttack(next));
    assert.ok(describeState(next).length > 0);
    assertStateBounds(next);
  });
}

// Optional persistent training is small, side-configurable, and never a guard bonus.
for (const tier of [-9, 0, 1, 2, 3, 3.9, 9000, NaN, Infinity]) {
  test(`training tier ${String(tier)} is a bounded integer and remains a persistent bonus of at most three`, () => {
    const state = createGame({ training: { tier } });
    const expected = Number.isFinite(tier) ? Math.min(3, Math.max(0, Math.trunc(tier))) : 0;
    const entry = attack(state, 'player', 'kora:quick');
    assert.equal(entry.trainingBonus, expected);
    assert.equal(entry.damage, 50 + expected);
    assert.equal(attack(state, 'enemy', 'kora:quick').trainingBonus, 0);
    assert.equal(attack(state, 'player', 'ilda:quick').trainingBonus, 0);
    assert.equal(attack(state, 'player', 'neris:quick').trainingBonus, 0);
    const next = playerAttack(state, { attackId: 'kora:quick', targetId: 'left' });
    assert.equal(attack(next, 'player', 'kora:quick').trainingBonus, expected);
    assert.equal(attack(next, 'player', 'kora:heavy').trainingBonus, expected);
  });
}

test('legacy power training is supported, and disabled training cannot alter attacks or guards', () => {
  const state = createGame({ training: { power: 3, defense: 99 } });
  assert.equal(attack(state, 'player', 'kora:quick').damage, 53);
  const guardState = incoming({ defender: 'player' });
  guardState.training = copy(state.training);
  guardState.trainingBySide = copy(state.trainingBySide);
  guardState.trainingEnabled = true;
  assert.equal(previewDefense(guardState, 'kora').blocked, 42);
  const off = createGame({ training: { tier: 3, power: 3, defense: 3 }, trainingEnabled: false });
  assert.equal(off.trainingEnabled, false);
  for (const id of HERO_IDS) {
    assert.equal(attack(off, 'player', `${id}:quick`).trainingBonus, 0);
    assert.equal(attack(off, 'player', `${id}:quick`).damage, attack(off, 'enemy', `${id}:quick`).damage);
  }
});

test('Kora development persists across attacks and preparation, and can be applied symmetrically', () => {
  let state = createGame({ training: { tier: 3 } });
  state = strike(state, 'player', 'kora:quick', 'left');
  state = strike(state, 'enemy', 'ilda:quick', 'right');
  assert.equal(attack(state, 'player', 'kora:quick').trainingBonus, 3);
  assert.equal(playerAttack(state, { attackId: 'kora:quick', targetId: 'left' }).pendingAttack.damage, 53);
  const both = createGame({ trainingBySide: { player: 3, enemy: 3 } });
  assert.deepEqual(both.trainingBySide, { player: 3, enemy: 3 });
  for (const side of SIDES) {
    for (const mode of ['quick', 'heavy', 'disrupt']) assert.equal(attack(both, side, `kora:${mode}`).trainingBonus, 3);
    assert.equal(attack(both, side, 'kora:prepare').trainingBonus, 0);
    assert.equal(attack(both, side, 'rally').trainingBonus, 0);
  }
  const override = createGame({ training: { power: 3 }, trainingBySide: { player: 0, enemy: 99 } });
  assert.deepEqual(override.trainingBySide, { player: 0, enemy: 3 });
  const disabled = createGame({ trainingEnabled: false, trainingBySide: { player: 3, enemy: 3 } });
  assert.deepEqual(disabled.trainingBySide, { player: 0, enemy: 0 });
});

test('charged training attack adds bonuses once per attack without modifying the exported base damage', () => {
  const state = createGame({ training: { tier: 3 } }); state.energy.player = 4; state.heroes.player.kora.charge = 18;
  const entry = attack(state, 'player', 'kora:heavy');
  assert.equal(entry.baseDamage, 76);
  assert.equal(entry.trainingBonus, 3);
  assert.equal(entry.chargeBonus, 18);
  assert.equal(entry.damage, 97);
  const next = playerAttack(state, { attackId: entry.id, targetId: 'left' });
  assert.equal(next.pendingAttack.damage, 97);
  assert.equal(next.pendingAttack.baseDamage, 76);
  assert.equal(next.pendingAttack.chargeBonus, 18);
  assert.equal(next.pendingAttack.trainingBonus, 3);
  assert.equal(attack(next, 'player', 'kora:quick').trainingBonus, 3);
  assert.equal(next.heroes.player.kora.charge, 0);
  assert.equal(attack(init(), 'player', 'kora:heavy').baseDamage, 76);
});

// Previews, immutable APIs, illegal moves, and deterministic replay.
test('attack previews include energy, fatigue, and every legal defense outcome without side effects', () => {
  const funded = init(); funded.energy.player = 4;
  const state = freezeDeep(funded);
  const before = JSON.stringify(state);
  const preview = previewAttack(state, { attackId: 'kora:heavy', targetId: 'left' });
  assert.equal(preview.energyAfter, 0);
  assert.equal(preview.fatigue, true);
  assert.ok(Array.isArray(preview.possibleBlocks));
  assert.equal(preview.possibleBlocks.length, Object.keys(DEFENSES).length);
  const declared = playerAttack(state, { attackId: 'kora:heavy', targetId: 'left' });
  for (const block of preview.possibleBlocks) {
    const result = previewDefense(declared, block.defenseId);
    assert.equal(block.blocked, result.blocked);
    assert.equal(block.damage, result.damage);
    assert.equal(block.effective, result.effective);
    assert.equal(block.available, defense(declared, 'enemy', block.defenseId).available);
    assert.equal(block.energyAfter, state.energy.enemy - block.cost);
  }
  assert.equal(JSON.stringify(state), before);
});

test('attack preview evaluates defenders at their next real decision rather than stale readiness', () => {
  const state = init();
  state.heroes.enemy.kora.readyAt = state.decisionIndex.enemy + 1;
  assert.equal(defense(state, 'enemy', 'kora').available, false);
  const preview = previewAttack(state, { attackId: 'kora:quick', targetId: 'left' });
  assert.equal(preview.possibleBlocks.find((entry) => entry.defenseId === 'kora').available, true);
  const declared = playerAttack(state, { attackId: 'kora:quick', targetId: 'left' });
  assert.equal(defense(declared, 'enemy', 'kora').available, true);
  state.heroes.enemy.kora.readyAt += 1;
  assert.equal(previewAttack(state, { attackId: 'kora:quick', targetId: 'left' })
    .possibleBlocks.find((entry) => entry.defenseId === 'kora').available, false);
});

test('attack preview handles explicit enemy side, locked targets, and insufficient energy without mutations', () => {
  const state = init({ firstSide: 'enemy' });
  const enemy = previewAttack(state, { side: 'enemy', attackId: 'ilda:quick', targetId: 'right' });
  assert.equal(enemy.available, true);
  assert.equal(enemy.damage, 42);
  const locked = previewAttack(state, { side: 'enemy', attackId: 'ilda:quick', targetId: 'main' });
  assert.equal(locked.available, false);
  assert.ok(locked.reason);
  state.energy.enemy = 0;
  const poor = previewAttack(state, { side: 'enemy', attackId: 'ilda:heavy', targetId: 'right' });
  assert.equal(poor.available, false);
  assert.ok(poor.reason);
  assert.throws(() => previewAttack(state, { side: 'invalid', attackId: 'rally', targetId: 'left' }));
});

test('preparation and basic-action previews show correct cost and no fatigue', () => {
  const state = init(); state.energy.player = 5; state.heroes.player.kora.charge = 18;
  const prepared = previewAttack(state, { attackId: 'kora:prepare' });
  assert.equal(prepared.energyAfter, 6);
  assert.equal(prepared.fatigue, false);
  const rally = previewAttack(state, { attackId: 'rally', targetId: 'left' });
  assert.equal(rally.energyAfter, 5);
  assert.equal(rally.fatigue, false);
  assert.equal(rally.damage, 18);
});

test('read APIs accept deeply frozen states and never mutate state or exported catalogs', () => {
  const initial = freezeDeep(init());
  const pending = freezeDeep(playerAttack(initial, { attackId: 'kora:quick', targetId: 'left' }));
  const snapshots = [JSON.stringify(initial), JSON.stringify(pending)];
  for (const state of [initial, pending]) {
    for (const side of SIDES) {
      legalTargets(state, side); availableAttacks(state, side); availableDefenses(state, side);
    }
    describeState(state);
    for (const id of Object.keys(DEFENSES)) previewDefense(state, id);
  }
  previewAttack(initial, { attackId: 'ilda:heavy', targetId: 'right' });
  assert.deepEqual([JSON.stringify(initial), JSON.stringify(pending)], snapshots);
});

test('returned target and action descriptors cannot be used to mutate live state or catalogs', () => {
  const state = init();
  const target = legalTargets(state, 'player')[0]; target.hp = 0;
  const action = availableAttacks(state, 'player')[0]; action.damage = 9000;
  const guard = availableDefenses(state, 'player')[0]; guard.block = 9000;
  assert.equal(castle(state, 'enemy', 'left').hp, 240);
  assert.equal(attack(state, 'player', 'kora:quick').damage, 50);
  assert.equal(defense(state, 'player', 'kora').block, 34);
});

test('all successful generic and wrapper transitions accept frozen input and leave it unchanged', () => {
  let state = freezeDeep(init({ seed: 'immutability' }));
  const transitions = [
    (s) => playerAttack(s, { attackId: 'kora:quick', targetId: 'left' }),
    (s) => resolveAiDefense(s),
    (s) => chooseAiAttack(s),
  ];
  for (const transition of transitions) {
    const before = JSON.stringify(state);
    const next = transition(state);
    assert.notEqual(next, state);
    assert.equal(JSON.stringify(state), before);
    state = freezeDeep(next);
  }
  // An AI preparation is legal and skips defense. Exercise the wrapper whenever an attack is pending.
  if (state.phase === 'playerDefense') {
    const before = JSON.stringify(state);
    const next = playerDefend(state, { defenseId: 'brace' });
    assert.equal(JSON.stringify(state), before);
    assert.notEqual(next.castles, state.castles);
  }
  for (const side of SIDES) {
    const start = freezeDeep(init({ firstSide: side }));
    const attacked = freezeDeep(applyAttack(start, side, { attackId: 'neris:quick', targetId: 'right' }));
    const before = JSON.stringify(attacked);
    applyDefense(attacked, other(side), { defenseId: 'brace' });
    assert.equal(JSON.stringify(attacked), before);
  }
});

test('wrong-side, wrong-phase, unknown, missing, and repeated actions reject without mutating input', () => {
  const initial = freezeDeep(init());
  const initialJSON = JSON.stringify(initial);
  const illegal = [
    () => resolveAiDefense(initial), () => chooseAiAttack(initial),
    () => playerDefend(initial, { defenseId: 'brace' }),
    () => applyAttack(initial, 'enemy', { attackId: 'rally', targetId: 'left' }),
    () => applyAttack(initial, 'nobody', { attackId: 'rally', targetId: 'left' }),
    () => playerAttack(initial), () => playerAttack(initial, {}),
    () => playerAttack(initial, { attackId: 'missing', targetId: 'left' }),
    () => playerAttack(initial, { attackId: 'kora:quick', targetId: 'missing' }),
    () => playerAttack(initial, { attackId: 'kora:quick' }),
  ];
  for (const fn of illegal) assert.throws(fn);
  assert.equal(JSON.stringify(initial), initialJSON);
  const pending = freezeDeep(playerAttack(initial, { attackId: 'kora:quick', targetId: 'left' }));
  assert.throws(() => playerAttack(pending, { attackId: 'ilda:quick', targetId: 'right' }));
  assert.throws(() => applyDefense(pending, 'player', { defenseId: 'brace' }));
  assert.throws(() => applyDefense(pending, 'nobody', { defenseId: 'brace' }));
  assert.throws(() => applyDefense(pending, 'enemy', { defenseId: 'missing' }));
  assert.throws(() => applyDefense(pending, 'enemy', {}));
  const next = resolveAiDefense(pending);
  assert.throws(() => resolveAiDefense(next));
  for (const api of [legalTargets, availableAttacks, availableDefenses]) assert.throws(() => api(initial, 'nobody'));
  assert.throws(() => previewDefense(pending, 'missing'));
  assert.throws(() => previewAttack(initial, { attackId: 'missing', targetId: 'left' }));
});

function publicPlayerStep(state, salt = 0) {
  if (state.phase === 'playerAttack') {
    const candidates = availableAttacks(state, 'player').filter((entry) => entry.available && entry.mode !== 'prepare');
    // Rotate equal-damage ties deterministically; no AI policy assumptions are made.
    const ranked = [...candidates].sort((a, b) => b.damage - a.damage || a.cost - b.cost || a.id.localeCompare(b.id));
    const chosen = ranked[salt % Math.min(2, ranked.length)];
    return playerAttack(state, { attackId: chosen.id, targetId: preferredTarget(state, 'player') });
  }
  if (state.phase === 'aiDefense') return resolveAiDefense(state);
  if (state.phase === 'aiAttack') return chooseAiAttack(state);
  if (state.phase === 'playerDefense') {
    const options = availableDefenses(state, 'player').filter((entry) => entry.available);
    options.sort((a, b) => previewDefense(state, b.id).blocked - previewDefense(state, a.id).blocked || a.cost - b.cost);
    return playerDefend(state, { defenseId: options[0].id });
  }
  throw new Error(`Unexpected non-terminal phase: ${state.phase}`);
}

test('seeded AI only chooses available attacks, available defenses, and legal targets', () => {
  for (let seed = 1; seed <= 6; seed += 1) {
    let state = init({ seed, firstSide: seed % 2 ? 'enemy' : 'player' });
    for (let step = 0; step < 12 && !state.winner; step += 1) {
      const before = state;
      if (state.phase === 'aiAttack') {
        const candidates = availableAttacks(before, 'enemy').filter((a) => a.available);
        state = chooseAiAttack(before);
        if (state.pendingAttack) {
          const chosen = candidates.find((a) => a.id === state.pendingAttack.attackId);
          assert.ok(chosen);
          assert.equal(state.pendingAttack.damage, chosen.damage);
          assert.ok(legalTargets(before, 'enemy').some((c) => c.id === state.pendingAttack.targetId));
        } else {
          assert.equal(state.phase, 'playerAttack');
          assert.ok(candidates.some((a) => a.mode === 'prepare'));
        }
      } else if (state.phase === 'aiDefense') {
        const allowed = availableDefenses(before, 'enemy').filter((d) => d.available).map((d) => d.id);
        state = resolveAiDefense(before);
        assert.ok(allowed.includes(state.lastDefense.id));
      } else state = publicPlayerStep(state);
      assertStateBounds(state);
    }
  }
});

test('identical seeds and public choices replay byte-for-byte through JSON saves in every phase', () => {
  for (const firstSide of ['player', 'enemy', 'random']) {
    let a = init({ firstSide, seed: 'saved-run' });
    let b = copy(a);
    for (let step = 0; step < 24 && !a.winner; step += 1) {
      a = publicPlayerStep(a, step);
      b = copy(publicPlayerStep(copy(b), step));
      assert.deepEqual(a, b, `${firstSide} phase ${step}`);
    }
  }
});

test('no-deadlock fallbacks survive zero energy, fatigue, and both side-hero retreats', () => {
  for (const firstSide of SIDES) {
    let state = init({ firstSide });
    for (const side of SIDES) {
      state.energy[side] = 0;
      for (const hero of Object.values(state.heroes[side])) hero.readyAt = 99;
      for (const id of ['kora', 'ilda']) {
        state.heroes[side][id].retreatRounds = 1;
        state.heroes[side][id].retreatUntilRound = 3;
        state.heroes[side][id].castleId = 'main';
        castle(state, side, STATION[id]).hp = 0;
      }
      const legal = availableAttacks(state, side).filter((entry) => entry.available);
      assert.deepEqual(legal.map((entry) => entry.id), ['rally']);
      assert.equal(legal[0].heroId, 'neris');
      assert.deepEqual(availableDefenses(state, side).filter((entry) => entry.available).map((entry) => entry.id), ['brace']);
    }
    for (let i = 0; i < 8; i += 1) {
      state = strike(state, attackingSide(state), 'rally', 'main');
      assertStateBounds(state);
    }
    assert.equal(state.round, 5);
  }
});

function scriptedStep(state, salt = 0) {
  const side = attackingSide(state);
  if (side) {
    const options = availableAttacks(state, side).filter((entry) => entry.available);
    const preparation = options.filter((entry) => entry.mode === 'prepare');
    const ranked = options.filter((entry) => entry.mode !== 'prepare')
      .sort((a, b) => b.damage - a.damage || a.cost - b.cost || a.id.localeCompare(b.id));
    const chosen = salt % 17 === 0 && preparation.length
      ? preparation[salt % preparation.length] : ranked[salt % Math.min(2, ranked.length)];
    return applyAttack(state, side, { attackId: chosen.id, targetId: preferredTarget(state, side) });
  }
  const defender = defendingSide(state);
  const options = availableDefenses(state, defender).filter((entry) => entry.available);
  options.sort((a, b) => previewDefense(state, b.id).blocked - previewDefense(state, a.id).blocked || a.cost - b.cost);
  return applyDefense(state, defender, { defenseId: salt % 7 === 0 ? 'brace' : options[0].id });
}

test('mirroring initiative, actions, and equal training produces exactly mirrored rules outcomes', () => {
  for (const tier of [0, 3]) {
    let a = createGame({ firstSide: 'player', seed: 19, trainingBySide: { player: tier, enemy: tier } });
    let b = createGame({ firstSide: 'enemy', seed: 19, trainingBySide: { player: tier, enemy: tier } });
    for (let step = 0; step < 100 && !a.winner; step += 1) {
      a = scriptedStep(a, step);
      b = scriptedStep(b, step);
      for (const side of SIDES) {
        assert.deepEqual(a.castles[side], b.castles[other(side)]);
        assert.deepEqual(a.heroes[side], b.heroes[other(side)]);
        assert.equal(a.energy[side], b.energy[other(side)]);
        assert.equal(a.decisionIndex[side], b.decisionIndex[other(side)]);
        assert.equal(a.attackCount[side], b.attackCount[other(side)]);
      }
      assert.equal(a.round, b.round);
      assert.equal(a.turnInRound, b.turnInRound);
      assert.equal(a.winner, b.winner ? other(b.winner) : null);
    }
  }
});

test('200 seeded complete matches preserve HP, energy, serialization, and forward progress for both initiatives', () => {
  const wins = { player: 0, enemy: 0 };
  let totalRounds = 0;
  for (const firstSide of SIDES) {
    for (let seed = 1; seed <= 100; seed += 1) {
      let state = init({ seed, firstSide });
      let steps = 0;
      while (!state.winner && steps < 1600) {
        const previous = state;
        state = scriptedStep(state, seed + steps);
        assertStateBounds(state);
        assert.notEqual(state, previous);
        assert.ok(state.round >= previous.round && state.round <= previous.round + 1);
        for (const side of SIDES) {
          assert.ok(state.decisionIndex[side] >= previous.decisionIndex[side]);
          assert.ok(state.decisionIndex[side] <= previous.decisionIndex[side] + 1);
          for (const entry of state.castles[side]) assert.ok(entry.hp <= castle(previous, side, entry.id).hp);
        }
        steps += 1;
      }
      assert.ok(state.winner, `${firstSide}-first seed ${seed} did not finish after ${steps} transitions`);
      wins[state.winner] += 1;
      totalRounds += state.round;
    }
  }
  console.log(`V2 seeded coverage: ${wins.player} player / ${wins.enemy} enemy wins; ${(totalRounds / 200).toFixed(1)} mean rounds across both initiatives.`);
});
