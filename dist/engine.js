/**
 * Kale Muhafızları: dependency-free, deterministic, immutable battle engine.
 * One round contains one attack from each side. Cooldowns tick at round end.
 * A cooldown of 2 therefore requires one intervening round before reuse.
 */

const freezeMap = (entries) => Object.freeze(Object.fromEntries(
  Object.entries(entries).map(([id, value]) => [id, Object.freeze({ id, ...value })]),
));

export const HEROES = freezeMap({
  kora: { name: 'Kora', title: 'Taş Muhafızı', castleId: 'left', type: 'stone', color: '#e6aa69' },
  ilda: { name: 'İlda', title: 'Ok Ustası', castleId: 'right', type: 'arrow', color: '#81c49b' },
  neris: { name: 'Neris', title: 'Yankı Koruyucusu', castleId: 'main', type: 'sound', color: '#a39ce5' },
});

export const ATTACKS = freezeMap({
  kora: { heroId: 'kora', name: 'Kaya Savuruşu', type: 'stone', damage: 80, cooldown: 2 },
  ilda: { heroId: 'ilda', name: 'Çelik Yağmuru', type: 'arrow', damage: 64, cooldown: 2 },
  neris: { heroId: 'neris', name: 'Yankı Darbesi', type: 'sound', damage: 72, cooldown: 2 },
  rally: { heroId: null, name: 'Temel Atış', type: 'rally', damage: 28, cooldown: 0 },
});

export const DEFENSES = freezeMap({
  kora: { heroId: 'kora', name: 'Taş Siper', type: 'stone', block: 50, offTypeBlock: 0, cooldown: 2 },
  ilda: { heroId: 'ilda', name: 'Rüzgâr Perdesi', type: 'arrow', block: 42, offTypeBlock: 0, cooldown: 2 },
  neris: { heroId: 'neris', name: 'Sessizlik Çemberi', type: 'sound', block: 46, offTypeBlock: 0, cooldown: 2 },
  brace: { heroId: null, name: 'Kalkanları Kaldır', type: 'universal', block: 12, offTypeBlock: 12, cooldown: 0 },
});

const SIDES = ['player', 'enemy'];
const otherSide = (side) => side === 'player' ? 'enemy' : 'player';
const heroIds = Object.keys(HEROES);
const sideName = (side) => side === 'player' ? 'Sen' : 'Rakip';
const clone = (value) => JSON.parse(JSON.stringify(value));
const clampTraining = (value) => Number.isFinite(Number(value))
  ? Math.max(0, Math.min(3, Math.trunc(Number(value)))) : 0;

function checkSide(side) {
  if (!SIDES.includes(side)) throw new RangeError(`Bilinmeyen taraf: ${side}`);
}

function assertPhase(state, expected) {
  if (!state || state.phase !== expected || state.winner) {
    throw new Error(`Bu işlem ${expected} aşamasında yapılabilir.`);
  }
}

function seedNumber(seed) {
  if (Number.isFinite(seed)) return (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
  const input = String(seed ?? 'kale-muhafizlari');
  let result = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    result = Math.imul(result ^ input.charCodeAt(i), 16777619);
  }
  return (result >>> 0) || 0x6d2b79f5;
}

// Mulberry32 advances only on the returned state; no ambient randomness is used.
function random(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function castleSet() {
  return [
    { id: 'left', name: 'Sol Kule', hp: 240, maxHp: 240 },
    { id: 'main', name: 'Ana Kale', hp: 420, maxHp: 420 },
    { id: 'right', name: 'Sağ Kule', hp: 240, maxHp: 240 },
  ];
}

function heroSet() {
  return Object.fromEntries(heroIds.map((id) => [id, {
    attackCd: 0, defenseCd: 0, retreatRounds: 0, retreatUntilRound: 0,
    castleId: HEROES[id].castleId,
  }]));
}

/** Training is optional, bounded and player-only; disabling it gives identical base stats. */
export function createGame(options = {}) {
  const enabled = options.trainingEnabled !== false;
  return {
    version: 1, phase: 'playerAttack', round: 1,
    seed: options.seed ?? 'kale-muhafizlari', rng: seedNumber(options.seed),
    castles: { player: castleSet(), enemy: castleSet() },
    heroes: { player: heroSet(), enemy: heroSet() },
    trainingEnabled: enabled,
    training: {
      enabled,
      power: enabled ? clampTraining(options.training?.power) : 0,
      defense: enabled ? clampTraining(options.training?.defense) : 0,
    },
    pendingAttack: null, lastEvent: null, lastDefense: null, winner: null,
    log: ['Düello başladı. Ana kaleye ulaşmak için bir yan kuleyi yık.'],
  };
}

/** A main castle becomes targetable when either of its own side castles falls. */
export function legalTargets(state, attackerSide) {
  checkSide(attackerSide);
  if (state.phase === 'finished') return [];
  const castles = state.castles[otherSide(attackerSide)];
  const mainUnlocked = castles.some((castle) => castle.id !== 'main' && castle.hp <= 0);
  return castles.filter((castle) => castle.hp > 0 && (castle.id !== 'main' || mainUnlocked))
    .map((castle) => ({ ...castle }));
}

function unavailableReason(hero, cooldown) {
  if (hero.retreatRounds > 0) return 'Ana kaleye çekiliyor; 1 tam tur dinlenir.';
  if (cooldown > 0) return `${cooldown} tur bekleme`;
  return '';
}

export function availableAttacks(state, side) {
  checkSide(side);
  return Object.values(ATTACKS).map((action) => {
    const hero = action.heroId ? state.heroes[side][action.heroId] : null;
    const reason = hero ? unavailableReason(hero, hero.attackCd) : '';
    const bonus = side === 'player' && action.heroId === 'kora' ? state.training.power * 3 : 0;
    // A basic attack is still performed by a hero, without consuming or resetting
    // that hero's special cooldown. Neris remains active while the main is alive.
    const actingHeroId = action.id === 'rally'
      ? heroIds.find((id) => state.heroes[side][id].retreatRounds === 0) ?? 'neris' : action.heroId;
    return { ...action, heroId: actingHeroId, damage: action.damage + bonus, bonus,
      remainingCooldown: hero?.attackCd ?? 0, available: !reason, reason };
  });
}

export function availableDefenses(state, side) {
  checkSide(side);
  return Object.values(DEFENSES).map((action) => {
    const hero = action.heroId ? state.heroes[side][action.heroId] : null;
    const reason = hero ? unavailableReason(hero, hero.defenseCd) : '';
    const bonus = side === 'player' && action.heroId === 'kora' ? state.training.defense * 3 : 0;
    return { ...action, block: action.block + bonus, bonus,
      remainingCooldown: hero?.defenseCd ?? 0, available: !reason, reason };
  });
}

function defenseEffect(attack, defense) {
  const effective = defense.type === attack.type;
  const capacity = effective || defense.id === 'brace' ? defense.block : defense.offTypeBlock;
  const blocked = Math.min(attack.damage, capacity);
  return {
    incoming: attack.damage, blocked, damage: Math.max(0, attack.damage - blocked), effective,
    label: effective ? 'Tür eşleşmesi! Güçlü savunma.'
      : defense.id === 'brace' ? 'Her saldırıya karşı temel koruma.' : 'Tür eşleşmedi; savunma başarısız, 0 hasar engellenir.',
  };
}

/** Previews are read-only and can also describe currently unavailable defenses. */
export function previewDefense(state, defenseId) {
  if (!DEFENSES[defenseId]) throw new RangeError(`Bilinmeyen savunma: ${defenseId}`);
  if (!state.pendingAttack) return { incoming: 0, blocked: 0, damage: 0, effective: false, label: 'Bekleyen saldırı yok.' };
  const side = otherSide(state.pendingAttack.side);
  const defense = availableDefenses(state, side).find((action) => action.id === defenseId);
  return { ...defenseEffect(state.pendingAttack, defense), available: defense.available };
}

function declareAttack(state, side, attackId, targetId) {
  const action = availableAttacks(state, side).find((entry) => entry.id === attackId);
  if (!action) throw new RangeError(`Bilinmeyen saldırı: ${attackId}`);
  if (!action.available) throw new Error(`${action.name}: ${action.reason}`);
  if (!legalTargets(state, side).some((castle) => castle.id === targetId)) {
    throw new Error('Bu kale şu anda hedef alınamaz.');
  }
  if (action.heroId && action.id !== 'rally') state.heroes[side][action.heroId].attackCd = action.cooldown;
  state.pendingAttack = {
    side, heroId: action.heroId, attackId, type: action.type,
    targetId, damage: action.damage,
    label: action.id === 'rally' ? `${HEROES[action.heroId].name}: ${action.name}` : action.name,
  };
  state.lastDefense = null;
  state.lastEvent = {
    kind: 'attackDeclared', attackerSide: side, targetId,
    damage: 0, blocked: 0, attackId, defenseId: null, castleFell: false, winner: null,
  };
  state.phase = side === 'player' ? 'aiDefense' : 'playerDefense';
}

export function playerAttack(state, { attackId, targetId } = {}) {
  assertPhase(state, 'playerAttack');
  const next = clone(state);
  declareAttack(next, 'player', attackId, targetId);
  return next;
}

function addLog(state, text) {
  state.log = [...state.log, text].slice(-8);
}

function resolveAttack(state, defenseId) {
  const attack = state.pendingAttack;
  const defenderSide = otherSide(attack.side);
  const defense = availableDefenses(state, defenderSide).find((entry) => entry.id === defenseId);
  if (!defense) throw new RangeError(`Bilinmeyen savunma: ${defenseId}`);
  if (!defense.available) throw new Error(`${defense.name}: ${defense.reason}`);
  if (defense.heroId) state.heroes[defenderSide][defense.heroId].defenseCd = defense.cooldown;
  const effect = defenseEffect(attack, defense);
  const castle = state.castles[defenderSide].find((entry) => entry.id === attack.targetId);
  const hpBefore = castle.hp;
  castle.hp = Math.max(0, castle.hp - effect.damage);
  const castleFell = hpBefore > 0 && castle.hp === 0;
  state.lastDefense = { ...defense, ...effect };
  state.lastEvent = {
    kind: 'attackResolved', round: state.round, attackerSide: attack.side,
    targetId: attack.targetId, damage: effect.damage, hpLost: hpBefore - castle.hp,
    blocked: effect.blocked, attackId: attack.attackId, defenseId,
    effective: effect.effective, castleFell, winner: null,
  };
  addLog(state, `${sideName(attack.side)}: ${attack.label} → ${castle.name}, ${effect.damage} hasar. ${defense.name} ${effect.blocked} engelledi.`);
  if (castleFell && castle.id !== 'main') {
    const heroId = heroIds.find((id) => HEROES[id].castleId === castle.id);
    const hero = state.heroes[defenderSide][heroId];
    hero.castleId = 'main';
    hero.retreatRounds = 1;
    // The rest of this round plus the following full round are spent retreating.
    hero.retreatUntilRound = state.round + 2;
    addLog(state, `${sideName(defenderSide)}: ${castle.name} yıkıldı. ${HEROES[heroId].name} ana kaleye çekiliyor; 1 tam tur sonra döner.`);
  }
  if (castleFell && castle.id === 'main') {
    state.winner = attack.side;
    state.phase = 'finished';
    state.lastEvent.winner = attack.side;
    addLog(state, attack.side === 'player' ? 'Zafer! Rakibin ana kalesi düştü.' : 'Ana kalen düştü. Rövanş seni bekliyor.');
  }
  state.pendingAttack = null;
}

export function resolveAiDefense(state) {
  assertPhase(state, 'aiDefense');
  const next = clone(state);
  const incoming = next.pendingAttack;
  const candidates = availableDefenses(next, 'enemy').filter((entry) => entry.available);
  let selected = null;
  let bestScore = -Infinity;
  for (const defense of candidates) {
    const effect = defenseEffect(incoming, defense);
    // Preserve a hero for later unless it blocks materially more than the free brace.
    const score = effect.blocked - defense.cooldown * 2 + random(next) * 1.5;
    if (score > bestScore) { selected = defense; bestScore = score; }
  }
  resolveAttack(next, selected.id);
  if (!next.winner) next.phase = 'aiAttack';
  return next;
}

export function chooseAiAttack(state) {
  assertPhase(state, 'aiAttack');
  const next = clone(state);
  const attacks = availableAttacks(next, 'enemy').filter((entry) => entry.available);
  const targets = legalTargets(next, 'enemy');
  const defenses = availableDefenses(next, 'player').filter((entry) => entry.available);
  let selected = null;
  let bestScore = -Infinity;
  for (const attack of attacks) {
    // Only public readiness and castle health are considered. No player choice is read.
    const bestBlock = Math.max(...defenses.map((defense) => defenseEffect(attack, defense).blocked));
    const expectedDamage = attack.damage - bestBlock;
    for (const target of targets) {
      const mainPriority = target.id === 'main' ? 500 : 0;
      const finishBonus = expectedDamage >= target.hp ? (target.id === 'main' ? 1000 : 70) : 0;
      // Prefer finishing an exposed damaged castle; once unlocked, the main castle wins priority.
      const focusBonus = (1 - target.hp / target.maxHp) * 160;
      const score = expectedDamage * 0.8 + attack.damage * 0.2 + mainPriority
        + finishBonus + focusBonus + random(next) * 18;
      if (score > bestScore) { selected = { attack, target }; bestScore = score; }
    }
  }
  if (!selected) throw new Error('Rakip için geçerli saldırı bulunamadı.');
  declareAttack(next, 'enemy', selected.attack.id, selected.target.id);
  return next;
}

function nextRound(state) {
  state.round += 1;
  for (const side of SIDES) {
    for (const id of heroIds) {
      const hero = state.heroes[side][id];
      hero.attackCd = Math.max(0, hero.attackCd - 1);
      hero.defenseCd = Math.max(0, hero.defenseCd - 1);
      if (hero.retreatRounds && state.round >= hero.retreatUntilRound) {
        hero.retreatRounds = 0;
        addLog(state, `${sideName(side)}: ${HEROES[id].name} ana kalede yeniden hazır.`);
      }
    }
  }
  state.phase = 'playerAttack';
}

export function playerDefend(state, { defenseId } = {}) {
  assertPhase(state, 'playerDefense');
  const next = clone(state);
  resolveAttack(next, defenseId);
  if (!next.winner) nextRound(next);
  return next;
}

export function describeState(state) {
  if (state.phase === 'finished') return state.winner === 'player' ? 'Zafer senin!' : 'Rakip kazandı.';
  const phases = {
    playerAttack: 'Saldırını ve hedefini seç.', aiDefense: 'Rakip savunmasını hazırlıyor.',
    aiAttack: 'Rakip saldırısını hazırlıyor.', playerDefense: 'Gelen saldırıya karşı savunmanı seç.',
  };
  return `${state.round}. tur · ${phases[state.phase]}`;
}
