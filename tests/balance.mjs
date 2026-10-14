// Reproducible, non-human balance probes. Run: node tests/balance.mjs [match count]
import * as engine from '../dist/engine.js';

const count = Math.max(1, Math.min(10000, Number(process.argv[2]) || 1000));
const scenarios = [
  { label: 'Greedy blocking, base stats', level: 0, policy: 'greedy' },
  { label: 'Greedy blocking, training 1/1', level: 1, policy: 'greedy' },
  { label: 'Greedy blocking, training 3/3', level: 3, policy: 'greedy' },
  { label: 'Conserve mismatched defenses, base stats', level: 0, policy: 'conserve' },
  { label: 'Brace only, base stats', level: 0, policy: 'brace' },
];

for (const scenario of scenarios) {
  let playerWins = 0;
  let totalRounds = 0;
  let shortest = Infinity;
  let longest = 0;
  for (let seed = 1; seed <= count; seed += 1) {
    let state = engine.createGame({ seed, training: { power: scenario.level, defense: scenario.level } });
    while (!state.winner && state.round < 150) {
      const attacks = engine.availableAttacks(state, 'player').filter((a) => a.available);
      const counters = engine.availableDefenses(state, 'enemy').filter((d) => d.available);
      const expected = (a) => a.damage - Math.max(...counters.map((d) =>
        d.type === a.type ? d.block : d.id === 'brace' ? d.block : d.offTypeBlock));
      attacks.sort((a, b) => expected(b) - expected(a));
      const targets = engine.legalTargets(state, 'player');
      const target = targets.find((c) => c.id === 'main') ?? targets.sort((a, b) => a.hp - b.hp)[0];
      state = engine.resolveAiDefense(engine.playerAttack(state, { attackId: attacks[0].id, targetId: target.id }));
      if (state.winner) break;
      state = engine.chooseAiAttack(state);
      const defenses = engine.availableDefenses(state, 'player').filter((d) => d.available);
      let defense;
      if (scenario.policy === 'brace') defense = defenses.find((d) => d.id === 'brace');
      else if (scenario.policy === 'conserve') {
        defense = defenses.find((d) => d.type === state.pendingAttack.type)
          ?? defenses.find((d) => d.id === 'brace');
      } else {
        defense = defenses.sort((a, b) => engine.previewDefense(state, b.id).blocked
          - engine.previewDefense(state, a.id).blocked)[0];
      }
      state = engine.playerDefend(state, { defenseId: defense.id });
    }
    if (!state.winner) throw new Error(`Match did not finish: ${scenario.label}, seed ${seed}`);
    playerWins += Number(state.winner === 'player');
    totalRounds += state.round;
    shortest = Math.min(shortest, state.round);
    longest = Math.max(longest, state.round);
  }
  console.log(JSON.stringify({ scenario: scenario.label, matches: count, playerWins,
    aiWins: count - playerWins, averageRounds: +(totalRounds / count).toFixed(3), shortest, longest }));
}
