#!/usr/bin/env node
/**
 * Reproducible v2 policy probes, NOT a proof of human balance or fun.
 * node tests/balance.mjs [seeds=30] [--no-ai] [--training=base,player3,symmetric3]
 *                            [--pair=strongest:engine-ai] [--opening=final|4v4]
 * Seeds break near-equal policy ties only: combat itself is deterministic.
 * Each pairing is tested with both initiative orders. Training is per SIDE;
 * player3 is intentionally asymmetric, symmetric3 is the fair max-tier probe.
 * Opening defaults to the shipped first-attacker 3 / second-attacker 4 energy.
 * --opening=4v4 explicitly recreates the earlier symmetric-energy benchmark.
 * No policy reads hidden state or uses actions unavailable to human players.
 */
import * as engine from '../dist/engine.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const seedCount = Math.max(1, Math.min(1000, Number(args.find((a) => /^\d+$/.test(a))) || 30));
const opening = args.find((a) => a.startsWith('--opening='))?.slice(10) || 'final';
assert(['final', '4v4'].includes(opening), `Unknown opening setting: ${opening}`);
const MAX_ROUNDS = 200; // An intended short duel still running here is a real warning.
const other = (side) => side === 'player' ? 'enemy' : 'player';
const sides = ['player', 'enemy'];
const trainingSettings = {
  base: { trainingEnabled: false, trainingBySide: { player: 0, enemy: 0 } },
  player3: { trainingEnabled: true, trainingBySide: { player: 3, enemy: 0 }, training: { power: 3 } },
  symmetric3: { trainingEnabled: true, trainingBySide: { player: 3, enemy: 3 }, training: { power: 3 } },
};
const trainingNames = (args.find((a) => a.startsWith('--training='))?.slice(11) || Object.keys(trainingSettings).join(',')).split(',');
for (const name of trainingNames) assert(trainingSettings[name], `Unknown training setting: ${name}`);
function rng(seed) {
  let x = seed >>> 0;
  return () => { x = (x + 0x6d2b79f5) >>> 0; let t = Math.imul(x ^ x >>> 15, 1 | x); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function pick(scored, random, tolerance = 0.001) {
  const best = Math.max(...scored.map((entry) => entry.score));
  const ties = scored.filter((entry) => entry.score >= best - tolerance);
  return ties[Math.min(ties.length - 1, Math.floor(random() * ties.length))].payload;
}
const energyValue = (energy) => Math.min(energy, 3) * 6 + Math.max(0, energy - 3) * 3;
function focusWeight(state, side, target) {
  if (target.id === 'main') return 1.25;
  const lowestWing = Math.min(...state.castles[other(side)].filter((c) => c.id !== 'main').map((c) => c.hp));
  return target.hp > lowestWing ? 0.68 : 1;
}
function attackCandidates(state, side) {
  const targets = engine.legalTargets(state, side);
  return engine.availableAttacks(state, side).filter((a) => a.available).flatMap((attack) => attack.mode === 'prepare'
    ? [{ payload: { attackId: attack.id, targetId: null }, attack, target: null }]
    : targets.map((target) => ({ payload: { attackId: attack.id, targetId: target.id }, attack, target })));
}
function guardOpportunity(state, side, attack) {
  if (!attack.fatigues) return 0;
  const matchingEnemy = engine.availableAttacks(state, other(side)).filter((a) => a.mode !== 'prepare' && a.type === attack.type);
  if (!matchingEnemy.length || state.energy[side] - attack.cost < 2) return 0;
  const matchingDefense = Object.values(engine.DEFENSES).find((d) => d.heroId === attack.heroId);
  // Reserve the potential matching guard: its extra protection over a free guard,
  // discounted because the opponent can change attack type. No invented HP bonus.
  const free = Object.values(engine.DEFENSES).find((d) => !d.heroId)?.block || 0;
  return Math.max(0, matchingDefense.block - free) * 0.22;
}
function heuristicAttack(state, side, policy, random) {
  const energyBefore = state.energy[side];
  const scored = attackCandidates(state, side).flatMap(({ payload, attack, target }) => {
    if (attack.mode === 'prepare') {
      if (policy !== 'tactical') return [];
      const chargeGain = Math.max(0, engine.RULES.charge - state.heroes[side][attack.heroId].charge);
      // Optimistic but bounded value for the next single-use charge. No arbitrary
      // forcing: a policy never prepares merely to inflate the mode-use counts.
      return [{ payload, score: energyValue(attack.energyAfter) - energyValue(energyBefore) + chargeGain * 0.9 }];
    }
    if (policy === 'strongest') return [{ payload, score: attack.damage * 1000 + (target.id === 'main' ? 100 : 0) - target.hp / 1000 }];
    const preview = engine.previewAttack(state, { ...payload, side });
    const block = Math.max(0, ...preview.possibleBlocks.filter((d) => d.available).map((d) => d.blocked));
    const hpLoss = Math.min(target.hp, Math.max(0, attack.damage - block));
    if (policy === 'immediate') return [{ payload, score: hpLoss + (target.id === 'main' ? 1000 : 0) - target.hp / 10000 }];
    let score = hpLoss * focusWeight(state, side, target)
      + energyValue(attack.energyAfter) - energyValue(energyBefore)
      - attack.chargeBonus * 0.45 - guardOpportunity(state, side, attack);
    if (hpLoss >= target.hp) score += target.id === 'main' ? 100000 : 20;
    if (policy === 'tactical' && attack.mode === 'disrupt' && hpLoss > 0) {
      const clearedCharge = preview.clearsPreparationOnHit.reduce((sum, id) => sum + state.heroes[other(side)][id].charge, 0);
      score += clearedCharge * 0.9 + preview.energyDrainOnHit * 6;
    }
    return [{ payload, score }];
  });
  return pick(scored, random, policy === 'strongest' || policy === 'immediate' ? 0.001 : 0.8);
}
function heuristicDefense(state, side, policy, random) {
  const candidates = engine.availableDefenses(state, side).filter((d) => d.available);
  if (policy === 'strongest' || policy === 'immediate') return pick(candidates.map((defense) => ({
    payload: { defenseId: defense.id }, score: engine.previewDefense(state, defense.id).blocked - defense.cost * 0.001,
  })), random);
  return pick(candidates.map((defense) => {
    const preview = engine.previewDefense(state, defense.id);
    const castle = state.castles[side].find((c) => c.id === state.pendingAttack.targetId);
    const hpLost = Math.min(castle.hp, preview.damage);
    const after = engine.applyDefense(state, side, { defenseId: defense.id });
    // Guarding exhausts this hero for the next attack, which is an actual cost.
    const attackBefore = engine.availableAttacks({ ...state, decisionIndex: { ...state.decisionIndex, [side]: state.decisionIndex[side] + 1 }, energy: { ...state.energy, [side]: Math.min(engine.RULES.energyCap, state.energy[side] + engine.RULES.attackRegen) } }, side).filter((a) => a.available && a.mode !== 'prepare');
    const attackAfter = engine.availableAttacks(after, side).filter((a) => a.available && a.mode !== 'prepare');
    const readinessCost = Math.max(0, Math.max(0, ...attackBefore.map((a) => a.damage)) - Math.max(0, ...attackAfter.map((a) => a.damage))) * 0.3;
    let score = -hpLost * (castle.id === 'main' ? 1.25 : 1)
      + energyValue(state.energy[side] - defense.cost) - energyValue(state.energy[side])
      - readinessCost - preview.chargeBonus * 0.45;
    if (hpLost >= castle.hp) score -= castle.id === 'main' ? 100000 : 20;
    if (policy === 'tactical' && state.pendingAttack.mode === 'disrupt' && hpLost > 0) {
      const charge = Object.values(state.heroes[side]).filter((h) => h.castleId === castle.id).reduce((sum, h) => sum + h.charge, 0);
      score -= charge * 0.9 + Math.min(1, state.energy[side] - defense.cost) * 6;
    }
    return { payload: { defenseId: defense.id }, score };
  }), random, 0.1);
}
const policies = Object.fromEntries(['strongest', 'immediate', 'reserve', 'tactical'].map((name) => [name, {
  attack: (state, side, random) => heuristicAttack(state, side, name, random),
  defense: (state, side, random) => heuristicDefense(state, side, name, random),
}]));
policies['engine-ai'] = {
  attack: (state, side, random) => engine.selectAttack(state, side, { random: random() }),
  defense: (state, side) => engine.selectDefense(state, side),
};
const pairings = args.find((a) => a.startsWith('--pair='))
  ? [args.find((a) => a.startsWith('--pair=')).slice(7).split(':')]
  : [['strongest', 'reserve'], ['immediate', 'reserve'], ['strongest', 'tactical'], ['immediate', 'tactical'], ['reserve', 'tactical'],
    ...(!args.includes('--no-ai') ? [['strongest', 'engine-ai'], ['immediate', 'engine-ai'], ['reserve', 'engine-ai'], ['tactical', 'engine-ai'], ['engine-ai', 'engine-ai']] : [])];
for (const pair of pairings) { assert.equal(pair.length, 2); for (const name of pair) assert(policies[name], `Unknown policy ${name}`); }
function freshStats() { return { attacks: 0, defenses: 0, modes: {}, attackEnergy: 0, defenseEnergy: 0, afterAttackEnergy: 0,
  beforeDefenseEnergy: 0, freeDefenses: 0, matchingDefenses: 0, preparedEnergy: 0, chargesConsumed: 0, preparationCleared: 0,
  energyDrained: 0, reserveChoices: 0, lowEnergyDefenses: 0, damage: 0, longestIdenticalAttackRun: 0, _lastAttack: null, _run: 0 }; }
function compactStats(s) {
  const { _lastAttack, _run, ...out } = s;
  return { ...out, averageEnergyAfterAttack: +(s.afterAttackEnergy / (s.attacks || 1)).toFixed(3),
    averageEnergyBeforeDefense: +(s.beforeDefenseEnergy / (s.defenses || 1)).toFixed(3),
    freeDefenseRate: +(s.freeDefenses / (s.defenses || 1)).toFixed(3) };
}
function canonical(state) {
  return JSON.stringify([state.phase, state.castles, state.energy, sides.map((side) => Object.values(state.heroes[side]).map((h) => [h.castleId, h.charge, Math.max(0, h.readyAt - state.decisionIndex[side]), h.retreatRounds])), state.pendingAttack]);
}
function match(seed, firstSide, training, playerPolicy, enemyPolicy) {
  let state = engine.createGame({ seed, firstSide, ...training });
  if (opening === '4v4') state = { ...state, energy: { player: 4, enemy: 4 } };
  assert.equal(state.energy[firstSide], opening === '4v4' ? 4 : 3, 'First-attacker opening energy does not match benchmark label');
  assert.equal(state.energy[other(firstSide)], 4, 'Second-attacker opening energy does not match benchmark label');
  assert.deepEqual(state.trainingBySide, training.trainingBySide, 'Scenario training tiers were not applied as labeled');
  const generators = { player: rng(seed * 2 + 11), enemy: rng(seed * 2 + 97) };
  const stats = { player: freshStats(), enemy: freshStats() };
  const policy = { player: policies[playerPolicy], enemy: policies[enemyPolicy] };
  const seen = new Map();
  let cycleDetected = false;
  let decisions = 0;
  while (!state.winner && state.round <= MAX_ROUNDS) {
    const side = state.phase.startsWith('player') ? 'player' : 'enemy';
    const attackPhase = state.phase.endsWith('Attack');
    const s = stats[side];
    if (attackPhase) {
      const key = canonical(state);
      seen.set(key, (seen.get(key) || 0) + 1);
      if (seen.get(key) >= 4) cycleDetected = true;
      const payload = policy[side].attack(state, side, generators[side]);
      const available = engine.availableAttacks(state, side).filter((a) => a.available);
      const action = available.find((a) => a.id === payload.attackId);
      assert(action, `Unavailable action from ${side} policy`);
      s.attacks += 1; s.modes[action.mode] = (s.modes[action.mode] || 0) + 1;
      s.attackEnergy += action.cost; s.afterAttackEnergy += action.energyAfter;
      s.chargesConsumed += Number(action.consumesCharge);
      const strongest = Math.max(...available.map((a) => a.damage));
      if (action.damage < strongest && action.energyAfter >= 2) s.reserveChoices += 1;
      s._run = s._lastAttack === action.id ? s._run + 1 : 1; s._lastAttack = action.id;
      s.longestIdenticalAttackRun = Math.max(s.longestIdenticalAttackRun, s._run);
      state = engine.applyAttack(state, side, payload);
      if (state.lastEvent?.kind === 'prepared') s.preparedEnergy += state.lastEvent.energyGained;
    } else {
      const payload = policy[side].defense(state, side, generators[side]);
      const defense = engine.availableDefenses(state, side).find((d) => d.id === payload.defenseId);
      assert(defense?.available, `Unavailable defense from ${side} policy`);
      s.defenses += 1; s.defenseEnergy += defense.cost; s.beforeDefenseEnergy += state.energy[side];
      s.lowEnergyDefenses += Number(state.energy[side] < 2); s.freeDefenses += Number(defense.cost === 0);
      s.matchingDefenses += Number(defense.matching); s.chargesConsumed += Number(defense.consumesCharge);
      const attacker = state.pendingAttack.side;
      state = engine.applyDefense(state, side, payload);
      stats[attacker].damage += state.lastEvent.hpLost;
      stats[attacker].preparationCleared += state.lastEvent.preparationCleared.length;
      stats[attacker].energyDrained += state.lastEvent.energyDrained;
    }
    decisions += 1;
    assert(decisions <= MAX_ROUNDS * 4 + 4, 'Decision count exceeded round-derived safety bound');
    for (const sideName of sides) assert(state.energy[sideName] >= 0 && state.energy[sideName] <= engine.RULES.energyCap);
  }
  return { winner: state.winner, rounds: Math.min(state.round, MAX_ROUNDS), stats, cycleDetected };
}
function addStats(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith('_')) continue;
    if (key === 'modes') for (const [mode, count] of Object.entries(value)) target.modes[mode] = (target.modes[mode] || 0) + count;
    else if (key === 'longestIdenticalAttackRun') target[key] = Math.max(target[key], value);
    else target[key] += value;
  }
}
console.log(JSON.stringify({ kind: 'metadata', engineSha256: createHash('sha256').update(readFileSync(new URL('../dist/engine.js', import.meta.url))).digest('hex'),
  scriptSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  seedCount, seeds: [1, seedCount], opening, openingEnergy: { firstAttacker: opening === '4v4' ? 4 : 3, secondAttacker: 4 },
  maxRounds: MAX_ROUNDS, rules: engine.RULES,
  actionCosts: Object.fromEntries(Object.values(engine.ATTACKS).map((a) => [a.id, a.cost])), training: trainingNames, pairings,
  notes: ['All actions pass through the public legal transitions.', 'Seeded near-tie choices do not represent independent human players.', 'No result proves a dominant strategy, optimal play, or human fun.', 'Training bonuses are persistent tier 0–3 under the current engine contract.'] }));
const aggregate = [];
for (const trainingName of trainingNames) for (const [playerPolicy, enemyPolicy] of pairings) for (const firstSide of sides) {
  const result = { kind: 'scenario', training: trainingName, playerPolicy, enemyPolicy, firstSide, matches: seedCount,
    playerWins: 0, enemyWins: 0, unfinished: 0, cycles: 0, totalRounds: 0, minRounds: Infinity, maxRounds: 0,
    stats: { player: freshStats(), enemy: freshStats() } };
  for (let seed = 1; seed <= seedCount; seed += 1) {
    const m = match(seed, firstSide, trainingSettings[trainingName], playerPolicy, enemyPolicy);
    result[m.winner === 'player' ? 'playerWins' : m.winner === 'enemy' ? 'enemyWins' : 'unfinished'] += 1;
    result.cycles += Number(m.cycleDetected); result.totalRounds += m.rounds;
    result.minRounds = Math.min(result.minRounds, m.rounds); result.maxRounds = Math.max(result.maxRounds, m.rounds);
    for (const side of sides) addStats(result.stats[side], m.stats[side]);
    if (!m.winner || m.cycleDetected) console.log(JSON.stringify({ kind: 'warning', seed, training: trainingName, playerPolicy, enemyPolicy, firstSide,
      message: !m.winner ? 'Unfinished after 200 full rounds; investigate possible stalling.' : 'An unchanged position repeated four times; investigate cycling.' }));
  }
  result.averageRounds = +(result.totalRounds / seedCount).toFixed(3);
  result.stats = Object.fromEntries(sides.map((side) => [side, compactStats(result.stats[side])]));
  console.log(JSON.stringify(result)); aggregate.push(result);
}
const total = aggregate.reduce((s, r) => ({ matches: s.matches + r.matches, unfinished: s.unfinished + r.unfinished, cycles: s.cycles + r.cycles }), { matches: 0, unfinished: 0, cycles: 0 });
console.log(JSON.stringify({ kind: 'summary', ...total,
  interpretation: 'Compare each initiative separately, then combine fair-training settings. Inspect mode use and conservation, not only win rate. Zero prepare/disrupt use is a tactical-value warning, not evidence those mechanics were successfully balanced.' }));
if (total.unfinished) process.exitCode = 1;
