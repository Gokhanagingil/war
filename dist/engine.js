/**
 * Kale Muhafızları v2: immutable, deterministic, JSON-serializable rules.
 * Energy belongs to a side; readiness and one preparation charge belong to a hero.
 * A decision index advances only when that side actually gets an attack/defense.
 */
const freezeMap = (entries) => Object.freeze(Object.fromEntries(Object.entries(entries)
  .map(([id, value]) => [id, Object.freeze({ id, ...value })])));
export const HEROES = freezeMap({
  kora: { name: 'Kora', title: 'Taş Muhafızı', castleId: 'left', type: 'stone', color: '#e6aa69', attack: 50, guard: 34 },
  ilda: { name: 'İlda', title: 'Ok Ustası', castleId: 'right', type: 'arrow', color: '#81c49b', attack: 42, guard: 30 },
  neris: { name: 'Neris', title: 'Yankı Koruyucusu', castleId: 'main', type: 'sound', color: '#a39ce5', attack: 46, guard: 32 },
});
export const RULES = Object.freeze({ energyCap: 6, startingEnergy: 4, firstAttackerEnergy: 3, attackRegen: 3, preparationGain: 2, charge: 18, localGuardBonus: 8 });
const attackNames = { kora: 'Kaya', ilda: 'Ok', neris: 'Yankı' };
const modeNames = { quick: 'Hızlı Vuruş', heavy: 'Ağır Darbe', disrupt: 'Bozucu Darbe', prepare: 'Hazırlan' };
export const ATTACKS = freezeMap(Object.fromEntries([
  ...Object.values(HEROES).flatMap((hero) => ['quick', 'heavy', 'disrupt', 'prepare'].map((mode) => [
    `${hero.id}:${mode}`, { heroId: hero.id, name: mode === 'prepare' ? `${hero.name}: Hazırlan` : `${attackNames[hero.id]} · ${modeNames[mode]}`,
      mode, type: hero.type, cost: { quick: 1, heavy: 4, disrupt: 2, prepare: 0 }[mode],
      damage: mode === 'prepare' ? 0 : hero.attack + ({ quick: 0, heavy: 26, disrupt: -16 }[mode]),
      fatigues: mode !== 'prepare', cooldown: 0 },
  ])),
  ['rally', { heroId: null, name: 'Temel Atış', mode: 'basic', type: 'rally', cost: 0, damage: 18, fatigues: false, cooldown: 0 }],
]));
export const DEFENSES = freezeMap({
  kora: { heroId: 'kora', name: 'Taş Siper', type: 'stone', cost: 2, block: 34, offTypeBlock: 0, fatigues: true, cooldown: 0 },
  ilda: { heroId: 'ilda', name: 'Rüzgâr Perdesi', type: 'arrow', cost: 2, block: 30, offTypeBlock: 0, fatigues: true, cooldown: 0 },
  neris: { heroId: 'neris', name: 'Sessizlik Çemberi', type: 'sound', cost: 2, block: 32, offTypeBlock: 0, fatigues: true, cooldown: 0 },
  brace: { heroId: null, name: 'Kalkanları Kaldır', type: 'universal', cost: 0, block: 12, offTypeBlock: 12, fatigues: false, cooldown: 0 },
});
const SIDES = ['player', 'enemy'];
const heroIds = Object.keys(HEROES);
const otherSide = (side) => side === 'player' ? 'enemy' : 'player';
const sideName = (side) => side === 'player' ? 'Sen' : 'Rakip';
const clone = (value) => JSON.parse(JSON.stringify(value));
const clampTraining = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(3, Math.trunc(Number(value)))) : 0;
function checkSide(side) { if (!SIDES.includes(side)) throw new RangeError(`Bilinmeyen taraf: ${side}`); }
function phaseFor(side, kind) { return side === 'player' ? `player${kind}` : `ai${kind}`; }
function assertPhase(state, expected) {
  if (!state || state.phase !== expected || state.winner) throw new Error(`Bu işlem ${expected} aşamasında yapılabilir.`);
}
function seedNumber(seed) {
  if (Number.isFinite(seed)) return (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
  const input = String(seed ?? 'kale-muhafizlari');
  let result = 2166136261;
  for (let i = 0; i < input.length; i += 1) result = Math.imul(result ^ input.charCodeAt(i), 16777619);
  return (result >>> 0) || 0x6d2b79f5;
}
function random(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function castleSet() { return [
  { id: 'left', name: 'Sol Kule', hp: 240, maxHp: 240 },
  { id: 'main', name: 'Ana Kale', hp: 420, maxHp: 420 },
  { id: 'right', name: 'Sağ Kule', hp: 240, maxHp: 240 },
]; }
function heroSet() { return Object.fromEntries(heroIds.map((id) => [id, {
  readyAt: 0, charge: 0, retreatRounds: 0, retreatUntilRound: 0, castleId: HEROES[id].castleId,
}])); }
function addLog(state, text) { state.log = [...state.log, text].slice(-10); }
function beginDecision(state, side, kind) {
  state.decisionIndex[side] += 1;
  state.phase = phaseFor(side, kind);
  if (kind === 'Attack') {
    if (state.attackCount[side] > 0) state.energy[side] = Math.min(RULES.energyCap, state.energy[side] + RULES.attackRegen);
    state.attackCount[side] += 1;
  }
}
/** Optional persistent development: Kora gains at most +3 on combat specials. */
export function createGame(options = {}) {
  const enabled = options.trainingEnabled !== false;
  const state = {
    version: 2, phase: 'playerAttack', round: 1, turnInRound: 0,
    seed: options.seed ?? 'kale-muhafizlari', rng: seedNumber(options.seed),
    firstSide: options.firstSide ?? 'player',
    castles: { player: castleSet(), enemy: castleSet() }, heroes: { player: heroSet(), enemy: heroSet() },
    energy: { player: RULES.startingEnergy, enemy: RULES.startingEnergy },
    decisionIndex: { player: 0, enemy: 0 }, attackCount: { player: 0, enemy: 0 },
    trainingEnabled: enabled,
    training: { enabled, power: enabled ? clampTraining(options.trainingBySide?.player ?? options.training?.power ?? options.training?.tier) : 0, defense: 0 },
    trainingBySide: { player: enabled ? clampTraining(options.trainingBySide?.player ?? options.training?.power ?? options.training?.tier) : 0,
      enemy: enabled ? clampTraining(options.trainingBySide?.enemy) : 0 },
    pendingAttack: null, lastEvent: null, lastDefense: null, winner: null,
    log: ['Düello başladı. Saldırı ve savunma aynı enerjiyi paylaşır. Ana kaleye ulaşmak için bir yan kuleyi yık.'],
  };
  if (state.firstSide === 'random') state.firstSide = random(state) < 0.5 ? 'player' : 'enemy';
  checkSide(state.firstSide);
  state.energy[state.firstSide] = RULES.firstAttackerEnergy;
  beginDecision(state, state.firstSide, 'Attack');
  return state;
}
export function legalTargets(state, attackerSide) {
  checkSide(attackerSide);
  if (state.phase === 'finished') return [];
  const castles = state.castles[otherSide(attackerSide)];
  const unlocked = castles.some((castle) => castle.id !== 'main' && castle.hp <= 0);
  return castles.filter((castle) => castle.hp > 0 && (castle.id !== 'main' || unlocked)).map((castle) => ({ ...castle }));
}
function unavailableReason(state, side, hero, cost) {
  if (hero?.retreatRounds > 0) return 'Ana kaleye çekiliyor; bir tam tur dinlenir.';
  if (hero && hero.readyAt > state.decisionIndex[side]) return 'Yorgun: sıradaki kendi kararında dinlenir.';
  if (state.energy[side] < cost) return `${cost} enerji gerekli; ${state.energy[side]} enerji var.`;
  if (state.winner) return 'Düello sona erdi.';
  return '';
}
export function availableAttacks(state, side) {
  checkSide(side);
  return Object.values(ATTACKS).map((action) => {
    const heroId = action.id === 'rally' ? heroIds.find((id) => state.heroes[side][id].retreatRounds === 0) ?? 'neris' : action.heroId;
    const hero = state.heroes[side][heroId];
    const reason = unavailableReason(state, side, action.id === 'rally' ? null : hero, action.cost);
    const combat = action.fatigues;
    const chargeBonus = combat ? hero.charge : 0;
    const trainingBonus = combat && heroId === 'kora' && state.training.enabled ? state.trainingBySide[side] : 0;
    return { ...action, heroId, baseDamage: action.damage, damage: action.damage + chargeBonus + trainingBonus,
      bonus: chargeBonus + trainingBonus, chargeBonus, trainingBonus, consumesCharge: combat && hero.charge > 0,
      energyAfter: action.mode === 'prepare' ? Math.min(6, state.energy[side] + 2) : state.energy[side] - action.cost,
      remainingCooldown: action.id === 'rally' ? 0 : Math.max(0, hero.readyAt - state.decisionIndex[side]),
      available: !reason, reason };
  });
}
export function availableDefenses(state, side) {
  checkSide(side);
  const incoming = state.pendingAttack?.side !== side ? state.pendingAttack : null;
  return Object.values(DEFENSES).map((action) => {
    const hero = action.heroId ? state.heroes[side][action.heroId] : null;
    const reason = unavailableReason(state, side, hero, action.cost);
    const matching = Boolean(incoming && incoming.type === action.type);
    const localBonus = hero && incoming && hero.castleId === incoming.targetId ? 8 : 0;
    const chargeBonus = hero?.charge ?? 0;
    return { ...action, baseBlock: action.block, block: action.block + localBonus + chargeBonus,
      localBonus, chargeBonus, bonus: localBonus + chargeBonus, matching,
      consumesCharge: matching && chargeBonus > 0,
      remainingCooldown: hero ? Math.max(0, hero.readyAt - state.decisionIndex[side]) : 0,
      available: !reason, reason };
  });
}
function defenseEffect(attack, defense) {
  const effective = defense.type === attack.type;
  const capacity = effective || defense.id === 'brace' ? defense.block : 0;
  const blocked = Math.min(attack.damage, capacity);
  return { incoming: attack.damage, blocked, damage: Math.max(0, attack.damage - blocked), effective,
    label: effective ? 'Tür eşleşmesi! Kahraman güçlü koruma sağladı.' : defense.id === 'brace'
      ? 'Ücretsiz siper: her saldırıda 12 koruma.' : 'Tür eşleşmedi: 0 koruma, 2 enerji gider ve kahraman yorulur.' };
}
export function previewDefense(state, defenseId) {
  if (!DEFENSES[defenseId]) throw new RangeError(`Bilinmeyen savunma: ${defenseId}`);
  if (!state.pendingAttack) return { incoming: 0, blocked: 0, damage: 0, effective: false, available: false, label: 'Bekleyen saldırı yok.' };
  const side = otherSide(state.pendingAttack.side);
  const defense = availableDefenses(state, side).find((entry) => entry.id === defenseId);
  const effect = defenseEffect(state.pendingAttack, defense);
  const castle = state.castles[side].find((entry) => entry.id === state.pendingAttack.targetId);
  const hpLost = Math.min(castle?.hp ?? 0, effect.damage);
  const disrupts = state.pendingAttack.mode === 'disrupt' && hpLost > 0;
  const afterCost = Math.max(0, state.energy[side] - defense.cost);
  const energyDrained = disrupts ? Math.min(1, afterCost) : 0;
  return { ...effect, hpLost, available: defense.available, reason: defense.reason,
    cost: defense.cost, energyAfter: afterCost - energyDrained, energyDrained, energyDrain: energyDrained, localBonus: defense.localBonus,
    preparationCleared: disrupts ? heroIds.filter((id) => state.heroes[side][id].castleId === state.pendingAttack.targetId
      && state.heroes[side][id].charge > 0 && !(defense.heroId === id && defense.consumesCharge)) : [],
    chargeBonus: defense.matching ? defense.chargeBonus : 0, chargeConsumed: defense.consumesCharge,
    fatigue: defense.fatigues, heroId: defense.heroId };
}
/** Prospective defenses use the next real defense decision, including refreshed readiness. */
export function previewAttack(state, { attackId, targetId, side } = {}) {
  side ??= state.phase === 'aiAttack' ? 'enemy' : 'player';
  checkSide(side);
  const action = availableAttacks(state, side).find((entry) => entry.id === attackId);
  if (!action) throw new RangeError(`Bilinmeyen saldırı: ${attackId}`);
  const targetAvailable = action.mode === 'prepare' || legalTargets(state, side).some((target) => target.id === targetId);
  const possibleBlocks = [];
  if (action.mode !== 'prepare' && targetAvailable) {
    const future = clone(state);
    future.pendingAttack = { ...action, attackId, targetId, side };
    future.decisionIndex[otherSide(side)] += 1;
    for (const defense of availableDefenses(future, otherSide(side))) {
      possibleBlocks.push({ defenseId: defense.id, name: defense.name, ...previewDefense(future, defense.id) });
    }
  }
  const defenderSide = otherSide(side);
  return { ...action, targetId: action.mode === 'prepare' ? null : targetId,
    available: action.available && targetAvailable, reason: action.reason || (!targetAvailable ? 'Bu kale şu anda hedef alınamaz.' : ''),
    fatigue: action.fatigues, possibleBlocks,
    clearsPreparationOnHit: action.mode === 'disrupt' ? heroIds.filter((id) => state.heroes[defenderSide][id].castleId === targetId && state.heroes[defenderSide][id].charge > 0) : [],
    energyDrainOnHit: action.mode === 'disrupt' ? Math.min(1, state.energy[defenderSide]) : 0,
  };
}
function finishAttackTurn(state, attackingSide) {
  state.turnInRound += 1;
  if (state.turnInRound === 2) {
    state.turnInRound = 0;
    state.round += 1;
    for (const side of SIDES) for (const id of heroIds) {
      const hero = state.heroes[side][id];
      if (hero.retreatRounds && state.round >= hero.retreatUntilRound) {
        hero.retreatRounds = 0;
        addLog(state, `${sideName(side)}: ${HEROES[id].name} ana kalede yeniden hazır.`);
      }
    }
  }
  beginDecision(state, otherSide(attackingSide), 'Attack');
}
export function applyAttack(state, side, { attackId, targetId } = {}) {
  checkSide(side);
  assertPhase(state, phaseFor(side, 'Attack'));
  const action = availableAttacks(state, side).find((entry) => entry.id === attackId);
  if (!action) throw new RangeError(`Bilinmeyen saldırı: ${attackId}`);
  if (!action.available) throw new Error(`${action.name}: ${action.reason}`);
  if (action.mode !== 'prepare' && !legalTargets(state, side).some((target) => target.id === targetId)) throw new Error('Bu kale şu anda hedef alınamaz.');
  const next = clone(state);
  const hero = next.heroes[side][action.heroId];
  next.lastDefense = null;
  next.energy[side] = action.energyAfter;
  if (action.mode === 'prepare') {
    hero.charge = 18;
    next.pendingAttack = null;
    next.lastEvent = { kind: 'prepared', round: next.round, attackerSide: side, heroId: action.heroId, mode: 'prepare', attackId,
      targetId: null, damage: 0, hpLost: 0, blocked: 0, energyGained: next.energy[side] - state.energy[side], charge: 18, castleFell: false, winner: null };
    addLog(next, `${sideName(side)}: ${HEROES[action.heroId].name} hazırlandı; +${next.lastEvent.energyGained} enerji, tek kullanımlık +18 güç. Bu saldırıdan vazgeçildi.`);
    finishAttackTurn(next, side);
    return next;
  }
  if (action.fatigues) {
    hero.readyAt = next.decisionIndex[side] + 2;
    hero.charge = 0;
  }
  next.pendingAttack = { side, heroId: action.heroId, attackId, mode: action.mode, type: action.type, targetId,
    damage: action.damage, baseDamage: action.baseDamage, chargeBonus: action.chargeBonus, trainingBonus: action.trainingBonus,
    cost: action.cost, label: `${HEROES[action.heroId].name}: ${action.name}` };
  next.lastEvent = { kind: 'attackDeclared', round: next.round, attackerSide: side, heroId: action.heroId, mode: action.mode,
    targetId, damage: 0, incomingDamage: action.damage, baseDamage: action.baseDamage, chargeBonus: action.chargeBonus, trainingBonus: action.trainingBonus,
    hpLost: 0, blocked: 0, attackId, defenseId: null, castleFell: false, winner: null };
  beginDecision(next, otherSide(side), 'Defense');
  return next;
}
export function playerAttack(state, payload) { return applyAttack(state, 'player', payload); }
export function applyDefense(state, side, { defenseId } = {}) {
  checkSide(side);
  assertPhase(state, phaseFor(side, 'Defense'));
  const attack = state.pendingAttack;
  if (!attack || attack.side !== otherSide(side)) throw new Error('Savunulacak saldırı bulunamadı.');
  const defense = availableDefenses(state, side).find((entry) => entry.id === defenseId);
  if (!defense) throw new RangeError(`Bilinmeyen savunma: ${defenseId}`);
  if (!defense.available) throw new Error(`${defense.name}: ${defense.reason}`);
  const next = clone(state);
  next.energy[side] -= defense.cost;
  if (defense.heroId) {
    const hero = next.heroes[side][defense.heroId];
    hero.readyAt = next.decisionIndex[side] + 2;
    if (defense.consumesCharge) hero.charge = 0;
  }
  const effect = defenseEffect(attack, defense);
  const castle = next.castles[side].find((entry) => entry.id === attack.targetId);
  const hpBefore = castle.hp;
  castle.hp = Math.max(0, hpBefore - effect.damage);
  const hpLost = hpBefore - castle.hp;
  const castleFell = hpBefore > 0 && castle.hp === 0;
  let energyDrained = 0;
  const preparationCleared = [];
  if (attack.mode === 'disrupt' && hpLost > 0) {
    energyDrained = Math.min(1, next.energy[side]);
    next.energy[side] -= energyDrained;
    for (const id of heroIds) if (next.heroes[side][id].castleId === attack.targetId && next.heroes[side][id].charge > 0) {
      next.heroes[side][id].charge = 0;
      preparationCleared.push(id);
    }
  }
  next.lastDefense = { ...defense, ...effect };
  next.lastEvent = { kind: 'attackResolved', round: next.round, attackerSide: attack.side, heroId: attack.heroId,
    mode: attack.mode, targetId: attack.targetId, damage: effect.damage, incomingDamage: attack.damage, baseDamage: attack.baseDamage,
    chargeBonus: attack.chargeBonus, trainingBonus: attack.trainingBonus, hpLost, blocked: effect.blocked,
    attackId: attack.attackId, defenseId, defendingHeroId: defense.heroId, effective: effect.effective,
    energyDrained, preparationCleared, castleFell, winner: null };
  const bonusText = attack.chargeBonus || attack.trainingBonus ? ` (${attack.baseDamage} temel${attack.chargeBonus ? ` +${attack.chargeBonus} hazırlık` : ''}${attack.trainingBonus ? ` +${attack.trainingBonus} gelişim` : ''})` : '';
  addLog(next, `${sideName(attack.side)}: ${attack.label}${bonusText} → ${castle.name}, ${hpLost} hasar. ${defense.name} ${effect.blocked} engelledi.${energyDrained || preparationCleared.length ? ` Hazırlık bozuldu; ${energyDrained} enerji silindi.` : ''}`);
  if (castleFell && castle.id !== 'main') {
    const heroId = heroIds.find((id) => HEROES[id].castleId === castle.id);
    const hero = next.heroes[side][heroId];
    hero.castleId = 'main';
    hero.retreatRounds = 1;
    hero.retreatUntilRound = next.round + 2;
    addLog(next, `${sideName(side)}: ${castle.name} yıkıldı. ${HEROES[heroId].name} ana kaleye çekiliyor; bir tam tur sonra döner.`);
  }
  next.pendingAttack = null;
  if (castleFell && castle.id === 'main') {
    next.winner = attack.side;
    next.phase = 'finished';
    next.lastEvent.winner = attack.side;
    addLog(next, attack.side === 'player' ? 'Zafer! Rakibin ana kalesi düştü.' : 'Ana kalen düştü. Rövanş seni bekliyor.');
  } else finishAttackTurn(next, attack.side);
  return next;
}
export function playerDefend(state, payload) { return applyDefense(state, 'player', payload); }

// The AI evaluates the same public state and uses the same transitions as a player.
// No hidden bonus, income, immunity, access to future inputs, or ambient randomness.
function objectiveHealth(state, side) {
  const castles = state.castles[side];
  const main = castles.find((castle) => castle.id === 'main');
  const wings = castles.filter((castle) => castle.id !== 'main');
  return main.hp * 1.2 + Math.min(...wings.map((castle) => castle.hp));
}
function resourceValue(state, side) {
  const energy = state.energy[side];
  return Math.min(energy, 3) * 7 + Math.max(0, energy - 3) * 4
    + heroIds.reduce((sum, id) => sum + state.heroes[side][id].charge * 0.65
      - (state.heroes[side][id].retreatRounds ? 7 : 0), 0);
}
function positionValue(state, side) {
  if (state.winner) return state.winner === side ? 100000 : -100000;
  const other = otherSide(side);
  return objectiveHealth(state, side) - objectiveHealth(state, other)
    + resourceValue(state, side) - resourceValue(state, other);
}
function attackOptions(state, side) {
  const targets = legalTargets(state, side);
  return availableAttacks(state, side).filter((attack) => attack.available).flatMap((attack) => attack.mode === 'prepare'
    ? [{ attackId: attack.id, targetId: null }] : targets.map((target) => ({ attackId: attack.id, targetId: target.id })));
}
function defensiveCandidates(state, side) {
  return availableDefenses(state, side).filter((defense) => defense.available && (defense.id === 'brace' || defense.type === state.pendingAttack.type));
}
function nextAttackPotential(state, side) {
  if (state.winner || state.phase !== phaseFor(side, 'Attack')) return 0;
  const other = otherSide(side);
  const targets = legalTargets(state, side);
  let best = 0;
  for (const attack of availableAttacks(state, side)) {
    if (!attack.available || attack.mode === 'prepare') continue;
    const guardId = heroIds.find((id) => HEROES[id].type === attack.type);
    const guard = guardId ? state.heroes[other][guardId] : null;
    const canGuard = guard && !guard.retreatRounds && guard.readyAt <= state.decisionIndex[other] + 1 && state.energy[other] >= 2;
    for (const target of targets) {
      const guardBlock = canGuard ? HEROES[guardId].guard + guard.charge + (guard.castleId === target.id ? 8 : 0) : 0;
      const hpLoss = Math.min(target.hp, Math.max(0, attack.damage - Math.max(12, guardBlock)));
      const value = hpLoss * (target.id === 'main' ? 1.2 : 1) - attack.cost * 5 - attack.chargeBonus * 0.5;
      best = Math.max(best, value);
    }
  }
  return best;
}
function bestDefenseChoice(state, side) {
  let best = null;
  for (const defense of defensiveCandidates(state, side)) {
    const after = applyDefense(state, side, { defenseId: defense.id });
    const score = positionValue(after, side) + nextAttackPotential(after, side) * 0.35;
    if (!best || score > best.score) best = { defenseId: defense.id, score, after };
  }
  return best;
}
/** A read-only, side-symmetric resource-aware policy; useful for reproducible probes. */
export function selectDefense(state, side = state.phase === 'aiDefense' ? 'enemy' : 'player') {
  checkSide(side);
  assertPhase(state, phaseFor(side, 'Defense'));
  return { defenseId: bestDefenseChoice(state, side).defenseId };
}
function attackOutcome(state, side, payload) {
  const declared = applyAttack(state, side, payload);
  return declared.pendingAttack ? bestDefenseChoice(declared, otherSide(side)).after : declared;
}
function quickAttackRanking(state, side) {
  return attackOptions(state, side).map((payload) => {
    const after = attackOutcome(state, side, payload);
    return { payload, after, score: positionValue(after, side) };
  }).sort((a, b) => b.score - a.score);
}
export function selectAttack(state, side = state.phase === 'aiAttack' ? 'enemy' : 'player', options = {}) {
  checkSide(side);
  assertPhase(state, phaseFor(side, 'Attack'));
  const candidates = quickAttackRanking(state, side);
  const beam = candidates.slice(0, 5);
  // One opposing return attack exposes overspending and guard/attack readiness costs.
  for (const candidate of beam) {
    if (!candidate.after.winner) {
      const reply = quickAttackRanking(candidate.after, otherSide(side))[0];
      candidate.score = positionValue(candidate.after, side) * 0.3 + positionValue(reply.after, side) * 0.7;
    }
  }
  const sorted = beam.sort((a, b) => b.score - a.score);
  // Only near-equivalent plans are varied. The caller advances its own saved RNG.
  const tied = sorted.filter((candidate) => candidate.score >= sorted[0].score - 1.5);
  const index = Math.min(tied.length - 1, Math.floor((options.random ?? 0) * tied.length));
  return { ...tied[index].payload };
}
export function resolveAiDefense(state) {
  assertPhase(state, 'aiDefense');
  return applyDefense(state, 'enemy', selectDefense(state, 'enemy'));
}
export function chooseAiAttack(state) {
  assertPhase(state, 'aiAttack');
  const next = clone(state);
  return applyAttack(next, 'enemy', selectAttack(next, 'enemy', { random: random(next) }));
}
export function describeState(state) {
  if (state.phase === 'finished') return state.winner === 'player' ? 'Zafer senin!' : 'Rakip kazandı.';
  const phases = { playerAttack: 'Saldır, hazırlan veya enerjini sakla.', aiDefense: 'Rakip savunmasını seçiyor.', aiAttack: 'Rakip saldırısını seçiyor.', playerDefense: 'Enerjini ve hazır kahramanlarını düşünerek savun.' };
  return `${state.round}. tur · ${phases[state.phase]} Enerjin: ${state.energy.player}/6.`;
}
