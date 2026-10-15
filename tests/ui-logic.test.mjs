/** V3 controller checks with a small synthetic DOM. No browser/layout claims. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as E from '../dist/engine.js';
import { fileURLToPath } from 'node:url';
const path = fileURLToPath(new URL('../dist/', import.meta.url));
const sources = Object.fromEntries(['app.js', 'engine.js', 'index.html', 'styles.css'].map(name => [name, fs.readFileSync(path + name, 'utf8')]));
const app = sources['app.js'].replace(/^import .*$/gm, '');
const copy = value => JSON.parse(JSON.stringify(value));
const STORE = 'kale-muhafizlari-v3';
const defaultSettings = { sound: false, trainingEnabled: false, bestTraining: 0, seenIntro: true };
const fixture = (options = {}) => E.createGame({ seed: 'ui-qa', firstSide: 'player', hands: { player: ['catapult', 'ram'], enemy: ['volley', 'mist'] }, neutralOrder: 'banner', ...options });
function harness({ initial = fixture(), settings = defaultSettings, storage, reducedMotion = false, storageThrows = false, selectAttack = E.selectAttack, selectDefense = E.selectDefense } = {}) {
  let time = 0, tid = 0, rid = 0;
  const timers = new Map(), frames = new Map(), errors = [], animations = [];
  const store = storage ?? new Map([[STORE, JSON.stringify({ state: initial, settings })]]);
  const attrName = key => key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  class Node {
    constructor(tag = 'div', attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attrs = {}; this.dataset = {}; this.events = {}; this.children = []; this.parentNode = null;
      this.style = {}; this.disabled = false; this.checked = false; this.open = false; this._html = ''; this.textContent = ''; this._className = '';
      this.classList = { add: (...names) => this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '), remove: (...names) => this.className = this.className.split(/\s+/).filter(n => !names.includes(n)).join(' '), contains: name => this.className.split(/\s+/).includes(name), toggle: (name, force) => { const add = force ?? !this.classList.contains(name); this.classList[add ? 'add' : 'remove'](name); return add; } };
      for (const [key, value] of Object.entries(attrs)) this.setAttribute(key, value);
    }
    get id() { return this.attrs.id ?? ''; } set id(value) { this.attrs.id = value; }
    get className() { return this._className; } set className(value) { this._className = String(value); this.attrs.class = this._className; }
    setAttribute(key, value) { this.attrs[key] = String(value); if (key.startsWith('data-')) this.dataset[attrName(key.slice(5))] = String(value); if (key === 'class') this.className = value; if (key === 'disabled') this.disabled = true; if (key === 'checked') this.checked = true; }
    getAttribute(key) { return this.attrs[key] ?? null; }
    addEventListener(kind, fn) { (this.events[kind] ??= []).push(fn); }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
      this._html = String(value); this.children = [];
      const stack = [this]; const voidTags = new Set(['META', 'LINK', 'INPUT', 'BR', 'HR', 'IMG', 'SOURCE', 'WBR']);
      for (const match of this._html.matchAll(/<\/?[a-zA-Z][^>]*>/g)) {
        const raw = match[0], tag = raw.match(/^<\/?([\w-]+)/)?.[1];
        if (raw.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
        const attrs = {};
        for (const a of raw.slice(tag.length + 1, -1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1]] = a[2] ?? a[3] ?? a[4] ?? '';
        const node = new Node(tag, attrs); stack.at(-1).appendChild(node);
        if (!voidTags.has(node.tagName) && !raw.endsWith('/>')) stack.push(node);
      }
    }
    appendChild(node) { this.children.push(node); node.parentNode = this; return node; }
    append(node) { return this.appendChild(node); }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(n => n !== this); this.parentNode = null; }
    matches(selector) {
      const id = selector.match(/^#([\w-]+)/); if (id && this.id !== id[1]) return false;
      const cls = selector.match(/^\.([\w-]+)/); if (cls && !this.classList.contains(cls[1])) return false;
      const tag = selector.match(/^[a-zA-Z][\w-]*/); if (tag && this.tagName !== tag[0].toUpperCase()) return false;
      for (const attr of selector.matchAll(/\[([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]/g)) if (!(attr[1] in this.attrs) || (attr[2] !== undefined && this.attrs[attr[1]] !== attr[2])) return false;
      return true;
    }
    closest(selector) { for (let n = this; n; n = n.parentNode) if (n.matches(selector)) return n; return null; }
    querySelectorAll(selector) { return this.children.flatMap(n => [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    getBoundingClientRect() { const left = this.dataset.castle === 'right' ? 400 : this.dataset.castle === 'main' ? 200 : 0, top = this.dataset.side === 'player' ? 350 : 0; return { left, top, right: left + 600, bottom: top + 600, width: 600, height: 600 }; }
    showModal() { this.open = true; } close() { this.open = false; }
    animate(keyframes, options) { animations.push({ node: this.className || this.id, keyframes, options }); return {}; }
  }
  const root = new Node('document'); root.innerHTML = sources['index.html'];
  const get = selector => { const node = root.querySelector(selector); assert(node, `Missing DOM selector: ${selector}`); return node; };
  const document = { getElementById: id => root.querySelector('#' + id), createElement: tag => new Node(tag), querySelector: selector => root.querySelector(selector) };
  class ClockDate extends Date { static now() { return 1700000000000 + time; } }
  const ctx = vm.createContext({ ...E, selectAttack, selectDefense, icon: name => `<i class="icon" data-icon="${name}"></i>`, portrait: () => '<svg class="portrait"></svg>', castleArt: () => '<svg class="castle-art"></svg>', landscape: '<svg class="landscape"></svg>', document,
    console: { ...console, error: error => errors.push(String(error)) }, matchMedia: () => ({ matches: reducedMotion }),
    localStorage: { getItem: key => { if (storageThrows) throw Error('storage denied'); return store.get(key) ?? null; }, setItem: (key, value) => { if (storageThrows) throw Error('quota'); store.set(key, value); }, removeItem: key => { if (storageThrows) throw Error('storage denied'); store.delete(key); } },
    setTimeout: (fn, delay) => { timers.set(++tid, { fn, due: time + delay }); return tid; }, clearTimeout: id => timers.delete(id), requestAnimationFrame: fn => { frames.set(++rid, fn); return rid; }, cancelAnimationFrame: id => frames.delete(id), performance: { now: () => time }, window: { addEventListener: () => {} }, Date: ClockDate, Math });
  vm.runInContext(app, ctx, { filename: 'app.js' });
  const run = code => vm.runInContext(code, ctx);
  function advance(ms) { const end = time + ms; let count = 0; while (true) { const next = [...timers].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due)[0]; if (!next) break; assert(++count < 5000, 'Timer runaway'); time = next[1].due; timers.delete(next[0]); next[1].fn(); } time = end; return count; }
  function frame(ms = 16) { time += ms; const pending = [...frames]; frames.clear(); for (const [, fn] of pending) fn(time); }
  function dispatch(node, kind, data = {}) { const event = { target: node, clientX: 10, clientY: 10, preventDefault() { this.defaultPrevented = true; }, ...data }; for (let n = node; n; n = n.parentNode) for (const fn of n.events[kind] ?? []) fn(event); if (kind === 'cancel' && !event.defaultPrevented) node.close(); }
  function click(selector, { force = false, nested = false } = {}) { const node = get(selector); if (!force && (node.disabled || (get('#modal').open && !node.closest('#modal')))) return false; dispatch(nested ? node.children[0] ?? node : node, 'click'); return true; }
  function change(selector, checked) { const node = get(selector); node.checked = checked; dispatch(node, 'change'); }
  const read = () => copy(run('({state,selectedHero,selectedOrder,selectedTarget,selectedDefense,busy,finishShown,settings,modalGeneration,generation,storageAvailable,centerResult})'));
  function attack(action) { const source = read().state.heroes.player[action.heroId].castleId; for (let i = 0; i < 4; i++) { click(`[data-side="player"][data-castle="${source}"]`, { nested: true }); if (read().selectedHero === action.heroId) break; } assert.equal(read().selectedHero, action.heroId); click(`[data-order="${action.orderId}"]`, { nested: true }); click(`[data-side="enemy"][data-castle="${action.targetId}"]`, { nested: true }); assert.equal(get('#action-button').disabled, false); click('#action-button'); }
  function defend(orderId = 'brace') { click(orderId === 'brace' ? '[data-defense="brace"]' : `[data-order="${orderId}"]`, { nested: true }); assert.equal(read().selectedDefense, orderId); click('#action-button'); }
  return { run, advance, frame, read, get, click, change, dispatch, attack, defend, timers, frames, store, errors, animations, root };
}
const tests = [];
function test(name, fn) { if (process.env.UI_TEST_FILTER && !name.includes(process.env.UI_TEST_FILTER)) return; const start = Date.now(); try { const result = fn(); tests.push({ name, pass: true, ms: Date.now() - start, ...(result === undefined ? {} : { result }) }); } catch (error) { tests.push({ name, pass: false, ms: Date.now() - start, error: error.stack }); } console.error(`${tests.at(-1).pass ? 'PASS' : 'FAIL'} ${name}`); }
const attackPayload = (state, side = 'player', orderId, heroId = 'kora', targetId = 'left') => E.legalAttacks(state, side).find(a => (!orderId || a.orderId === orderId) && a.heroId === heroId && a.targetId === targetId);
const incoming = (orderId = 'catapult', heroId = 'kora', targetId = 'left') => E.applyAttack(fixture({ firstSide: 'enemy', hands: { player: ['volley', 'ram'], enemy: ['catapult', 'mist'] }, neutralOrder: 'banner' }), 'enemy', { orderId, heroId, targetId });

test('actual nested listeners: source castle → held order → enemy castle → confirm; duplicate submit', () => {
  const h = harness(), before = h.read().state;
  assert.equal(h.get('#action-button').disabled, true);
  assert.equal(h.get('[data-side="enemy"][data-castle="left"]').disabled, true);
  h.click('[data-side="player"][data-castle="left"]', { nested: true }); assert.equal(h.read().selectedHero, 'kora');
  h.click('[data-order="catapult"]', { nested: true }); assert.equal(h.read().selectedOrder, 'catapult');
  h.click('[data-side="enemy"][data-castle="main"]'); assert.equal(h.read().selectedTarget, null); assert.match(h.get('#toast').textContent, /önce bir yan/);
  h.click('[data-side="enemy"][data-castle="left"]', { nested: true }); assert.equal(h.get('#action-button').disabled, false); assert.match(h.get('#move-preview').innerHTML, /25 ham hasar/);
  h.click('#action-button'); const committed = h.read(); h.click('#action-button', { force: true }); assert.deepEqual(h.read(), committed);
  assert.equal(committed.state.phase, 'aiDefense'); assert.equal(committed.state.neutralOrder, 'catapult'); assert.deepEqual(committed.state.hands.player, ['banner', 'ram']); assert.deepEqual(committed.state.castles, before.castles);
  h.advance(1200); assert.equal(h.read().state.revision, 2); h.advance(1520); assert.equal(h.read().state.phase, 'playerDefense'); assert.equal(h.read().busy, false); assert.equal(h.errors.length, 0);
});

test('counter-card and brace previews match applied HP; committed card disabled on next attack', () => {
  for (const orderId of ['volley', 'ram', 'brace']) {
    const s = incoming(), h = harness({ initial: s }), pv = E.previewDefense(s, { orderId });
    assert.equal(h.read().selectedDefense, 'brace'); h.click(orderId === 'brace' ? '[data-defense="brace"]' : `[data-order="${orderId}"]`);
    assert.match(h.get('#move-preview').innerHTML, new RegExp(`${pv.damage} net hasar`)); assert.match(h.get('#move-preview').innerHTML, new RegExp(`${s.castles.player[0].hp} → ${pv.hpAfter}`));
    if (orderId === 'ram') assert.match(h.get('#action-note').textContent, /koruması 0/);
    h.click('#action-button'); const during = h.read(); h.click('#action-button', { force: true }); assert.deepEqual(h.read(), during);
    h.advance(1270); const next = h.read(); assert.equal(next.state.phase, 'playerAttack'); assert.equal(next.state.castles.player[0].hp, pv.hpAfter); assert.equal(next.busy, false);
    assert.equal(next.state.committedOrder.player, orderId === 'brace' ? null : orderId); assert.deepEqual(next.state.hands.player, s.hands.player); assert.equal(next.state.neutralOrder, s.neutralOrder);
    for (const id of s.hands.player) assert.equal(h.get(`[data-order="${id}"]`).disabled, id === orderId);
    if (orderId !== 'brace') { h.click(`[data-order="${orderId}"]`, { force: true }); assert.equal(h.read().selectedOrder, null); }
    const a = E.legalAttacks(next.state, 'player')[0]; h.attack(a); assert.equal(h.read().state.committedOrder.player, null); assert.equal(h.errors.length, 0);
  }
});

test('help modal pauses AI thinking and resumes once without extra attack', () => {
  const h = harness({ initial: fixture({ firstSide: 'enemy' }) }); h.click('#help-button'); const before = h.read().state; h.advance(5000); assert.deepEqual(h.read().state, before); assert.equal(h.read().busy, true);
  h.click('#close-modal'); h.advance(2000); assert.equal(h.read().state.phase, 'playerDefense'); assert.equal(h.read().state.revision, 1); assert.equal(h.read().busy, false); h.advance(10000); assert.equal(h.read().state.revision, 1);
});

test('modal opened during impact animation pauses state commit and cleanup safely', () => {
  const h = harness(); h.attack(attackPayload(h.read().state, 'player', 'ram')); h.advance(600); assert.equal(h.animations.filter(a => a.node === 'projectile').length, 1); h.click('#help-button'); const before = h.read().state; h.advance(4000); assert.deepEqual(h.read().state, before);
  h.click('#close-modal'); h.advance(120); assert.equal(h.read().state.revision, 2); assert.equal(h.read().busy, true); h.click('#settings-button'); const result = h.read().state; h.advance(3000); assert.deepEqual(h.read().state, result); h.click('#close-modal'); h.advance(2000); assert.equal(h.read().state.phase, 'playerDefense'); assert.equal(h.read().state.revision, 3); assert.equal(h.errors.length, 0);
});

test('restart confirmation cancels AI thinking, impact, and post-impact callbacks', () => {
  for (const elapsed of [0, 600, 1200]) {
    const h = harness(); h.attack(attackPayload(h.read().state, 'player', 'ram')); h.advance(elapsed); h.click('#new-button'); h.click('[data-modal-action="new"]');
    const fresh = h.read().state; assert.equal(fresh.firstSide, 'enemy'); assert.equal(fresh.revision, 0); h.advance(10000); const next = h.read().state; assert.equal(next.seed, fresh.seed); assert.equal(next.revision, 1); assert.equal(next.phase, 'playerDefense'); assert.deepEqual(next.castles, E.applyAttack(fresh, 'enemy', E.selectAttack(fresh, 'enemy')).castles); assert.equal(h.errors.length, 0);
  }
});

test('dialog Escape/cancel and backdrop close invalidate training and resume AI', () => {
  const h = harness({ initial: fixture({ firstSide: 'enemy' }) }); h.click('#training-button'); assert(h.frames.size > 0); h.dispatch(h.get('#modal'), 'cancel'); assert.equal(h.frames.size, 0); assert.equal(h.run('trainingSession'), null); assert.equal(h.get('#modal').open, false); h.advance(2000); assert.equal(h.read().state.phase, 'playerDefense');
  h.click('#help-button'); h.dispatch(h.get('#modal'), 'click', { clientX: -10, clientY: -10 }); assert.equal(h.get('#modal').open, false);
});

test('three-shot training rejects duplicate hit and stale unlock/result callbacks', () => {
  const h = harness(); h.click('#training-button'); h.click('#training-hit'); h.click('#training-hit'); assert.equal(h.run('trainingSession.scores.length'), 1); h.advance(150); h.click('#close-modal'); h.click('#training-button'); h.click('#training-hit'); h.advance(150); assert.equal(h.run('trainingSession.lock'), true); h.advance(150); assert.equal(h.run('trainingSession.lock'), false); h.click('#training-hit'); h.advance(300); h.click('#training-hit'); assert.equal(h.read().settings.bestTraining, 3); assert.equal(h.get('#training-hit').disabled, true); h.click('#training-hit', { force: true }); assert.equal(h.read().settings.bestTraining, 3);
  h.click('#close-modal'); h.click('#settings-button'); const html = h.get('#modal-content').innerHTML; h.advance(1000); assert.equal(h.get('#modal-content').innerHTML, html); assert.match(html, /Düello ayarları/); assert.equal(h.frames.size, 0);
});

test('training animation moves marker and close/reopen cancels stale frame', () => {
  const h = harness(); h.click('#training-button'); const oldFrame = [...h.frames.values()][0]; h.frame(100); assert.notEqual(h.run('trainingSession.position'), .5); assert.match(h.get('#training-marker').style.left, /%/); h.click('#close-modal'); h.click('#training-button'); const initial = h.run('trainingSession.start'); oldFrame(99999); assert.equal(h.run('trainingSession.start'), initial); assert.equal(h.frames.size, 1, 'A stale frame must not create a second RAF chain');
});

test('training saves best result, affects only next duel Kora stone, and can be disabled', () => {
  const h = harness(); const before = h.read().state; h.click('#training-button'); h.click('#training-hit'); h.advance(300); h.click('#training-hit'); h.advance(300); h.click('#training-hit'); assert.deepEqual(h.read().state, before); assert.equal(h.read().settings.bestTraining, 3); h.advance(700); h.click('[data-modal-action="training-new"]'); assert.equal(h.read().state.trainingBySide.player, 3); assert.equal(h.read().state.trainingBySide.enemy, 0);
  const enabled = h.read().state; const untrained = copy(enabled); untrained.trainingBySide.player = 0; untrained.training.power = 0;
  for (const id of Object.keys(E.ORDERS)) { const remaining = Object.keys(E.ORDERS).filter(key => key !== id); const s = E.createGame({ firstSide: 'player', trainingEnabled: true, training: { power: 3 }, hands: { player: [id, remaining[0]], enemy: [remaining[1], remaining[2]] }, neutralOrder: remaining[3] }); for (const heroId of Object.keys(E.HEROES)) { const a = attackPayload(s, 'player', id, heroId); const pv = E.previewAttack(s, a); assert.equal(pv.trainingBonus, heroId === 'kora' && id === 'catapult' ? 3 : 0); } }
  h.click('#settings-button'); h.change('#bonus-toggle', false); h.click('[data-modal-action="new"]'); assert.equal(h.read().state.trainingBySide.player, 0); assert.equal(h.read().settings.bestTraining, 3); const restored = harness({ storage: h.store }); assert.equal(restored.read().settings.bestTraining, 3); assert.equal(restored.read().state.trainingBySide.player, 0);
});

test('stale training result never replaces a restarted game or newly opened training', () => {
  const h = harness(); h.click('#training-button'); h.click('#training-hit'); h.advance(300); h.click('#training-hit'); h.advance(300); h.click('#training-hit'); h.click('#close-modal'); h.click('#new-button'); h.click('[data-modal-action="new"]'); h.click('#training-button'); const html = h.get('#modal-content').innerHTML; h.advance(1500); assert.equal(h.get('#modal-content').innerHTML, html); assert.equal(h.run('trainingSession.scores.length'), 0);
});

test('pending attack save/reload preserves the exchange and resolves damage exactly once', () => {
  const base = fixture(), declared = E.applyAttack(base, 'player', attackPayload(base, 'player', 'ram')), resolved = E.applyDefense(declared, 'enemy', E.selectDefense(declared, 'enemy'));
  const enemyDeclared = E.applyAttack(resolved, 'enemy', E.selectAttack(resolved, 'enemy'));
  for (const initial of [base, declared, resolved, enemyDeclared]) {
    const h = harness({ initial }); assert.equal(h.read().state.phase, initial.phase); h.advance(10000); assert(['playerAttack', 'playerDefense'].includes(h.read().state.phase)); assert.equal(h.errors.length, 0); const expectedCastles = initial.phase === 'aiDefense' ? resolved.castles : initial.castles; assert.deepEqual(h.read().state.castles, expectedCastles);
    const again = harness({ storage: h.store }); again.advance(10000); assert.deepEqual(again.read().state.castles, h.read().state.castles); assert.deepEqual(again.read().state.hands, h.read().state.hands);
  }
});

test('reload during defense animation safely replays only the unresolved decision', () => {
  const initial = incoming(), expected = E.previewDefense(initial, { orderId: 'volley' }); const h = harness({ initial }); h.defend('volley'); h.advance(500); const restored = harness({ storage: h.store }); assert.equal(restored.read().state.phase, 'playerDefense'); assert.equal(restored.read().state.castles.player[0].hp, initial.castles.player[0].hp); restored.defend('volley'); restored.advance(1270); assert.equal(restored.read().state.castles.player[0].hp, expected.hpAfter); assert.equal(restored.read().state.revision, 2);
  const second = harness({ storage: restored.store }); second.advance(5000); assert.deepEqual(second.read().state, restored.read().state);
});

test('malformed V3 saves fall back before rendering; invalid settings are bounded', () => {
  const mutations = [s => { delete s.trainingBySide; }, s => { s.hands.player[0] = s.hands.enemy[0]; }, s => { s.castles.player[0].hp = -1; }, s => { s.phase = 'playerDefense'; }, s => { s.heroes.player.neris.castleId = 'left'; }];
  for (const mutate of mutations) { const s = fixture(); mutate(s); const h = harness({ initial: s, settings: { sound: 'yes', trainingEnabled: 'yes', bestTraining: 999, seenIntro: true } }); assert.equal(E.validateState(h.read().state), true); assert.notEqual(h.read().state.seed, s.seed); assert.equal(h.read().settings.bestTraining, 3); assert.equal(h.read().settings.sound, false); assert.equal(h.read().settings.trainingEnabled, false); assert.equal(h.errors.length, 0); }
  for (const raw of ['{broken json', 'null', '[]', '{"state":null}']) { const h = harness({ storage: new Map([[STORE, raw]]) }); assert.equal(E.validateState(h.read().state), true); }
});

test('legacy training migrates with bonus disabled and first-run intro pauses AI', () => {
  const storage = new Map([['kale-muhafizlari-v2', JSON.stringify({ state: { version: 2 }, settings: { sound: false, trainingEnabled: true, bestTraining: 2 } })]]); const h = harness({ storage }); assert.equal(h.read().settings.bestTraining, 2); assert.equal(h.read().settings.trainingEnabled, false); assert.equal(h.read().state.trainingBySide.player, 0); assert.equal(h.get('#modal').open, true); assert.match(h.get('#modal-content').innerHTML, /derecen korundu/); const before = h.read().state; h.advance(5000); assert.deepEqual(h.read().state, before); h.click('[data-modal-action="close"]'); h.advance(5000); assert(['playerAttack', 'playerDefense'].includes(h.read().state.phase));
});

test('unavailable localStorage still permits complete attack and honest warning', () => {
  const h = harness({ storageThrows: true }); assert.equal(h.read().storageAvailable, false); assert.match(h.get('#toast').textContent, /kaydedemiyor/); h.click('[data-modal-action="close"]'); h.advance(5000); if (h.read().state.phase === 'playerDefense') { h.defend(); h.advance(1270); } h.attack(E.legalAttacks(h.read().state, 'player')[0]); h.advance(4000); assert.equal(h.read().state.phase, 'playerDefense'); assert.equal(h.errors.length, 0);
});

test('alternate starter is persisted through three restarts and reloads', () => {
  let h = harness(); for (const expected of ['enemy', 'player', 'enemy']) { h.click('#new-button'); h.click('[data-modal-action="new"]'); assert.equal(h.read().state.firstSide, expected); h = harness({ storage: h.store }); assert.equal(h.read().state.firstSide, expected); assert.equal(h.errors.length, 0); }
});

test('reduced motion uses short animations and reaches next decision', () => {
  const h = harness({ reducedMotion: true }); h.attack(attackPayload(h.read().state, 'player', 'ram')); h.advance(60); assert.equal(h.animations[0].options.duration, 50); h.advance(180); assert.equal(h.read().state.phase, 'playerDefense'); assert.equal(h.read().busy, false);
});

test('all actionable controls use native buttons or checkbox inputs, focus ring and modal semantics exist', () => {
  const h = harness(); for (const selector of ['[data-castle]', '[data-order]', '[data-order-info]', '#action-button', '#training-button', '#help-button', '#settings-button']) for (const node of h.root.querySelectorAll(selector)) assert.equal(node.tagName, 'BUTTON');
  h.click('#settings-button'); assert.equal(h.get('#bonus-toggle').tagName, 'INPUT'); assert.equal(h.get('#bonus-toggle').attrs.type, 'checkbox'); for (const id of ['bonus-toggle', 'sound-toggle']) { const label = h.get('#' + id).closest('label'); assert(label); assert.equal(label.attrs.for, id); assert(label.classList.contains('toggle-target')); } assert.equal(h.get('#modal').tagName, 'DIALOG'); assert.equal(h.get('#modal').attrs['aria-labelledby'], 'modal-title'); assert(h.get('#modal-title')); assert.match(sources['styles.css'], /button:focus-visible,a:focus-visible,input:focus-visible\{outline:3px/); assert.match(sources['index.html'], /aria-live="polite"/);
});


test('tampered pending-attack saves recover before any scheduled resolution', () => {
  const valid = incoming();
  for (const mutate of [s => s.pendingAttack.damage++, s => s.pendingAttack.orderId = 'ram', s => s.pendingAttack.targetId = 'main', s => s.pendingAttack.receivedOrder = 'catapult', s => s.pendingAttack.trainingBonus = 3]) {
    const s = copy(valid); mutate(s); const h = harness({ initial: s }); assert.notEqual(h.read().state.seed, s.seed); assert.equal(E.validateState(h.read().state), true); assert.equal(h.read().state.revision, 0); assert.equal(h.errors.length, 0);
  }
});


test('inherited object-property names never pass saved order or hero validation', () => {
  for (const id of ['toString', 'constructor', '__proto__']) {
    for (const place of ['player', 'enemy', 'neutral']) {
      const s = fixture(); if (place === 'neutral') s.neutralOrder = id; else s.hands[place][0] = id;
      const h = harness({ initial: s }); assert.notEqual(h.read().state.seed, s.seed, `${id} in ${place} must be rejected`); assert.equal(E.validateState(h.read().state), true);
    }
    const s = incoming(); s.pendingAttack.heroId = id; const h = harness({ initial: s }); assert.notEqual(h.read().state.seed, s.seed); assert.equal(E.validateState(h.read().state), true);
  }
});

test('all four training tiers grade three shots and best score never decreases', () => {
  for (const [position, tier] of [[.5, 3], [.65, 2], [.8, 0]]) {
    const h = harness(); h.click('#training-button'); for (let shot = 0; shot < 3; shot++) { h.run(`trainingSession.position=${position}`); h.click('#training-hit'); if (shot < 2) h.advance(300); } assert.equal(h.read().settings.bestTraining, tier); h.advance(700); assert(h.get('#modal-content').innerHTML.includes(`Bu talim +${tier}`));
  }
  const h = harness({ settings: { ...defaultSettings, bestTraining: 3 } }); h.click('#training-button'); for (const position of [.65, .8, .8]) { h.run(`trainingSession.position=${position}`); h.click('#training-hit'); h.advance(300); } assert.equal(h.read().settings.bestTraining, 3); h.advance(700); assert.match(h.get('#modal-content').innerHTML, /Bu talim \+1/); assert.match(h.get('#modal-content').innerHTML, /En iyi derecen \+3/);
});

test('surviving main castle cycles relocated heroes, skips resting guardian, and attacks', () => {
  let s = fixture({ firstSide: 'enemy' }); s.castles.player[0].hp = 1; s = E.applyAttack(s, 'enemy', E.legalAttacks(s, 'enemy').find(a => a.targetId === 'left' && a.orderId === 'mist')); s = E.applyDefense(s, 'player', { orderId: 'brace' });
  const h = harness({ initial: s }); h.click('[data-side="player"][data-castle="main"]'); assert.equal(h.read().selectedHero, 'neris'); h.click('[data-side="player"][data-castle="main"]'); assert.equal(h.read().selectedHero, 'neris');
  h.attack(E.legalAttacks(s, 'player').find(a => a.heroId === 'neris')); h.advance(4000); h.defend('brace'); h.advance(1270); const available = E.availableHeroes(h.read().state, 'player').filter(hero => hero.available && hero.castleId === 'main').map(hero => hero.id); const selected = [];
  for (let i = 0; i < available.length; i++) { h.click('[data-side="player"][data-castle="main"]'); selected.push(h.read().selectedHero); } assert.deepEqual([...selected].sort(), [...available].sort()); assert(available.includes('kora')); assert.equal(h.errors.length, 0);
});

test('finished save reload stays inspectable and rematch is enabled for both outcomes', () => {
  for (const winner of ['player', 'enemy']) {
    let s = fixture({ firstSide: winner }); const defender = winner === 'player' ? 'enemy' : 'player';
    s.castles[defender][0].hp = 0; s.heroes[defender].kora.castleId = 'main'; s.castles[defender][1].hp = 1;
    s = E.applyAttack(s, winner, E.legalAttacks(s, winner).find(a => a.targetId === 'main')); s = E.applyDefense(s, defender, { orderId: 'brace' });
    assert.equal(s.winner, winner); const h = harness({ initial: s }); h.advance(5000); assert.equal(h.read().state.phase, 'finished'); assert.equal(h.get('#modal').open, false); assert.equal(h.get('#action-button').disabled, false); h.click('#action-button'); assert.notEqual(h.read().state.phase, 'finished'); assert.equal(h.read().state.firstSide, winner === 'player' ? 'enemy' : 'player');
  }
});


function cssRules(css, width, height) {
  const rules = [];
  function mediaApplies(query) {
    if (query.includes('prefers-reduced-motion')) return false;
    return [...query.matchAll(/(min|max)-(width|height)\s*:\s*(\d+)px/g)].every(([, edge, dimension, value]) => edge === 'min' ? (dimension === 'width' ? width : height) >= Number(value) : (dimension === 'width' ? width : height) <= Number(value));
  }
  function parse(text) {
    let position = 0;
    while (position < text.length) {
      const open = text.indexOf('{', position); if (open < 0) break;
      const selector = text.slice(position, open).trim(); let depth = 1, end = open + 1;
      while (depth && end < text.length) { if (text[end] === '{') depth++; if (text[end] === '}') depth--; end++; }
      const body = text.slice(open + 1, end - 1);
      if (selector.startsWith('@media')) { if (mediaApplies(selector)) parse(body); }
      else if (!selector.startsWith('@')) for (const part of selector.split(',')) rules.push({ selector: part.trim(), declarations: Object.fromEntries(body.split(';').filter(x => x.includes(':')).map(x => [x.slice(0, x.indexOf(':')).trim(), x.slice(x.indexOf(':') + 1).trim()])) });
      position = end;
    }
  }
  parse(css.replace(/\/\*[\s\S]*?\*\//g, '')); return rules;
}
function matchedCSS(selectors, width, height) {
  const values = {}, priority = {};
  const specificity = selector => (selector.match(/#[\w-]+/g)?.length ?? 0) * 100 + (selector.match(/\.[\w-]+/g)?.length ?? 0) * 10 + (selector.match(/(?:^|[ >+~])\w+/g)?.length ?? 0);
  for (const rule of cssRules(sources['styles.css'], width, height)) if (selectors.includes(rule.selector)) for (const [property, value] of Object.entries(rule.declarations)) {
    const rank = specificity(rule.selector); if (priority[property] === undefined || rank >= priority[property]) { values[property] = value; priority[property] = rank; }
  }
  return values;
}

test('static responsive cascade preserves 44 px controls and allows short-window scrolling', () => {
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 568], [300, 640]]) {
    const targets = [
      ['top icons', ['button', '.icon-button', '.top-actions .icon-button'], true],
      ['modal close', ['button', '.icon-button', '.close-modal'], true],
      ['action', ['button', '.primary-button'], false],
      ['brace', ['button', '.brace-button'], false],
      ['enemy card', ['button', '.enemy-card'], false],
      ['held order card', ['button', '.order-card'], false],
      ['modal secondary action', ['button', '.secondary-button', '.modal .secondary-button'], false],
      ['log', ['button', '.text-button', '.field-footer .text-button'], false],
      ['footer controls', ['button', '.text-button', '.command-foot .text-button'], false],
      ['settings checkbox label', ['label', '.toggle-target'], true],
    ];
    for (const [name, selectors, checkWidth] of targets) {
      const style = matchedCSS(selectors, width, height), dimension = key => Math.max(parseFloat(style[key]) || 0, parseFloat(style['min-' + key]) || 0);
      assert(dimension('height') >= 44, `${name} at ${width}×${height} has height ${JSON.stringify(style)}`);
      if (checkWidth) assert(dimension('width') >= 44, `${name} at ${width}×${height} has width ${JSON.stringify(style)}`);
    }
    assert(Number.parseFloat(matchedCSS(['.field-footer'], width, height).height) >= 44, 'Footer must contain its 44 px hit area');
    if (width <= 760) assert.equal(matchedCSS(['.game-layout'], width, height).display, 'flex');
    assert.notEqual(matchedCSS(['body'], width, height)['overflow-y'], 'hidden');
    assert.equal(matchedCSS(['.hp-fill'], width, height).display, 'block', 'HP fill needs a box to render its width and height');
    assert.equal(matchedCSS(['.castle-art'], width, height).position, 'absolute', 'Castle art must not expand the bounded row');
  }
  assert.match(sources['index.html'], /name="viewport" content="width=device-width/);
  return 'Static declarations only; visual overflow, physical pointer targets, keyboard navigation and screen reader output require browser QA.';
});

test('twenty complete listener-driven games reach win/loss and permit rematch with no stalls', () => {
  const results = [];
  for (let seed = 0; seed < 20; seed++) {
    const h = harness({ initial: E.createGame({ seed: 'ui-full-' + seed, firstSide: seed % 2 ? 'enemy' : 'player' }), reducedMotion: true });
    let decisions = 0;
    while (h.read().state.phase !== 'finished' && decisions < 300) {
      h.advance(1000); const current = h.read(); if (current.state.phase === 'finished') break; assert.equal(current.busy, false); assert.equal(E.validateState(current.state), true);
      if (current.state.phase === 'playerAttack') h.attack(E.selectAttack(current.state, 'player')); else if (current.state.phase === 'playerDefense') h.defend(E.selectDefense(current.state, 'player').orderId); else assert.fail('Idle non-player phase: ' + current.state.phase); decisions++;
    }
    h.advance(1000); const final = h.read(); assert.equal(final.state.phase, 'finished', `Seed ${seed} stalled after ${decisions} decisions`); assert.equal(h.get('#modal').open, true); assert.equal(h.errors.length, 0); const winner = final.state.winner;
    h.click('[data-modal-action="close"]'); h.advance(2000); assert.equal(h.get('#modal').open, false); h.click('#action-button'); assert.equal(h.read().state.firstSide, final.state.firstSide === 'player' ? 'enemy' : 'player'); assert.equal(h.read().state.revision, 0); assert.notEqual(h.read().state.phase, 'finished'); results.push({ seed, winner, rounds: final.state.round });
  }
  assert(results.some(r => r.winner === 'player')); assert(results.some(r => r.winner === 'enemy')); return { games: results.length, playerWins: results.filter(r => r.winner === 'player').length, enemyWins: results.filter(r => r.winner === 'enemy').length, maxRounds: Math.max(...results.map(r => r.rounds)) };
});

const hashes = Object.fromEntries(Object.entries(sources).map(([name, value]) => [name, createHash('sha256').update(value).digest('hex')]));
console.log(JSON.stringify({ scope: 'Synthetic DOM controller/listener checks; physical keyboard, geometry, touch, and browser raster are separate QA.', tests, summary: { passed: tests.filter(t => t.pass).length, total: tests.length }, hashes }, null, 2));
if (tests.some(t => !t.pass)) process.exitCode = 1;
