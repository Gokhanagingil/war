import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEROES, ATTACKS, DEFENSES, createGame, legalTargets, availableAttacks,
  availableDefenses, previewDefense, playerAttack, resolveAiDefense,
  chooseAiAttack, playerDefend, describeState,
} from '../dist/engine.js';

const copy = (value) => JSON.parse(JSON.stringify(value));
const readyAttack = (state, side = 'player') => availableAttacks(state, side).find((a) => a.available);
const target = (state, side = 'player') => legalTargets(state, side)[0].id;
function toDefense(state, attackId = readyAttack(state).id, targetId = target(state)) {
  return chooseAiAttack(resolveAiDefense(playerAttack(state, { attackId, targetId })));
}
function round(state, attackId = readyAttack(state).id, defenseId = 'brace') {
  return playerDefend(toDefense(state, attackId), { defenseId });
}
function freezeDeep(value) {
  Object.freeze(value);
  for (const item of Object.values(value)) if (item && typeof item === 'object') freezeDeep(item);
  return value;
}

test('initial state has symmetric castles and hero stats, distinct stations', () => {
  const state = createGame({ seed: 42, trainingEnabled: false });
  assert.equal(state.phase, 'playerAttack');
  assert.equal(state.round, 1);
  assert.equal(state.winner, null);
  assert.deepEqual(state.castles.player, state.castles.enemy);
  assert.deepEqual(state.heroes.player, state.heroes.enemy);
  assert.deepEqual(state.castles.player.map((c) => [c.id, c.hp]), [['left', 240], ['main', 420], ['right', 240]]);
  assert.deepEqual(Object.values(state.heroes.player).map((h) => h.castleId), ['left', 'right', 'main']);
  assert.deepEqual(availableAttacks(state, 'player'), availableAttacks(state, 'enemy'));
  assert.deepEqual(availableDefenses(state, 'player'), availableDefenses(state, 'enemy'));
  assert.equal(Object.isFrozen(HEROES.kora), true);
});

test('main target unlocks after either side falls; fallen castles stay untargetable', () => {
  const state = createGame();
  assert.deepEqual(legalTargets(state, 'player').map((c) => c.id), ['left', 'right']);
  assert.throws(() => playerAttack(state, { attackId: 'kora', targetId: 'main' }));
  state.castles.enemy.find((c) => c.id === 'right').hp = 0;
  assert.deepEqual(legalTargets(state, 'player').map((c) => c.id), ['left', 'main']);
  assert.throws(() => playerAttack(state, { attackId: 'kora', targetId: 'right' }));
  assert.deepEqual(legalTargets(state, 'enemy').map((c) => c.id), ['left', 'right']);
});

test('transitions are immutable and progress through all four phases', () => {
  const first = freezeDeep(createGame());
  const original = JSON.stringify(first);
  const attacking = playerAttack(first, { attackId: 'kora', targetId: 'left' });
  assert.equal(JSON.stringify(first), original);
  assert.notEqual(first.castles, attacking.castles);
  assert.equal(attacking.phase, 'aiDefense');
  assert.equal(attacking.pendingAttack.damage, 80);
  const defended = resolveAiDefense(freezeDeep(attacking));
  assert.equal(defended.phase, 'aiAttack');
  assert.equal(defended.lastEvent.kind, 'attackResolved');
  assert.equal(defended.pendingAttack, null);
  const incoming = chooseAiAttack(freezeDeep(defended));
  assert.equal(incoming.phase, 'playerDefense');
  assert.equal(incoming.pendingAttack.side, 'enemy');
  const ended = playerDefend(freezeDeep(incoming), { defenseId: 'brace' });
  assert.equal(ended.phase, 'playerAttack');
  assert.equal(ended.round, 2);
  assert.equal(ended.pendingAttack, null);
});

test('wrong-phase and repeated transition calls reject', () => {
  const initial = createGame();
  assert.throws(() => resolveAiDefense(initial));
  assert.throws(() => chooseAiAttack(initial));
  assert.throws(() => playerDefend(initial, { defenseId: 'brace' }));
  const attack = playerAttack(initial, { attackId: 'ilda', targetId: 'right' });
  assert.throws(() => playerAttack(attack, { attackId: 'ilda', targetId: 'right' }));
  const defense = resolveAiDefense(attack);
  assert.throws(() => resolveAiDefense(defense));
  const incoming = chooseAiAttack(defense);
  assert.throws(() => chooseAiAttack(incoming));
  const next = playerDefend(incoming, { defenseId: 'brace' });
  assert.throws(() => playerDefend(next, { defenseId: 'brace' }));
  assert.throws(() => playerAttack(initial, { attackId: 'unknown', targetId: 'left' }));
  assert.throws(() => playerAttack(initial, { attackId: 'kora', targetId: 'unknown' }));
  assert.throws(() => playerDefend(incoming, { defenseId: 'unknown' }));
});

test('attack and defense cooldowns are independent and have one intervening round', () => {
  const attack = playerAttack(createGame(), { attackId: 'kora', targetId: 'left' });
  assert.equal(availableAttacks(attack, 'player').find((a) => a.id === 'kora').available, false);
  assert.equal(availableDefenses(attack, 'player').find((a) => a.id === 'kora').available, true);
  const incoming = chooseAiAttack(resolveAiDefense(attack));
  const next = playerDefend(incoming, { defenseId: 'kora' });
  assert.equal(next.heroes.player.kora.attackCd, 1);
  assert.equal(next.heroes.player.kora.defenseCd, 1);
  assert.throws(() => playerAttack(next, { attackId: 'kora', targetId: 'left' }));
  const laterIncoming = toDefense(next, 'neris');
  assert.throws(() => playerDefend(laterIncoming, { defenseId: 'kora' }));
  const later = playerDefend(laterIncoming, { defenseId: 'brace' });
  assert.equal(later.heroes.player.kora.attackCd, 0);
  assert.equal(later.heroes.player.kora.defenseCd, 0);
});

test('matching defenses block far more than brace or mismatched defenses', () => {
  for (const id of Object.keys(HEROES)) {
    const state = playerAttack(createGame(), { attackId: id, targetId: 'left' });
    const match = previewDefense(state, id);
    const brace = previewDefense(state, 'brace');
    const other = previewDefense(state, Object.keys(HEROES).find((otherId) => otherId !== id));
    assert.equal(match.effective, true);
    assert.equal(brace.effective, false);
    assert.ok(match.blocked >= brace.blocked * 3);
    assert.equal(other.blocked, 0);
    assert.equal(other.damage, other.incoming);
    assert.equal(brace.blocked, 12);
    assert.match(other.label, /savunma başarısız/);
    assert.equal(match.incoming, match.blocked + match.damage);
    assert.equal(previewDefense(state, id).label, 'Tür eşleşmesi! Güçlü savunma.');
  }
  assert.equal(previewDefense(createGame(), 'brace').incoming, 0);
});

test('wrong typed defense fails completely, still consumes its separate defense cooldown', () => {
  for (const incomingType of ['stone', 'arrow', 'sound']) {
    const state = toDefense(createGame());
    state.pendingAttack.type = incomingType;
    state.pendingAttack.damage = 80;
    state.pendingAttack.targetId = 'left';
    const wrong = Object.keys(HEROES).find((id) => HEROES[id].type !== incomingType);
    const defended = playerDefend(state, { defenseId: wrong });
    assert.equal(defended.lastEvent.blocked, 0);
    assert.equal(defended.lastEvent.damage, 80);
    assert.equal(defended.castles.player.find((c) => c.id === 'left').hp, 160);
    assert.equal(defended.heroes.player[wrong].defenseCd, 1);
  }
});

test('any active hero can defend any castle', () => {
  const state = toDefense(createGame());
  state.pendingAttack.targetId = 'right';
  state.pendingAttack.type = 'stone';
  state.pendingAttack.damage = 80;
  const defended = playerDefend(state, { defenseId: 'kora' });
  assert.equal(defended.castles.player.find((c) => c.id === 'right').hp, 210);
  assert.equal(defended.lastEvent.blocked, 50);
});

test('enemy side hero retreats immediately for the following full round, then returns', () => {
  const state = createGame();
  state.castles.enemy.find((c) => c.id === 'left').hp = 1;
  const destroyed = resolveAiDefense(playerAttack(state, { attackId: 'kora', targetId: 'left' }));
  assert.equal(destroyed.lastEvent.castleFell, true);
  assert.equal(destroyed.heroes.enemy.kora.castleId, 'main');
  assert.equal(destroyed.heroes.enemy.kora.retreatRounds, 1);
  assert.equal(availableAttacks(destroyed, 'enemy').find((a) => a.id === 'kora').available, false);
  assert.equal(availableDefenses(destroyed, 'enemy').find((a) => a.id === 'kora').available, false);
  const incoming = chooseAiAttack(destroyed);
  assert.notEqual(incoming.pendingAttack.heroId, 'kora');
  const next = playerDefend(incoming, { defenseId: 'brace' });
  assert.equal(next.round, 2);
  assert.equal(next.heroes.enemy.kora.retreatRounds, 1);
  const returned = round(next, 'neris');
  assert.equal(returned.round, 3);
  assert.equal(returned.heroes.enemy.kora.retreatRounds, 0);
  assert.equal(returned.heroes.enemy.kora.castleId, 'main');
  assert.equal(availableAttacks(returned, 'enemy').find((a) => a.id === 'kora').available, true);
});

test('player side hero also misses a complete round and returns, never eliminated', () => {
  const state = toDefense(createGame());
  state.castles.player.find((c) => c.id === 'right').hp = 1;
  state.pendingAttack.targetId = 'right';
  const next = playerDefend(state, { defenseId: 'brace' });
  assert.equal(next.heroes.player.ilda.retreatRounds, 1);
  assert.equal(next.round, 2);
  assert.throws(() => playerAttack(next, { attackId: 'ilda', targetId: 'left' }));
  const returned = round(next, 'neris');
  assert.equal(returned.round, 3);
  assert.equal(returned.heroes.player.ilda.retreatRounds, 0);
  assert.equal(returned.heroes.player.ilda.castleId, 'main');
});

test('weak attack and universal brace remain usable when every hero is unavailable', () => {
  const state = createGame();
  for (const side of ['player', 'enemy']) {
    for (const hero of Object.values(state.heroes[side])) {
      hero.attackCd = 2; hero.defenseCd = 2; hero.retreatRounds = 1; hero.retreatUntilRound = 3;
    }
    assert.deepEqual(availableAttacks(state, side).filter((a) => a.available).map((a) => a.id), ['rally']);
    assert.deepEqual(availableDefenses(state, side).filter((a) => a.available).map((a) => a.id), ['brace']);
  }
  const incoming = toDefense(state, 'rally');
  assert.equal(incoming.pendingAttack.attackId, 'rally');
  const next = playerDefend(incoming, { defenseId: 'brace' });
  assert.equal(next.round, 2);
});

test('training values are bounded integers, optional, modest and player Kora only', () => {
  const trained = createGame({ training: { power: 9000, defense: 3.9 } });
  assert.deepEqual(trained.training, { enabled: true, power: 3, defense: 3 });
  assert.equal(trained.trainingEnabled, true);
  assert.equal(availableAttacks(trained, 'player')[0].damage, 89);
  assert.ok((89 - ATTACKS.kora.damage) / ATTACKS.kora.damage < 0.12);
  assert.equal(availableDefenses(trained, 'player')[0].block, 59);
  assert.equal(availableAttacks(trained, 'enemy')[0].damage, 80);
  assert.equal(availableDefenses(trained, 'enemy')[0].block, 50);
  assert.equal(availableAttacks(trained, 'player')[1].damage, ATTACKS.ilda.damage);
  const off = createGame({ training: { power: 3, defense: 3 }, trainingEnabled: false });
  assert.equal(off.training.power, 0);
  assert.equal(off.training.defense, 0);
  assert.equal(off.trainingEnabled, false);
  assert.deepEqual(availableAttacks(off, 'player'), availableAttacks(off, 'enemy'));
  assert.equal(createGame({ training: { power: -10, defense: NaN } }).training.power, 0);
  assert.equal(createGame({ training: { power: -10, defense: NaN } }).training.defense, 0);
});

test('fallback attack is performed by an active hero and does not reset their special cooldown', () => {
  const state = createGame();
  state.heroes.player.kora.attackCd = 2;
  const fallback = availableAttacks(state, 'player').find((a) => a.id === 'rally');
  assert.equal(fallback.heroId, 'kora');
  const attacking = playerAttack(state, { attackId: 'rally', targetId: 'left' });
  assert.equal(attacking.pendingAttack.heroId, 'kora');
  assert.match(attacking.pendingAttack.label, /Kora/);
  assert.equal(attacking.heroes.player.kora.attackCd, 2);
  state.heroes.player.kora.retreatRounds = 1;
  assert.equal(availableAttacks(state, 'player').find((a) => a.id === 'rally').heroId, 'ilda');
  assert.equal(HEROES.ilda.name, 'İlda');
});

test('victory finishes immediately at either main castle and blocks all transitions', () => {
  let state = createGame();
  state.castles.enemy.find((c) => c.id === 'left').hp = 0;
  state.castles.enemy.find((c) => c.id === 'main').hp = 1;
  state = resolveAiDefense(playerAttack(state, { attackId: 'kora', targetId: 'main' }));
  assert.equal(state.winner, 'player');
  assert.equal(state.phase, 'finished');
  assert.equal(state.lastEvent.winner, 'player');
  assert.equal(state.castles.enemy.find((c) => c.id === 'main').hp, 0);
  assert.deepEqual(legalTargets(state, 'player'), []);
  assert.throws(() => chooseAiAttack(state));
  assert.throws(() => playerAttack(state, { attackId: 'rally', targetId: 'right' }));
  let enemy = toDefense(createGame());
  enemy.castles.player.find((c) => c.id === 'left').hp = 0;
  enemy.castles.player.find((c) => c.id === 'main').hp = 1;
  enemy.pendingAttack.targetId = 'main';
  enemy = playerDefend(enemy, { defenseId: 'brace' });
  assert.equal(enemy.winner, 'enemy');
  assert.equal(enemy.phase, 'finished');
  assert.equal(enemy.round, 1);
  assert.match(describeState(enemy), /Rakip/);
});

test('same seed and actions replay identically, including JSON saves in intermediate phases', () => {
  let a = createGame({ seed: 'saved-run' });
  let b = createGame({ seed: 'saved-run' });
  for (let i = 0; i < 8 && !a.winner; i += 1) {
    const attack = readyAttack(a).id;
    const targetId = legalTargets(a, 'player').find((c) => c.id === 'main')?.id ?? target(a);
    a = playerAttack(a, { attackId: attack, targetId });
    b = copy(playerAttack(b, { attackId: attack, targetId }));
    a = resolveAiDefense(a); b = resolveAiDefense(b);
    assert.deepEqual(a, b);
    if (a.winner) break;
    a = chooseAiAttack(a); b = copy(chooseAiAttack(copy(b)));
    assert.deepEqual(a, b);
    a = playerDefend(a, { defenseId: 'brace' });
    b = playerDefend(copy(b), { defenseId: 'brace' });
    assert.deepEqual(a, b);
  }
  assert.ok(a.log.length <= 8);
});

test('AI uses legal readiness, meaningful counters and seed-varied opening tactics', () => {
  const openings = new Set();
  for (let seed = 1; seed <= 50; seed += 1) {
    const defended = resolveAiDefense(playerAttack(createGame({ seed }), { attackId: 'neris', targetId: 'left' }));
    assert.equal(defended.lastDefense.id, 'neris');
    const allowed = availableAttacks(defended, 'enemy').filter((a) => a.available).map((a) => a.id);
    const incoming = chooseAiAttack(defended);
    assert.ok(allowed.includes(incoming.pendingAttack.attackId));
    assert.ok(legalTargets(defended, 'enemy').some((c) => c.id === incoming.pendingAttack.targetId));
    assert.equal(incoming.pendingAttack.damage, ATTACKS[incoming.pendingAttack.attackId].damage);
    openings.add(`${incoming.pendingAttack.attackId}:${incoming.pendingAttack.targetId}`);
  }
  assert.ok(openings.size >= 3);
});

test('deterministic simulation: 200 complete matches preserve health, counters and progress', () => {
  const wins = { player: 0, enemy: 0 };
  let totalRounds = 0;
  for (let seed = 1; seed <= 200; seed += 1) {
    let state = createGame({ seed, trainingEnabled: false });
    while (!state.winner && state.round < 150) {
      const attacks = availableAttacks(state, 'player').filter((a) => a.available);
      const enemyDefenses = availableDefenses(state, 'enemy').filter((d) => d.available);
      // A basic public-information tactical player chooses the strongest uncovered type.
      const attack = attacks.sort((a, b) => {
        const expected = (a) => a.damage - Math.max(...enemyDefenses.map((d) => d.type === a.type ? d.block : d.id === 'brace' ? d.block : d.offTypeBlock));
        return expected(b) - expected(a);
      })[0];
      const targets = legalTargets(state, 'player');
      const selected = targets.find((c) => c.id === 'main') ?? targets.sort((a, b) => a.hp - b.hp)[0];
      state = resolveAiDefense(playerAttack(state, { attackId: attack.id, targetId: selected.id }));
      if (state.winner) break;
      state = chooseAiAttack(state);
      const defenses = availableDefenses(state, 'player').filter((d) => d.available);
      const defense = defenses.sort((a, b) => previewDefense(state, b.id).blocked - previewDefense(state, a.id).blocked)[0];
      state = playerDefend(state, { defenseId: defense.id });
      for (const side of ['player', 'enemy']) {
        for (const castle of state.castles[side]) assert.ok(castle.hp >= 0 && castle.hp <= castle.maxHp);
        for (const hero of Object.values(state.heroes[side])) {
          assert.ok(Number.isInteger(hero.attackCd) && hero.attackCd >= 0 && hero.attackCd <= 2);
          assert.ok(Number.isInteger(hero.defenseCd) && hero.defenseCd >= 0 && hero.defenseCd <= 2);
          assert.ok(hero.retreatRounds === 0 || hero.retreatRounds === 1);
        }
      }
      assert.ok(state.log.length <= 8);
    }
    assert.ok(state.winner, `Seed ${seed} did not finish`);
    wins[state.winner] += 1;
    totalRounds += state.round;
  }
  console.log(`Balance sample: ${wins.player} player / ${wins.enemy} enemy wins; ${(totalRounds / 200).toFixed(1)} average rounds (tactical script, base stats).`);
});
