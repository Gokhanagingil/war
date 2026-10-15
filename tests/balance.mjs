#!/usr/bin/env node
/** Reproducible v3 public-information probes. These are diagnostics, not proof of balance. */
const enginePath = process.argv.find((arg) => arg.startsWith('--engine='))?.slice(9);
const engineUrl = enginePath ? new URL(`file://${enginePath}`) : new URL('../dist/engine.js', import.meta.url);
const e = await import(engineUrl.href);
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const args = process.argv.slice(2);
const seeds = Math.max(1, Math.min(1000, Number(args.find((a) => /^\d+$/.test(a))) || 6));
const selectedSeeds = args.find((a) => a.startsWith('--seed-list='))?.slice(12).split(',').map(Number) ?? Array.from({ length: seeds }, (_, i) => i + 1);
assert.ok(selectedSeeds.every(Number.isFinite), 'seed-list must be numeric');
const noAi = args.includes('--no-ai');
const noWitnesses = args.includes('--no-witnesses');
const MAX_ATTACKS = 300;
const other = (side) => side === 'player' ? 'enemy' : 'player';
const ids = Object.keys(e.ORDERS);
const castle = (s, side, id) => s.castles[side].find((c) => c.id === id);
const attackSide = (s) => s.phase === 'playerAttack' ? 'player' : s.phase === 'aiAttack' ? 'enemy' : null;
const defendSide = (s) => s.phase === 'playerDefense' ? 'player' : s.phase === 'aiDefense' ? 'enemy' : null;
function best(list, score) { let chosen = null, value = -Infinity; for (const item of list) { const next = score(item); if (next > value + 1e-9) { value = next; chosen = item; } } return chosen; }
function attacks(s, side) {
  const result = new Map();
  for (const action of e.legalAttacks(s, side)) {
    const key = `${action.orderId}:${action.targetId}:${action.orderId === 'banner' ? action.sourceId : ''}`;
    if (!result.has(key) || action.damage > result.get(key).damage) result.set(key, action);
  }
  return [...result.values()];
}
function guards(s, side) {
  const result = new Map();
  for (const action of e.legalDefenses(s, side)) if (!result.has(action.orderId) || action.block > result.get(action.orderId).block) result.set(action.orderId, action);
  return [...result.values()];
}
function focus(s, side, targetId) {
  if (targetId === 'main') return 1.35;
  const wings = s.castles[other(side)].filter((c) => c.id !== 'main');
  return castle(s, other(side), targetId).hp <= Math.min(...wings.map((c) => c.hp)) ? 1 : 0.6;
}
function potential(cardId, s, side, targetId) { const c = e.ORDERS[cardId]; return c.damage + (c.id === 'catapult' && s.lastOwnTarget[side] === targetId ? 18 : 0) + (c.id === 'mist' ? 7 : 0); }
function chooseAttack(s, side, policy) {
  if (policy === 'engine-ai') return e.selectAttack(s, side);
  const options = attacks(s, side);
  if (policy === 'strongest' || policy.startsWith('spam-')) {
    const preferred = policy.slice(5);
    return best(options, (a) => (a.orderId === preferred ? 1e6 : 0) + a.damage * 1000 + (a.targetId === 'main' ? 200 : 0) - castle(s, other(side), a.targetId).hp);
  }
  return best(options, (a) => {
    const p = e.previewAttack(s, a), target = castle(s, other(side), a.targetId);
    const hit = Math.min(...p.possibleBlocks.map((g) => g.hpLost));
    let score = hit * focus(s, side, a.targetId) + (hit >= target.hp ? (a.targetId === 'main' ? 10000 : 28) : 0);
    if (policy === 'card-aware') {
      score += (a.orderId === 'banner' && castle(s, side, a.sourceId).cover === 0 ? 7 : 0);
      score += potential(p.nextReceivedOrder, s, side, a.targetId) * 0.12 - potential(a.orderId, s, side, a.targetId) * 0.12;
      const afterHand = p.handAfter.map((id) => e.ORDERS[id]);
      score += afterHand.filter((card) => s.hands[other(side)].some((id) => card.guardType === e.ORDERS[id].type || card.guardType === 'universal')).length * 2;
    }
    return score;
  });
}
function chooseDefense(s, side, policy) {
  if (policy === 'engine-ai') return e.selectDefense(s, side);
  return best(guards(s, side), (g) => {
    const p = e.previewDefense(s, g), target = castle(s, side, s.pendingAttack.targetId);
    let score = -p.hpLost * (s.pendingAttack.targetId === 'main' ? 1.35 : 1) - (p.castleFell ? (target.id === 'main' ? 10000 : 28) : 0);
    if (policy === 'card-aware') {
      const remaining = p.nextAttackOrders;
      score += Math.max(...remaining.map((id) => potential(id, s, side, s.lastOwnTarget[side]))) * 0.45;
    }
    return score + (g.orderId === 'brace' ? 0.01 : 0);
  });
}
function cycleKey(s) { return JSON.stringify({ phase: s.phase, castles: s.castles, heroes: s.heroes, hands: s.hands, neutralOrder: s.neutralOrder, committedOrder: s.committedOrder, lastOwnTarget: s.lastOwnTarget }); }
function play({ seed, firstSide, swapped, pair, training }) {
  const deal = e.createGame({ seed });
  const hands = swapped ? { player: deal.hands.enemy, enemy: deal.hands.player } : deal.hands;
  const policies = swapped ? { player: pair[1], enemy: pair[0] } : { player: pair[0], enemy: pair[1] };
  let s = e.createGame({ seed, hands, neutralOrder: deal.neutralOrder, firstSide, trainingEnabled: training !== 'base', trainingBySide: training === 'symmetric3' ? { player: 3, enemy: 3 } : training === 'player3' ? { player: 3, enemy: 0 } : { player: 0, enemy: 0 } });
  const seen = new Map(), used = { player: {}, enemy: {} }; let zeroDamageAttacks = 0;
  const decisions = { attacks: 0, forcedAttacks: 0, defenses: 0, matchingAvailable: 0, matchingDeclined: 0, braceWithMatching: 0, nonmatchingChosen: 0 };
  for (let step = 0; step < MAX_ATTACKS * 2 && !s.winner; step++) {
    e.validateState(s); const side = attackSide(s) ?? defendSide(s);
    if (attackSide(s)) {
      const key = cycleKey(s); if (seen.has(key)) return { outcome: 'cycle', attacks: s.turnIndex, firstSide, swapped, seed, pair, cycleLength: s.turnIndex - seen.get(key), hands, neutralOrder: deal.neutralOrder, used };
      seen.set(key, s.turnIndex);
      decisions.attacks++; if (s.committedOrder[side]) decisions.forcedAttacks++;
      const action = chooseAttack(s, side, policies[side]); assert.ok(action, 'no attack'); used[side][action.orderId] = (used[side][action.orderId] || 0) + 1; s = e.applyAttack(s, side, action);
    } else {
      const action = chooseDefense(s, side, policies[side]), options = guards(s, side), chosen = options.find((g) => g.orderId === action.orderId), hasMatch = options.some((g) => g.matching);
      decisions.defenses++; if (hasMatch) decisions.matchingAvailable++;
      if (hasMatch && !chosen.matching) { decisions.matchingDeclined++; if (action.orderId === 'brace') decisions.braceWithMatching++; }
      if (action.orderId !== 'brace' && !chosen.matching) decisions.nonmatchingChosen++;
      s = e.applyDefense(s, side, action); if (s.lastEvent.hpLost === 0) zeroDamageAttacks++;
    }
  }
  return { outcome: s.winner ? policies[s.winner] : 'timeout', winnerSide: s.winner, attacks: s.turnIndex, firstSide, swapped, seed, used, zeroDamageAttacks, decisions };
}
const pairs = [ ['strongest', 'target-aware'], ['strongest', 'card-aware'], ...ids.map((id) => [`spam-${id}`, 'card-aware']) ];
if (!noAi) pairs.push(['strongest', 'engine-ai'], ['card-aware', 'engine-ai'], ...ids.map((id) => [`spam-${id}`, 'engine-ai']));
const requestedPair = args.find((a) => a.startsWith('--pair='))?.slice(7).split(':');
const chosenPairs = requestedPair ? [requestedPair] : pairs;
const trainingModes = (args.find((a) => a.startsWith('--training='))?.slice(11) ?? 'base').split(',');
for (const mode of trainingModes) assert.ok(['base', 'symmetric3', 'player3'].includes(mode), `invalid training ${mode}`);
const summary = { version: 3, engineSha256: createHash('sha256').update(readFileSync(engineUrl)).digest('hex'), seeds: selectedSeeds.length, seedValues: selectedSeeds, mirrored: 'Each seed plays both initiative sides and both physical player/enemy assignments; deals move with policy identity.', trainingModes, warning: 'Heuristic policy probes and constructed positions; not proof of balance, fun, or universal non-dominance.', results: [], cycles: [], timeouts: [] };
for (const training of trainingModes) for (const pair of chosenPairs) {
  const result = { training, pair: pair.join(' vs '), games: 0, wins: { [pair[0]]: 0, [pair[1]]: 0 }, firstAttackerWins: 0, cycles: 0, timeouts: 0, meanAttacks: 0, maxAttacks: 0, zeroDamageAttacks: 0, decisions: {}, orderUse: {} };
  for (const seed of selectedSeeds) for (const firstSide of ['player', 'enemy']) for (const swapped of [false, true]) {
    const game = play({ seed, firstSide, swapped, pair, training }); result.games++; result.meanAttacks += game.attacks; result.maxAttacks = Math.max(result.maxAttacks, game.attacks); result.zeroDamageAttacks += game.zeroDamageAttacks || 0;
    if (game.outcome === 'cycle') { result.cycles++; summary.cycles.push({ training, ...game }); }
    else if (game.outcome === 'timeout') { result.timeouts++; summary.timeouts.push({ training, ...game }); }
    else { result.wins[game.outcome]++; if (game.winnerSide === game.firstSide) result.firstAttackerWins++; }
    for (const [key, value] of Object.entries(game.decisions || {})) result.decisions[key] = (result.decisions[key] || 0) + value;
    for (const side of ['player', 'enemy']) for (const [orderId, count] of Object.entries(game.used[side])) result.orderUse[orderId] = (result.orderUse[orderId] || 0) + count;
  }
  result.meanAttacks = Number((result.meanAttacks / result.games).toFixed(2)); summary.results.push(result);
  console.error(`${training} ${result.pair}: ${JSON.stringify(result.wins)}, cycles=${result.cycles}, mean=${result.meanAttacks} attacks`);
}
function permutations(values) { if (values.length === 1) return [values]; return values.flatMap((v, i) => permutations(values.filter((_, j) => i !== j)).map((tail) => [v, ...tail])); }
function unlock(s, side) { castle(s, side, 'left').hp = 0; s.heroes[side].kora.castleId = 'main'; }
function witnesses() {
  const findings = Object.fromEntries(ids.map((id) => [id, { chosen: null, declined: null }]));
  const profiles = ['opening', 'repeat', 'protect-low-tower', 'main-race', 'finish-tower'];
  for (const deck of permutations(ids)) for (const profile of profiles) {
    const s = e.createGame({ seed: 'counterexamples', hands: { player: deck.slice(0, 2), enemy: deck.slice(2, 4) }, neutralOrder: deck[4] });
    if (profile === 'repeat') s.lastOwnTarget.player = 'left';
    if (profile === 'protect-low-tower') { castle(s, 'player', 'left').hp = 15; castle(s, 'enemy', 'left').hp = 60; s.lastOwnTarget.player = 'left'; }
    if (profile === 'main-race') { unlock(s, 'player'); unlock(s, 'enemy'); castle(s, 'player', 'main').hp = 30; castle(s, 'enemy', 'main').hp = 24; s.lastOwnTarget.player = 'main'; }
    if (profile === 'finish-tower') { castle(s, 'enemy', 'left').hp = 15; s.lastOwnTarget.player = 'left'; }
    const selected = e.selectAttack(s, 'player');
    const snapshot = { profile, hands: s.hands, neutralOrder: s.neutralOrder, previousOwnTarget: s.lastOwnTarget.player, playerHp: s.castles.player.map((c) => c.hp), enemyHp: s.castles.enemy.map((c) => c.hp), chosen: { orderId: selected.orderId, heroId: selected.heroId, targetId: selected.targetId }, minimumDamage: e.previewAttack(s, selected).minimumDamage };
    for (const id of s.hands.player) { const key = selected.orderId === id ? 'chosen' : 'declined'; if (!findings[id][key]) findings[id][key] = snapshot; }
    if (ids.every((id) => findings[id].chosen && findings[id].declined)) return findings;
  }
  return findings;
}
if (!noWitnesses) summary.counterexamplePositions = witnesses();
console.log(JSON.stringify(summary, null, 2));
if (summary.cycles.length || summary.timeouts.length) process.exitCode = 2;
