# Kale Muhafızları v3: circulating-order engine

This is a local, deterministic, open-information duel prototype. It has no account, network request, currency, energy meter, fatigue meter, cooldown, hidden card, random damage, paid advantage, or deck-building requirement. Five unique orders are the entire shared card pool. Every state and action can be serialized to JSON.

## Final rules

Each side holds two visible orders. The fifth order sits in the center. On your attack, play one held, uncommitted order and exchange it with the center order in the same hand slot. This is the only exchange in an attack turn.

The opponent then either:

- Guards with one order they already hold. Its separate counter-family guard face determines block. This commits that order for their immediately following attack, when only their other held order may attack. Guarding does not move cards.
- Uses free Brace for 8 block and keeps both attack choices.

After defending, that side attacks. Their played order enters the center and they receive the previous attack's order only after committing their own attack choice. They cannot catch and immediately bounce an incoming order back, and cannot defend using a card they have not received. A commitment clears on that side's next attack declaration. There is no duration counter for it.

| Order | Attack | Counter-family guard |
| --- | --- | --- |
| Volley / Ok Yağmuru | 30 Arrow | 22 versus Stone |
| Ram / Koçbaşı | 38 Steel | 22 versus Sound |
| Catapult / Mancınık | 22 Stone; +18 if the target matches the immediately previous own attack's target | 22 versus Arrow |
| Mist / Yankı Sisi | 24 Sound; ignores the first 8 combined block | 22 versus Steel |
| Banner / Sancak | 20 Steel; gives its source castle 12 cover | 18 versus any family |

A wrong-family order has zero card block but still commits. This is legal and explicitly previewed. Any active guardian can lead any order. A matching or universal guard led from the targeted castle gains +4 local block. Wrong-family guards and Brace never gain this bonus. Order-only defense callers automatically select the strongest available local guardian; explicit hero IDs remain supported for tests and other interfaces.

Banner cover is one visible marker on its source castle, either 0 or 12. It overwrites rather than stacks, persists until that specific castle is attacked, and is consumed even if the hit causes zero HP loss. Mist removes up to 8 points from guard + local block + cover together, once. Damage is then clamped at zero and HP loss at remaining castle HP.

Side castles have 90 HP and the main castle 150 HP. The main castle becomes targetable after either side castle falls. The fallen side castle's guardian moves to main but cannot lead the immediately following own attack. It is available again before the next defense. Neris never retreats, so every nonterminal attack has an active guardian and at least one uncommitted order.

Kora leads Stone, İlda Arrow, and Neris Sound for a visible +3 native attack bonus. Optional training is disabled by default. When explicitly enabled it adds 0–3 only to Kora-led Stone attacks, never to other orders or defense. This prevents trained Kora from replacing every guardian's role. The UI may migrate an existing explicit training setting; battle-state v2 saves are not compatible.

Starting deals are seeded Fisher–Yates shuffles. Initiative is explicit (`player`, `enemy`, or seeded `random`). There is no opening compensation or secret handicap. The UI may alternate initiative across rematches.

## Integration API

All exports are browser-native ES modules in `dist/engine.js`.

```js
import {
  HEROES, ORDERS, RULES,
  createGame, validateState, heldOrders, availableHeroes,
  legalTargets, legalAttacks, legalDefenses,
  previewAttack, previewDefense, applyAttack, applyDefense,
  selectAttack, selectDefense, chooseAIAction,
} from './engine.js';

let game = createGame({ seed: 'example', firstSide: 'player' });
const action = legalAttacks(game, 'player')[0];
const before = previewAttack(game, action);
game = applyAttack(game, 'player', action);
const defense = selectDefense(game, 'enemy');
const forecast = previewDefense(game, defense);
game = applyDefense(game, 'enemy', defense);
```

`createGame` options:

- `seed`: reproducible deal seed
- `firstSide`: `'player'` (default), `'enemy'`, or `'random'`
- `trainingEnabled`: explicit boolean, default false
- `trainingBySide`: `{ player: 0..3, enemy: 0..3 }`; clamped integers
- `training.power` or legacy `training.tier`: optional player training input fallback
- `hands` plus `neutralOrder`: exact custom deal for mirrored tests; must conserve all five unique orders

Attack payload: `{ orderId, heroId, targetId, revision? }`.
Defense payload: `{ orderId, heroId?, revision? }`; use `orderId: 'brace'` for free Brace. String defense IDs are also accepted. `attackId`/`defenseId` aliases are accepted for integration convenience. `revision` is optional for manually built payloads; all legal-action lists and AI choices supply it. A supplied stale revision is rejected, even if the same phase has recurred.

`legalAttacks(state, side)` returns complete legal combinations, with card descriptors, source, target, damage and contribution fields. `legalDefenses` returns the held-card/active-guardian combinations plus Brace. `heldOrders` returns the two descriptors with commitment status. `availableHeroes` includes station and availability. `legalTargets` returns surviving, unlocked target castles. Nonacting-side legal-action requests return empty arrays; explicitly provide a valid side when requesting a finished state's empty lists.

Attack previews include:

- `baseDamage`, `nativeBonus`, `trainingBonus`, `repeatBonus`, `damage`
- `sourceId`, `targetId`, `sourceCoverAfter`
- `nextReceivedOrder` / `receivedOrder` (order IDs), `handAfter`, `neutralAfter`
- `clearsCommitment`
- `possibleBlocks`: all exact legal defense outcomes after the exchange
- `minimumDamage` and `maximumDamage`: minimum/maximum possible HP loss, not unbounded raw damage

Defense previews include:

- `guardBlock`, `localBonus`, `coverBlock`, `combinedBlock`, `pierced`, `blocked`
- `incoming`, `damage`, `hpLost`, `hpAfter`, `castleFell`
- `committedOrder`, `nextAttackOrders`
- unchanged `handAfter`, `neutralAfter`; `nextReceivedOrder: null` because defense never exchanges
- `matching`, `effective`, `coverConsumed`, `heroId`, explanatory `label`

Transitions return new objects and do not mutate their inputs. Read-only previews and AI functions likewise preserve inputs. Returned states are ordinary JSON data, not deeply frozen objects; callers should treat them as immutable. `validateState` checks the serialized schema, conservation, HP bounds, commitment ownership/phase, Neris availability, and exact pending attack arithmetic. Invalid actions and corrupted states throw instead of silently repairing or producing NaN HP. UI adapters should catch load failures and create a fresh game.

Compatibility exports: `ATTACKS` aliases `ORDERS`, `DEFENSES` includes order descriptors and Brace; `availableAttacks` returns held orders, and `availableDefenses` aliases legal defenses. `playerAttack`, `playerDefend`, `resolveAiDefense`, `chooseAiAttack`, and `describeState` are convenience wrappers. These preserve names, not v2 resource semantics.

## State contract

Important fields:

```js
{
  version: 3,
  phase: 'playerAttack', // aiDefense, aiAttack, playerDefense, finished
  revision: 0,
  round: 1, turnInRound: 0, turnIndex: 0,
  firstSide: 'player', seed: 'example', rng: 123,
  hands: { player: ['volley', 'ram'], enemy: ['catapult', 'mist'] },
  neutralOrder: 'banner',
  committedOrder: { player: null, enemy: null },
  lastOwnTarget: { player: null, enemy: null },
  attackCount: { player: 0, enemy: 0 },
  castles: { player: [/* left, main, right; hp/maxHp/cover */], enemy: [] },
  heroes: { player: {/* heroId: {castleId, retreatRounds: 0|1} */}, enemy: {} },
  trainingEnabled: false,
  trainingBySide: { player: 0, enemy: 0 },
  pendingAttack: null,
  lastDefense: null,
  lastEvent: null,
  winner: null,
  log: [],
}
```

`pendingAttack` contains a complete declaration snapshot, including source, received order, and previous own target. The current center is always its played order. `lastDefense` resets when a new attack is declared. Resolved `lastEvent.heroId` is the attacking guardian; `defendingHeroId` is separate. `lastEvent.kind` is `attackDeclared` or `attackResolved`. `turnIndex` counts resolved attacks and `round` advances after two resolved attacks. A main-castle defeat immediately sets `finished` and `winner`, clears the pending attack, and disallows further actions.

## AI

The AI only reads public state and uses the same transitions as the player. There is no extra damage, healing, hidden resource, future input access, or ambient randomness. Equal scores break deterministically. It considers every distinct attack/order/target outcome, retaining separate Banner source positions and pruning redundant guardian choices. It considers each distinct defense including wrong-family guards and Brace.

The bounded minimax evaluates an attack, the defender's choice, one opposing reply attack and that attack's defense. The objective combines castle progress, public future-hand value, and useful cover. Defensive choices weigh current damage against the immediately available return attack, so committing a high-value order can sometimes be declined. This is a small heuristic search, not a solved game or a claim of optimal human-level play.

## Tests

```sh
node --test tests/engine.test.mjs
node tests/balance.mjs 6
node tests/balance.mjs 30 --no-ai
node tests/balance.mjs 6 --training=base,symmetric3,player3
node tests/balance.mjs 24 --pair=strongest:engine-ai
node tests/balance.mjs 13 --seed-list=1003,1007,1008,1011,1014,1022,1023,1025,1029,1033,1043,1074,1077
```

The engine suite covers deterministic deals, phase order, conserved 2+2+1 ownership, one exchange, guard commitment and clearing, no incoming-card early use, no immediate bounce, Brace, all card effects, guardian locality, native/training limits, retreat timing, gates, final victory, frozen-input immutability, exact previews, stale/repeated/illegal actions, malformed saved-state rejection, AI symmetry, and 500 complete seeded randomized games. It verifies all legal defense outcomes for every legal opening attack over 12 seeds. Independent read-only review also exhaustively checked all 120 order permutations and both initiative directions against the transition invariants.

The balance runner mirrors both initiative and physical side assignment per seed, moves the same deal with policy identity, detects repeated combat states independently of counters/logs, and flags a 300-attack limit as a timeout instead of claiming a draw. Its JSON output includes engine SHA-256, seeds, policy wins, initiative wins, match lengths, order use, forced-attack frequency, matching-defense declines, cycles, and constructed counterexample positions. `--engine=/absolute/path/to/copy.mjs` supports isolated rule experiments; `--no-witnesses` skips witness search.

## Balance observations and limits

These are deterministic policy diagnostics, not a human playtest or proof of balance. The samples include mirrored duplicates for side-symmetry verification, so game counts must not be treated as independent statistical observations.

The initial 30-block / 110-side / 180-main draft ran 840 games over 30 seeds against strongest-hit, target-aware, card-aware, and per-card spam policies. First attackers won 70.71%; games averaged 63.12 total attacks; matching defense was declined only 2.21% of opportunities. There were no detected cycles. That pacing and highly automatic guard choice motivated the smaller final values.

The preselected 22-block / 90-side / 150-main candidate ran 672 non-AI games over 24 seeds: 56.25% first-attacker wins, 32.95 average total attacks, maximum 45, no cycles/timeouts. Matching guards were declined 5.24% of opportunities. A separate 96-game strongest-hit-versus-AI probe gave 52.08% first-attacker wins and 28.60 average attacks; AI won 94/96. This primarily establishes that considering cards and future exchanges beats greedy highest-hit behavior, not that every matchup is even.

For a genuine allocation holdout, the 24 development seeds were reduced to their 17 distinct ordered two-card-hand partitions (hand display order ignored). All 13 other partitions were then tested from fresh 1000+ seeds. On those unseen allocations:

- 364 strongest/spam/target/card-aware games: 50.55% first-attacker wins; mean 32.35 attacks; maximum 45
- 52 strongest-hit-versus-AI games: 53.85% first-attacker wins; mean 28.77 attacks; AI won 50/52
- No detected repeated-state cycles or 300-attack timeouts

An isolated responder-cover experiment overcompensated initiative, so it was discarded. An isolated first-defense commitment waiver did not improve pacing, so it was also discarded. Neither exception appears in the final rules. No additional balance tuning is implied by this report.

The runner constructs, for each of the five orders, at least one visible position where the bounded AI chooses it and another where it chooses a different held order. These are reproducible counterexamples to "always play this card" within that heuristic, not proof that every card is equally strong. Catapult's repeated-target pressure, Banner's source protection, and counter-family hand composition still require broader human testing. Typed guard remains usually worthwhile, and many following attacks are intentionally constrained to the other card. Equal-policy self-play and training diagnostics should be interpreted separately from aggregate initiative percentages against unequal opponents.

Final equal-policy checks, separately from the unequal-policy aggregates:

- AI versus itself, 30 seeds × both initiative orders × both physical assignments (120 games): first-attacker win rate 46.67%, mean 27.43 total attacks, maximum 30
- Card-aware versus itself with the same 120-game protocol: first-attacker win rate 45.00%, mean 28.92 attacks, maximum 31
- Final 14-policy-pair sweep over 6 seeds and all three training settings (1,008 games): mean total attacks 31.17 with training off, 29.69 with symmetric +3, and 30.35 with player-only +3; no cycles or timeouts in any setting
- All five chosen-and-declined order witnesses were found again on the final production engine

The asymmetric player-only training setting is deliberately not a fair-match benchmark. Its small advantage is visible and optional. The reported initiative percentages remain sample- and policy-specific; human matchup quality and richer strategic depth remain unproven.
