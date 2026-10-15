/** Kale Muhafızları v3. Pure deterministic transitions; five public circulating orders. */
const frozenMap = (values) => Object.freeze(Object.fromEntries(Object.entries(values).map(([id, value]) => [id, Object.freeze({ id, ...value })])));
export const HEROES = frozenMap({
  kora: { name: 'Kora', title: 'Taş Muhafızı', castleId: 'left', type: 'stone', color: '#e6aa69' },
  ilda: { name: 'İlda', title: 'Ok Ustası', castleId: 'right', type: 'arrow', color: '#81c49b' },
  neris: { name: 'Neris', title: 'Yankı Koruyucusu', castleId: 'main', type: 'sound', color: '#a39ce5' },
});
export const RULES = Object.freeze({ sideHp: 90, mainHp: 150, nativeBonus: 3, trainingCap: 3, typedGuard: 22, localGuardBonus: 4, braceBlock: 8, bannerCover: 12, mistPierce: 8, catapultRepeat: 18 });
export const ORDERS = frozenMap({
  volley: { name: 'Ok Yağmuru', shortName: 'Ok', type: 'arrow', damage: 30, guardType: 'stone', guardBlock: 22, block: 22, rule: 'Taş saldırısını savunur. Saldırıda 30 hasar.', ruleText: '30 ok hasarı · Taşa karşı 22 savunma' },
  ram: { name: 'Koçbaşı', shortName: 'Koçbaşı', type: 'steel', damage: 38, guardType: 'sound', guardBlock: 22, block: 22, rule: 'Yankı saldırısını savunur. Saldırıda 38 hasar.', ruleText: '38 çelik hasarı · Yankıya karşı 22 savunma' },
  catapult: { name: 'Mancınık', shortName: 'Mancınık', type: 'stone', damage: 22, guardType: 'arrow', guardBlock: 22, block: 22, rule: 'Son kendi saldırınla aynı hedefe +18 hasar. Ok saldırısını savunur.', ruleText: '22 taş hasarı; aynı önceki hedefe +18 · Oka karşı 22 savunma' },
  mist: { name: 'Yankı Sisi', shortName: 'Sis', type: 'sound', damage: 24, guardType: 'steel', guardBlock: 22, block: 22, rule: 'Toplam savunmanın ilk 8 puanını yok sayar. Çelik saldırısını savunur.', ruleText: '24 yankı hasarı; 8 savunma deler · Çeliğe karşı 22 savunma' },
  banner: { name: 'Sancak', shortName: 'Sancak', type: 'steel', damage: 20, guardType: 'universal', guardBlock: 18, block: 18, rule: 'Çıktığı kaleye, o kaleye gelen sonraki tek saldırı için 12 koruma verir. Her türe karşı 18 savunma.', ruleText: '20 çelik hasarı; kaynak kaleye tek kullanımlık 12 koruma · Her türe 18 savunma' },
});
export const ATTACKS = ORDERS;
export const DEFENSES = Object.freeze({ ...ORDERS, brace: Object.freeze({ id: 'brace', name: 'Siper Al', type: 'universal', guardType: 'universal', guardBlock: 8, block: 8, rule: '8 savunma; iki emrini de sonraki saldırına sakla.' }) });
const SIDES = ['player', 'enemy'];
const HERO_IDS = Object.keys(HEROES);
const ORDER_IDS = Object.keys(ORDERS);
const CASTLE_IDS = ['left', 'main', 'right'];
const PHASES = ['playerAttack', 'aiDefense', 'aiAttack', 'playerDefense', 'finished'];
const clone = (value) => JSON.parse(JSON.stringify(value));
const other = (side) => side === 'player' ? 'enemy' : 'player';
const phaseFor = (side, kind) => `${side === 'player' ? 'player' : 'ai'}${kind}`;
const attackSide = (state) => state.phase === 'playerAttack' ? 'player' : state.phase === 'aiAttack' ? 'enemy' : null;
const defenseSide = (state) => state.phase === 'playerDefense' ? 'player' : state.phase === 'aiDefense' ? 'enemy' : null;
const castleAt = (state, side, id) => state.castles[side].find((castle) => castle.id === id);
const clampTraining = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(3, Math.trunc(Number(value)))) : 0;
function checkSide(side) { if (!SIDES.includes(side)) throw new RangeError(`Bilinmeyen taraf: ${side}`); }
function fail(message) { throw new Error(`Geçersiz oyun durumu: ${message}`); }
function seedNumber(seed) {
  if (Number.isFinite(seed)) return (Math.trunc(seed) >>> 0) || 0x6d2b79f5;
  let value = 2166136261;
  for (const character of String(seed ?? 'kale-muhafizlari-v3')) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return (value >>> 0) || 0x6d2b79f5;
}
function random(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let value = state.rng;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
function castleSet() { return CASTLE_IDS.map((id) => ({ id, name: { left: 'Sol Kule', main: 'Ana Kale', right: 'Sağ Kule' }[id], hp: id === 'main' ? 150 : 90, maxHp: id === 'main' ? 150 : 90, cover: 0 })); }
function heroSet() { return Object.fromEntries(HERO_IDS.map((id) => [id, { castleId: HEROES[id].castleId, retreatRounds: 0 }])); }
function log(state, text) { state.log = [...state.log, text].slice(-12); }
/** createGame({seed,firstSide,trainingEnabled,trainingBySide,hands,neutralOrder}). */
export function createGame(options = {}) {
  const trainingEnabled = options.trainingEnabled === true;
  const state = {
    version: 3, revision: 0, phase: 'playerAttack', round: 1, turnInRound: 0, turnIndex: 0,
    seed: options.seed ?? 'kale-muhafizlari-v3', rng: seedNumber(options.seed), firstSide: options.firstSide ?? 'player',
    castles: { player: castleSet(), enemy: castleSet() }, heroes: { player: heroSet(), enemy: heroSet() },
    hands: { player: [], enemy: [] }, neutralOrder: null, committedOrder: { player: null, enemy: null },
    lastOwnTarget: { player: null, enemy: null }, attackCount: { player: 0, enemy: 0 },
    trainingEnabled, training: { enabled: trainingEnabled, power: trainingEnabled ? clampTraining(options.trainingBySide?.player ?? options.training?.power ?? options.training?.tier) : 0, defense: 0 },
    trainingBySide: { player: trainingEnabled ? clampTraining(options.trainingBySide?.player ?? options.training?.power ?? options.training?.tier) : 0, enemy: trainingEnabled ? clampTraining(options.trainingBySide?.enemy) : 0 },
    pendingAttack: null, lastEvent: null, lastDefense: null, winner: null,
    log: ['Beş açık emir dolaşır. Saldırdığın emri ortadaki emirle değiştir. Savunmada kullandığın emir sonraki saldırında bekler.'],
  };
  const deck = [...ORDER_IDS];
  for (let i = deck.length - 1; i > 0; i -= 1) { const j = Math.floor(random(state) * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  if (options.hands !== undefined || options.neutralOrder !== undefined) {
    state.hands = clone(options.hands ?? {}); state.neutralOrder = options.neutralOrder;
  } else { state.hands = { player: deck.slice(0, 2), enemy: deck.slice(2, 4) }; state.neutralOrder = deck[4]; }
  if (state.firstSide === 'random') state.firstSide = random(state) < 0.5 ? 'player' : 'enemy';
  checkSide(state.firstSide); state.phase = phaseFor(state.firstSide, 'Attack');
  validateState(state); return state;
}
/** Throws on malformed serialized state. All public transitions validate before reading it. */
export function validateState(state) {
  if (!state || state.version !== 3 || !PHASES.includes(state.phase)) fail('sürüm veya aşama');
  for (const key of ['revision', 'turnIndex', 'round', 'turnInRound']) if (!Number.isInteger(state[key]) || state[key] < (key === 'round' ? 1 : 0)) fail(key);
  if (state.turnInRound > 1 || !SIDES.includes(state.firstSide) || !Number.isInteger(state.rng) || state.rng < 0 || state.rng > 0xffffffff) fail('tur veya rastgelelik tohumu');
  const cards = [...(state.hands?.player ?? []), ...(state.hands?.enemy ?? []), state.neutralOrder];
  if (!Array.isArray(state.hands?.player) || !Array.isArray(state.hands?.enemy) || state.hands.player.length !== 2 || state.hands.enemy.length !== 2 || cards.length !== 5 || new Set(cards).size !== 5 || cards.some((id) => !ORDER_IDS.includes(id))) fail('beş benzersiz emir korunmalı');
  for (const side of SIDES) {
    if (!Array.isArray(state.castles?.[side]) || state.castles[side].length !== 3 || new Set(state.castles[side].map((entry) => entry.id)).size !== 3) fail('kaleler');
    for (const id of CASTLE_IDS) {
      const castle = castleAt(state, side, id);
      if (!castle || castle.maxHp !== (id === 'main' ? 150 : 90) || !Number.isInteger(castle.hp) || castle.hp < 0 || castle.hp > castle.maxHp || ![0, 12].includes(castle.cover)) fail('kale canı veya koruması');
    }
    if (!state.heroes?.[side] || Object.keys(state.heroes[side]).length !== HERO_IDS.length || Object.keys(state.heroes[side]).some((id) => !HERO_IDS.includes(id))) fail('muhafız kimlikleri');
    for (const id of HERO_IDS) {
      const hero = state.heroes?.[side]?.[id];
      if (!hero || !CASTLE_IDS.includes(hero.castleId) || ![0, 1].includes(hero.retreatRounds) || (hero.retreatRounds && hero.castleId !== 'main')) fail('muhafız');
      if (castleAt(state, side, hero.castleId).hp <= 0 && state.phase !== 'finished') fail('yıkık kalede muhafız');
      if (id === 'neris' && (hero.castleId !== 'main' || hero.retreatRounds !== 0)) fail('Neris ana kaleyi terk edemez');
    }
    if (state.committedOrder?.[side] !== null && !state.hands[side].includes(state.committedOrder?.[side])) fail('bekleyen emir');
    if (state.lastOwnTarget?.[side] !== null && !CASTLE_IDS.includes(state.lastOwnTarget?.[side])) fail('önceki hedef');
    if (!Number.isInteger(state.attackCount?.[side]) || state.attackCount[side] < 0) fail('saldırı sayısı');
    if (!Number.isInteger(state.trainingBySide?.[side]) || state.trainingBySide[side] < 0 || state.trainingBySide[side] > 3) fail('gelişim');
  }
  if (typeof state.trainingEnabled !== 'boolean' || !state.training || state.training.enabled !== state.trainingEnabled || !Array.isArray(state.log)) fail('ayarlar');
  if (!state.trainingEnabled && SIDES.some((side) => state.trainingBySide[side] !== 0)) fail('kapalı gelişim');
  if (state.winner !== null && !SIDES.includes(state.winner)) fail('kazanan');
  if (state.phase === 'finished') {
    if (!state.winner || castleAt(state, other(state.winner), 'main').hp !== 0 || state.pendingAttack !== null) fail('bitiş');
  } else if (state.winner || SIDES.some((side) => castleAt(state, side, 'main').hp === 0)) fail('bitmemiş oyun');
  const attacker = attackSide(state);
  if (attacker && state.committedOrder[other(attacker)] !== null) fail('sırası olmayan tarafın bekleyen emri');
  const defender = defenseSide(state);
  if (defender) {
    const attack = state.pendingAttack;
    if (!attack || attack.side !== other(defender) || !ORDER_IDS.includes(attack.orderId) || attack.orderId !== state.neutralOrder || !HERO_IDS.includes(attack.heroId) || !CASTLE_IDS.includes(attack.targetId) || !CASTLE_IDS.includes(attack.sourceId) || !Number.isInteger(attack.damage) || attack.damage < 0 || attack.type !== ORDERS[attack.orderId].type) fail('bekleyen saldırı');
    const order = ORDERS[attack.orderId];
    const expectedNative = HEROES[attack.heroId].type === order.type ? 3 : 0;
    const expectedTraining = state.trainingEnabled && attack.heroId === 'kora' && order.type === 'stone' ? state.trainingBySide[attack.side] : 0;
    const expectedRepeat = attack.orderId === 'catapult' && attack.previousTarget === attack.targetId ? 18 : 0;
    if ((attack.previousTarget !== null && !CASTLE_IDS.includes(attack.previousTarget)) || attack.baseDamage !== order.damage || attack.nativeBonus !== expectedNative || attack.trainingBonus !== expectedTraining || attack.repeatBonus !== expectedRepeat
      || attack.damage !== order.damage + expectedNative + expectedTraining + expectedRepeat || attack.pierce !== (attack.orderId === 'mist' ? 8 : 0) || attack.sourceCover !== (attack.orderId === 'banner' ? 12 : 0)
      || attack.sourceId !== state.heroes[attack.side][attack.heroId].castleId || state.lastOwnTarget[attack.side] !== attack.targetId || state.committedOrder[attack.side] !== null || !state.hands[attack.side].includes(attack.receivedOrder)) fail('bozuk saldırı katkıları');
    const target = castleAt(state, defender, attack.targetId);
    if (target.hp <= 0 || (target.id === 'main' && !state.castles[defender].some((c) => c.id !== 'main' && c.hp === 0))) fail('bekleyen hedef');
    if (state.committedOrder[defender] !== null) fail('savunma öncesi bekleyen emir');
  } else if (state.pendingAttack !== null) fail('aşama dışında saldırı');
  return true;
}
function assertPhase(state, side, kind, payload) {
  validateState(state); checkSide(side);
  if (state.phase !== phaseFor(side, kind) || state.winner) throw new Error(`Bu işlem ${phaseFor(side, kind)} aşamasında yapılabilir.`);
  if (payload?.revision !== undefined && payload.revision !== state.revision) throw new Error('Bu seçim eski bir oyun durumuna ait.');
}
export function heldOrders(state, side) { checkSide(side); return state.hands[side].map((id) => ({ ...ORDERS[id], committed: state.committedOrder[side] === id, available: state.committedOrder[side] !== id })); }
export function availableHeroes(state, side) { checkSide(side); return HERO_IDS.map((id) => ({ ...HEROES[id], ...state.heroes[side][id], available: !state.heroes[side][id].retreatRounds && castleAt(state, side, state.heroes[side][id].castleId).hp > 0 })); }
export function legalTargets(state, side) {
  checkSide(side); if (state.winner) return [];
  const castles = state.castles[other(side)], unlocked = castles.some((castle) => castle.id !== 'main' && castle.hp === 0);
  return castles.filter((castle) => castle.hp > 0 && (castle.id !== 'main' || unlocked)).map((castle) => ({ ...castle }));
}
function attackRecord(state, side, orderId, heroId, targetId) {
  const order = ORDERS[orderId], hero = state.heroes[side][heroId];
  const nativeBonus = HEROES[heroId].type === order.type ? RULES.nativeBonus : 0;
  const trainingBonus = state.trainingEnabled && heroId === 'kora' && order.type === 'stone' ? state.trainingBySide[side] : 0;
  const repeatBonus = orderId === 'catapult' && state.lastOwnTarget[side] === targetId ? RULES.catapultRepeat : 0;
  return { ...order, orderId, attackId: orderId, heroId, sourceId: hero.castleId, targetId, side, revision: state.revision, baseDamage: order.damage, damage: order.damage + nativeBonus + trainingBonus + repeatBonus, nativeBonus, trainingBonus, repeatBonus, pierce: orderId === 'mist' ? 8 : 0, sourceCover: orderId === 'banner' ? 12 : 0, available: true };
}
export function legalAttacks(state, side = attackSide(state)) {
  checkSide(side); if (state.phase !== phaseFor(side, 'Attack') || state.winner) return [];
  return state.hands[side].filter((id) => id !== state.committedOrder[side]).flatMap((orderId) => availableHeroes(state, side).filter((hero) => hero.available).flatMap((hero) => legalTargets(state, side).map((target) => attackRecord(state, side, orderId, hero.id, target.id))));
}
export function availableAttacks(state, side) { return heldOrders(state, side); }
function normalizeAttack(payload = {}) { return { ...payload, orderId: payload.orderId ?? payload.attackId }; }
function normalizeDefense(payload = {}) { if (typeof payload === 'string') payload = { orderId: payload }; return { ...payload, orderId: payload.orderId ?? payload.defenseId }; }
function findAttack(state, side, payload) { return legalAttacks(state, side).find((entry) => entry.orderId === payload.orderId && entry.heroId === payload.heroId && entry.targetId === payload.targetId); }
function declareAttack(state, side, action) {
  const next = clone(state), receivedOrder = next.neutralOrder, index = next.hands[side].indexOf(action.orderId);
  next.hands[side][index] = receivedOrder; next.neutralOrder = action.orderId;
  next.committedOrder[side] = null;
  if (action.sourceCover) castleAt(next, side, action.sourceId).cover = action.sourceCover;
  for (const hero of Object.values(next.heroes[side])) if (hero.retreatRounds) hero.retreatRounds = 0;
  next.lastOwnTarget[side] = action.targetId; next.attackCount[side] += 1; next.revision += 1;
  next.pendingAttack = { ...action, receivedOrder, previousTarget: state.lastOwnTarget[side] }; next.lastDefense = null;
  next.phase = phaseFor(other(side), 'Defense');
  next.lastEvent = { kind: 'attackDeclared', attackerSide: side, ...clone(next.pendingAttack), nextReceivedOrder: receivedOrder };
  return next;
}
export function applyAttack(state, side, payload) {
  payload = normalizeAttack(payload); assertPhase(state, side, 'Attack', payload);
  const action = findAttack(state, side, payload);
  if (!action) throw new Error('Emir, muhafız veya hedef bu saldırı için uygun değil.');
  return declareAttack(state, side, action);
}
function defenseRecord(state, side, orderId, heroId = null) {
  const attack = state.pendingAttack, order = DEFENSES[orderId];
  const matching = orderId !== 'brace' && (order.guardType === 'universal' || order.guardType === attack.type);
  const localBonus = matching && state.heroes[side][heroId]?.castleId === attack.targetId ? RULES.localGuardBonus : 0;
  const guardBlock = orderId === 'brace' ? 8 : matching ? order.guardBlock : 0;
  return { ...order, orderId, defenseId: orderId, heroId, side, revision: state.revision, matching, effective: matching, localBonus, baseBlock: guardBlock, block: guardBlock + localBonus, available: true };
}
export function legalDefenses(state, side = defenseSide(state)) {
  checkSide(side); if (state.phase !== phaseFor(side, 'Defense') || !state.pendingAttack || state.winner) return [];
  return [...state.hands[side].flatMap((orderId) => availableHeroes(state, side).filter((hero) => hero.available).map((hero) => defenseRecord(state, side, orderId, hero.id))), defenseRecord(state, side, 'brace')];
}
export const availableDefenses = legalDefenses;
function findDefense(state, side, payload) {
  const candidates = legalDefenses(state, side).filter((entry) => entry.orderId === payload.orderId);
  if (payload.orderId === 'brace') return candidates[0];
  if (payload.heroId) return candidates.find((entry) => entry.heroId === payload.heroId);
  // Order-only callers get the strongest available local guardian, with stable ties.
  return candidates.sort((a, b) => b.block - a.block)[0];
}
function defenseEffect(state, side, defense) {
  const attack = state.pendingAttack, castle = castleAt(state, side, attack.targetId), coverBlock = castle.cover;
  const combinedBlock = defense.block + coverBlock, pierced = Math.min(attack.pierce, combinedBlock);
  const blocked = Math.min(attack.damage, Math.max(0, combinedBlock - pierced));
  const damage = Math.max(0, attack.damage - blocked), hpLost = Math.min(castle.hp, damage);
  return { incoming: attack.damage, incomingDamage: attack.damage, guardBlock: defense.baseBlock, localBonus: defense.localBonus, coverBlock, combinedBlock, pierced, blocked, damage, hpLost, hpAfter: castle.hp - hpLost, castleFell: castle.hp > 0 && castle.hp <= damage, effective: defense.matching, matching: defense.matching, coverConsumed: coverBlock > 0, heroId: defense.heroId, committedOrder: defense.orderId === 'brace' ? null : defense.orderId, nextAttackOrders: state.hands[side].filter((id) => id !== defense.orderId), handAfter: [...state.hands[side]], neutralAfter: state.neutralOrder, nextReceivedOrder: null, available: true, reason: '', label: defense.orderId === 'brace' ? 'Siper: 8 koruma; sonraki saldırıda iki emir de açık.' : defense.matching ? 'Tür uyumu: savunma emri sonraki kendi saldırında bekler.' : 'Tür uyuşmuyor: kart 0 korur ve sonraki kendi saldırında bekler.' };
}
export function previewDefense(state, payload) {
  validateState(state); payload = normalizeDefense(payload); const side = defenseSide(state);
  if (!side) throw new Error('Bekleyen savunma yok.');
  const defense = findDefense(state, side, payload);
  if (!defense) throw new Error('Savunma emri veya muhafız uygun değil.');
  return { ...defense, ...defenseEffect(state, side, defense) };
}
export function previewAttack(state, payload = {}) {
  validateState(state); payload = normalizeAttack(payload); const side = payload.side ?? attackSide(state); checkSide(side);
  const action = findAttack(state, side, payload);
  if (!action) throw new Error('Emir, muhafız veya hedef bu saldırı için uygun değil.');
  const after = declareAttack(state, side, action), defender = other(side);
  const possibleBlocks = legalDefenses(after, defender).map((defense) => ({ ...defense, ...defenseEffect(after, defender, defense) }));
  return { ...action, possibleBlocks, nextReceivedOrder: state.neutralOrder, receivedOrder: state.neutralOrder, handAfter: [...after.hands[side]], neutralAfter: action.orderId, clearsCommitment: state.committedOrder[side], sourceCoverAfter: castleAt(after, side, action.sourceId).cover, minimumDamage: Math.min(...possibleBlocks.map((d) => d.hpLost)), maximumDamage: Math.max(...possibleBlocks.map((d) => d.hpLost)) };
}
function resolveDefense(state, side, defense) {
  const effect = defenseEffect(state, side, defense), next = clone(state), attack = next.pendingAttack, castle = castleAt(next, side, attack.targetId);
  castle.hp -= effect.hpLost; castle.cover = 0;
  next.committedOrder[side] = effect.committedOrder; next.lastDefense = { ...defense, ...effect };
  next.lastEvent = { kind: 'attackResolved', round: next.round, attackerSide: attack.side, side: attack.side, heroId: attack.heroId, sourceId: attack.sourceId, orderId: attack.orderId, attackId: attack.orderId, type: attack.type, targetId: attack.targetId, defenseId: defense.orderId, defendingHeroId: defense.heroId, baseDamage: attack.baseDamage, nativeBonus: attack.nativeBonus, trainingBonus: attack.trainingBonus, repeatBonus: attack.repeatBonus, ...effect, heroId: attack.heroId, winner: null };
  log(next, `${attack.side === 'player' ? 'Sen' : 'Rakip'}: ${ORDERS[attack.orderId].name} → ${castle.name}, ${effect.hpLost} hasar. ${defense.name}: ${effect.blocked} engellendi.`);
  if (effect.castleFell && castle.id !== 'main') {
    for (const [heroId, hero] of Object.entries(next.heroes[side])) if (hero.castleId === castle.id) {
      hero.castleId = 'main'; hero.retreatRounds = 1;
      log(next, `${HEROES[heroId].name} ana kaleye çekiliyor; sıradaki saldırısında dinlenecek.`);
    }
  }
  next.pendingAttack = null; next.revision += 1; next.turnIndex += 1; next.turnInRound = next.turnIndex % 2; next.round = Math.floor(next.turnIndex / 2) + 1;
  if (effect.castleFell && castle.id === 'main') {
    next.winner = attack.side; next.phase = 'finished'; next.lastEvent.winner = attack.side;
    log(next, attack.side === 'player' ? 'Zafer! Rakibin ana kalesi düştü.' : 'Ana kalen düştü. Rövanş seni bekliyor.');
  } else next.phase = phaseFor(side, 'Attack');
  return next;
}
export function applyDefense(state, side, payload) {
  payload = normalizeDefense(payload); assertPhase(state, side, 'Defense', payload);
  const defense = findDefense(state, side, payload);
  if (!defense) throw new Error('Savunma emri veya muhafız uygun değil.');
  return resolveDefense(state, side, defense);
}
// Bounded public-information minimax. Duplicate non-local guardian outcomes are removed.
function uniqueDefenses(state, side) {
  const best = new Map();
  for (const defense of legalDefenses(state, side)) if (!best.has(defense.orderId) || defense.block > best.get(defense.orderId).block) best.set(defense.orderId, defense);
  return [...best.values()];
}
function objectiveHealth(state, side) {
  const main = castleAt(state, side, 'main'), left = castleAt(state, side, 'left'), right = castleAt(state, side, 'right');
  return main.hp * 1.25 + Math.min(left.hp, right.hp) + Math.max(left.hp, right.hp) * 0.04;
}
function handValue(state, side) {
  const cards = state.hands[side].map((id) => ORDERS[id]);
  const opposingTypes = state.hands[other(side)].map((id) => ORDERS[id].type);
  let value = Math.max(...cards.map((card) => card.damage + (card.id === 'mist' ? 6 : 0) + (card.id === 'catapult' && state.lastOwnTarget[side] ? 12 : 0))) * 0.15;
  for (const card of cards) value += opposingTypes.some((type) => card.guardType === type || card.guardType === 'universal') ? 2 : 0;
  if (state.committedOrder[side]) value -= 1.5;
  return value;
}
function positionValue(state, side) {
  if (state.winner) return state.winner === side ? 100000 : -100000;
  return objectiveHealth(state, side) - objectiveHealth(state, other(side)) + handValue(state, side) - handValue(state, other(side))
    + SIDES.reduce((total, who) => total + (who === side ? 1 : -1) * state.castles[who].reduce((sum, castle) => sum + castle.cover * (castle.id === 'main' && !state.castles[who].some((c) => c.id !== 'main' && c.hp === 0) ? 0.12 : 0.55), 0), 0);
}
function uniqueAttacks(state, side) {
  const best = new Map();
  for (const action of legalAttacks(state, side)) {
    const key = `${action.orderId}:${action.targetId}:${action.orderId === 'banner' ? action.sourceId : ''}`;
    if (!best.has(key) || action.damage > best.get(key).damage) best.set(key, action);
  }
  return [...best.values()];
}
function immediateBestAttackValue(state, side) {
  if (state.winner) return positionValue(state, side);
  let best = -Infinity;
  for (const action of uniqueAttacks(state, side)) {
    const declared = declareAttack(state, side, action), defender = other(side);
    const worst = Math.min(...uniqueDefenses(declared, defender).map((defense) => positionValue(resolveDefense(declared, defender, defense), side)));
    best = Math.max(best, worst);
  }
  return best === -Infinity ? positionValue(state, side) : best;
}
function defenseScore(state, side, defense) {
  const after = resolveDefense(state, side, defense);
  if (after.winner) return positionValue(after, side);
  return positionValue(after, side) * 0.35 + immediateBestAttackValue(after, side) * 0.65;
}
export function selectDefense(state, side = defenseSide(state)) {
  assertPhase(state, side, 'Defense'); let best = null;
  for (const action of uniqueDefenses(state, side)) {
    const score = defenseScore(state, side, action);
    if (!best || score > best.score + 1e-9) best = { action, score };
  }
  return { orderId: best.action.orderId, defenseId: best.action.orderId, heroId: best.action.heroId, revision: state.revision };
}
export function selectAttack(state, side = attackSide(state)) {
  assertPhase(state, side, 'Attack'); let best = null;
  for (const action of uniqueAttacks(state, side)) {
    const declared = declareAttack(state, side, action), defender = other(side);
    let worst = Infinity;
    for (const defense of uniqueDefenses(declared, defender)) {
      const after = resolveDefense(declared, defender, defense);
      const score = after.winner ? positionValue(after, side) : positionValue(after, side) * 0.35 - immediateBestAttackValue(after, defender) * 0.65;
      worst = Math.min(worst, score);
    }
    if (!best || worst > best.score + 1e-9) best = { action, score: worst };
  }
  return { orderId: best.action.orderId, attackId: best.action.orderId, heroId: best.action.heroId, targetId: best.action.targetId, revision: state.revision };
}
export function chooseAIAction(state, side = attackSide(state) ?? defenseSide(state)) { return attackSide(state) ? selectAttack(state, side) : selectDefense(state, side); }
export function playerAttack(state, payload) { return applyAttack(state, 'player', payload); }
export function playerDefend(state, payload) { return applyDefense(state, 'player', payload); }
export function resolveAiDefense(state) { return applyDefense(state, 'enemy', selectDefense(state, 'enemy')); }
export function chooseAiAttack(state) { return applyAttack(state, 'enemy', selectAttack(state, 'enemy')); }
export function describeState(state) {
  if (state.phase === 'finished') return state.winner === 'player' ? 'Zafer senin!' : 'Rakip kazandı.';
  return `${state.round}. tur · ${{ playerAttack: 'Bir emir, muhafız ve hedef seç.', aiDefense: 'Rakip savunmasını seçiyor.', aiAttack: 'Rakip saldırısını seçiyor.', playerDefense: 'Bir savunma emri seç veya siper al.' }[state.phase]}`;
}
