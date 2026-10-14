/** Synthetic DOM logic checks only; real layout/touch verification is separate. */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import { fileURLToPath } from 'node:url';
const path=fileURLToPath(new URL('../dist/', import.meta.url));
const app=fs.readFileSync(path+'app.js','utf8').replace(/^import .*$/gm,'');
const ids=[...fs.readFileSync(path+'index.html','utf8').matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
const copy=o=>JSON.parse(JSON.stringify(o));
function harness({initial=E.createGame({seed:'qa',firstSide:'player'}), savedSettings, storage, chooseAiAttack}={}) {
 let time=0,tid=0,rid=0;
 const timers=new Map(), frames=new Map(), nodes=new Map(), errors=[];
 const store=storage??new Map([['kale-muhafizlari-v2',JSON.stringify({state:initial,settings:savedSettings??{sound:false,trainingEnabled:true,bestTraining:0}})]]);
 class Node {
  constructor(id=''){this.id=id;this._html='';this.textContent='';this.style={};this.dataset={};this.events={};this.disabled=false;this.open=false;this.children=[];this.attrs={};this.classes=new Set();this.classList={add:(...a)=>a.forEach(v=>this.classes.add(v)),remove:(...a)=>a.forEach(v=>this.classes.delete(v)),toggle:(a,v)=>v===undefined?(this.classes.has(a)?this.classes.delete(a):this.classes.add(a)):(v?this.classes.add(a):this.classes.delete(a)),contains:a=>this.classes.has(a)};}
  set innerHTML(v){this._html=String(v);for(const [id,n] of nodes)if(n.owner===this)nodes.delete(id);for(const m of this._html.matchAll(/<[a-z][^>]*\sid="([^"]+)"[^>]*>/g)){const n=new Node(m[1]);n.owner=this;n.disabled=/\sdisabled(?=\s|>)/.test(m[0]);nodes.set(n.id,n);}}
  get innerHTML(){return this._html;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,fn){(this.events[k]??=[]).push(fn);}
  showModal(){this.open=true;}
  close(){this.open=false;}
  querySelector(q){if(q==='h2'&&this._html.includes('<h2'))return new Node();return null;}
  getBoundingClientRect(){return{left:0,right:600,top:0,bottom:600,width:600,height:600};}
  append(n){this.children.push(n);n.parent=this;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
  closest(q){if(q[0]==='['){const name=q.slice(1,-1).replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return name in this.dataset?this:null;}return null;}
 }
 for(const id of ids)nodes.set(id,new Node(id));
 const panel=new Node('panel');
 const document={getElementById:id=>nodes.get(id)??null,createElement:()=>new Node(),querySelector:q=>q==='.command-panel'?panel:new Node()};
 const ctx=vm.createContext({...E,chooseAiAttack:chooseAiAttack??E.chooseAiAttack,icon:()=>'<i></i>',portrait:()=>'<svg></svg>',castleArt:()=>'<svg></svg>',landscape:'<svg></svg>',document,console:{...console,error:e=>errors.push(e.message)},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},setTimeout:(fn,ms)=>{timers.set(++tid,{fn,due:time+ms});return tid},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{frames.set(++rid,fn);return rid},cancelAnimationFrame:id=>frames.delete(id),performance:{now:()=>time},window:{addEventListener:()=>{}},Date,Math});
 vm.runInContext(app,ctx);
 const run=js=>vm.runInContext(js,ctx);
 function advance(ms){const end=time+ms;let count=0;while(true){const next=[...timers].filter(([,t])=>t.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;if(++count>2000)throw Error('Timer runaway');time=next[1].due;timers.delete(next[0]);next[1].fn();}time=end;return count;}
 const read=()=>copy(run('({state,selectedHero,selectedMode,selectedTarget,selectedDefense,busy,finishShown,settings,modalGeneration,generation})'));
 function click(id,dataset={}){const target=Object.keys(dataset).length?new Node():nodes.get(id);target.dataset=dataset;for(const fn of nodes.get(id).events.click??[])fn({target,clientX:10,clientY:10});}
 return {run,advance,read,click,nodes,timers,frames,store,errors};
}
const tests=[];function test(name,fn){try{const result=fn();tests.push({name,pass:true,...(result?{result}:{})});}catch(e){tests.push({name,pass:false,error:e.stack});}}

test('attack selection and rapid double submit',()=>{const h=harness();h.click('arena',{castle:'left',side:'player'});h.click('command-content',{mode:'quick'});h.click('arena',{castle:'left',side:'enemy'});assert.equal(h.nodes.get('action-button').disabled,false);assert.match(h.nodes.get('move-preview').innerHTML,/8–38/);h.click('action-button');const once=h.read();h.click('action-button');assert.deepEqual(h.read(),once);assert.equal(once.state.phase,'aiDefense');assert.equal(once.state.energy.player,E.createGame().energy.player-1);h.advance(10000);assert(['playerDefense','playerAttack'].includes(h.read().state.phase));assert.equal(h.errors.length,0);return{phase:h.read().state.phase};});

test('player preparation skips enemy defense then accepts incoming defense',()=>{const h=harness({chooseAiAttack:s=>E.applyAttack(s,'enemy',{attackId:'ilda:quick',targetId:'right'})});h.run("selectedHero='kora';selectedMode='prepare';render();takeAction();");assert.equal(h.read().state.phase,'aiAttack');assert.equal(h.read().state.pendingAttack,null);assert.equal(h.read().state.energy.player,Math.min(6,E.createGame().energy.player+2));h.advance(1000);assert.equal(h.read().state.phase,'aiAttack');h.advance(650);assert.equal(h.read().state.phase,'playerDefense');assert.equal(h.read().busy,false);assert.match(h.nodes.get('battle-center').innerHTML,/ham hasar/);assert.equal(h.errors.length,0);});

test('enemy preparation skips player defense and clears selection',()=>{const h=harness({initial:E.createGame({firstSide:'enemy'}),chooseAiAttack:s=>E.applyAttack(s,'enemy',{attackId:'neris:prepare'})});h.advance(650);assert.equal(h.read().state.phase,'playerAttack');assert.equal(h.read().busy,true);h.advance(1000);assert.equal(h.read().busy,false);assert.equal(h.read().state.pendingAttack,null);assert.equal(h.read().selectedHero,null);assert.match(h.nodes.get('round-number').innerHTML,/data-basic/);assert.equal(h.errors.length,0);});

test('zero energy plus every hero fatigued can still use basic',()=>{const s=E.createGame();s.energy.player=0;for(const hero of Object.values(s.heroes.player))hero.readyAt=10;const h=harness({initial:s});assert.match(h.nodes.get('round-number').innerHTML,/data-basic/);h.click('round-number',{basic:''});assert.equal(h.read().selectedMode,'basic');h.click('arena',{castle:'left',side:'enemy'});assert.equal(h.nodes.get('action-button').disabled,false);h.click('action-button');assert.equal(h.read().state.phase,'aiDefense');assert.equal(h.read().state.pendingAttack.damage,18);assert.equal(h.read().state.energy.player,0);assert.equal(h.read().state.heroes.player.kora.readyAt,10);});

test('zero energy fatigued defense always defaults to free brace',()=>{let s=E.createGame({firstSide:'enemy'});s.energy.enemy=4;s=E.applyAttack(s,'enemy',{attackId:'kora:heavy',targetId:'left'});s.energy.player=0;for(const hero of Object.values(s.heroes.player))hero.readyAt=10;const h=harness({initial:s});assert.equal(h.read().selectedDefense,'brace');assert.equal(h.nodes.get('action-button').disabled,false);assert.match(h.nodes.get('command-content').innerHTML,/data-defense="brace"\s+\s*aria-pressed="true"/);h.click('action-button');h.click('action-button');h.advance(1470);assert.equal(h.read().state.castles.player[0].hp,176);assert.equal(h.read().state.phase,'playerAttack');assert.equal(h.errors.length,0);});

test('modal pauses pending AI work and resumes once closed',()=>{const h=harness({initial:E.createGame({firstSide:'enemy'})});h.run('help()');const before=h.read().state;h.advance(6000);assert.deepEqual(h.read().state,before);assert.equal(h.read().busy,true);h.run('closeModal()');h.advance(2000);assert.notEqual(h.read().state.phase,'aiAttack');assert.equal(h.errors.length,0);});

test('restart cancels old battle timers and prevents stale old attack',()=>{const h=harness();h.run("state.energy.player=4;selectedHero='kora';selectedMode='heavy';selectedTarget='left';takeAction();");h.advance(500);assert(h.timers.size>0);h.run('newGame()');const seed=h.read().state.seed;h.advance(10000);assert.equal(h.read().state.seed,seed);assert.equal(h.read().state.castles.enemy[0].hp,240);assert.equal(h.read().state.castles.player[0].hp,240);assert.equal(h.errors.length,0);});

test('completed training result cannot replace reopened settings',()=>{const h=harness();h.run('training();trainingHit()');h.advance(350);h.run('trainingHit()');h.advance(350);h.run('trainingHit();closeModal();settingsModal()');const html=h.nodes.get('modal-content').innerHTML;h.advance(1000);assert.equal(h.nodes.get('modal-content').innerHTML,html);assert.equal(h.read().settings.bestTraining,3);assert.match(html,/Düello ayarları/);});

test('close/reopen training ignores previous unlock timer',()=>{const h=harness();h.run('training();trainingHit();closeModal();training();trainingHit()');assert.equal(h.run('trainingSession.lock'),true);h.advance(349);assert.equal(h.run('trainingSession.lock'),true);h.advance(1);assert.equal(h.run('trainingSession.lock'),false);assert.equal(h.run('trainingSession.scores.length'),1);});

test('refresh all normal phases rehydrates and does not duplicate committed damage',()=>{const base=E.createGame();const attack=E.playerAttack(base,{attackId:'kora:quick',targetId:'left'});const aiAttack=E.resolveAiDefense(attack);const defense=E.applyAttack(aiAttack,'enemy',{attackId:'ilda:quick',targetId:'right'});const phases=[base,attack,aiAttack,defense];const out=[];for(const s of phases){const h=harness({initial:s});assert.equal(h.read().state.phase,s.phase);h.advance(10000);assert.equal(h.errors.length,0);assert(['playerAttack','playerDefense'].includes(h.read().state.phase));const hp=h.read().state.castles.enemy[0].hp;assert.equal(hp,s.phase==='aiDefense'?E.resolveAiDefense(s).castles.enemy[0].hp:s.castles.enemy[0].hp);out.push(s.phase+' → '+h.read().state.phase);}return out;});

test('defense UI matches engine HP and post-cost energy including disrupt',()=>{let s=E.applyAttack(E.createGame({firstSide:'enemy'}),'enemy',{attackId:'kora:disrupt',targetId:'left'});s.energy.player=3;s.castles.player[0].hp=9;const h=harness({initial:s});const pv=E.previewDefense(s,'brace');const html=h.nodes.get('move-preview').innerHTML;assert.match(html,new RegExp(`3 → ${pv.energyAfter}⚡`));assert.match(html,/9 → 0/);h.click('action-button');h.advance(520);assert.equal(h.read().state.castles.player[0].hp,0);assert.equal(h.errors.length,0);return{hpPreview:0,postCostPreview:pv.energyAfter,actualStateEnergy:h.read().state.energy.player};});

test('training applies only on new duel and can be disabled',()=>{const h=harness();h.run('training();trainingHit()');h.advance(350);h.run('trainingHit()');h.advance(350);h.run('trainingHit()');assert.equal(h.read().state.training.power,0);assert.equal(h.read().settings.bestTraining,3);h.run('newGame()');assert.equal(h.read().state.training.power,3);h.run('settings.trainingEnabled=false;newGame()');assert.equal(h.read().state.training.power,0);const refreshed=harness({storage:h.store});assert.equal(refreshed.read().settings.bestTraining,3);assert.equal(refreshed.read().state.training.power,0);});


test('observe defense preview post-cost energy versus next attack regeneration',()=>{let s=E.createGame();s.energy.player=4;s=E.playerAttack(s,{attackId:'kora:heavy',targetId:'left'});s=E.resolveAiDefense(s);s=E.applyAttack(s,'enemy',{attackId:'ilda:quick',targetId:'right'});const h=harness({initial:s});const pv=E.previewDefense(s,'brace');h.click('action-button');h.advance(1470);return{renderedPreview:'0 → '+pv.energyAfter+'⚡',actualNextEnergy:h.read().state.energy.player,phase:h.read().state.phase,note:'This is post-defense energy before regeneration, not next-state energy.'};});

test('corrupt v2 save missing trainingBySide is rejected before render',()=>{const s=E.createGame();delete s.trainingBySide;const h=harness({initial:s});h.click('arena',{castle:'left',side:'player'});assert.equal(h.errors.length,0);});

test('stale training result cannot replace new game or later training',()=>{const h=harness();h.run('training();trainingHit()');h.advance(350);h.run('trainingHit()');h.advance(350);h.run('trainingHit();newGame();training()');const html=h.nodes.get('modal-content').innerHTML;h.advance(1500);assert.equal(h.nodes.get('modal-content').innerHTML,html);assert.equal(h.run('trainingSession.scores.length'),0);});

test('refresh after resolved damage does not apply damage again',()=>{const h=harness();h.run("selectedHero='kora';selectedMode='quick';selectedTarget='left';takeAction()");h.advance(1020);const before=h.read().state;const fresh=harness({storage:h.store});fresh.advance(10000);assert.deepEqual(fresh.read().state.castles,before.castles);assert.equal(fresh.errors.length,0);});


test('victory modal shown once and finished refresh remains playable',()=>{let s=E.createGame();s.energy.player=4;s.castles.enemy[0].hp=0;s.castles.enemy[1].hp=1;const h=harness({initial:s});h.run("selectedHero='kora';selectedMode='heavy';selectedTarget='main';takeAction()");h.advance(3000);assert.equal(h.read().state.phase,'finished');assert.equal(h.nodes.get('modal').open,true);assert.match(h.nodes.get('modal-content').innerHTML,/Krallık güvende/);h.run('closeModal();drive()');h.advance(1000);assert.equal(h.nodes.get('modal').open,false);const fresh=harness({storage:h.store});assert.equal(fresh.read().state.phase,'finished');assert.equal(fresh.nodes.get('action-button').disabled,false);fresh.click('action-button');assert.notEqual(fresh.read().state.phase,'finished');});

test('surviving main castle cycles all relocated heroes without hiding fallback',()=>{const s=E.createGame();s.castles.player[0].hp=0;s.castles.player[2].hp=0;for(const hero of Object.values(s.heroes.player)){hero.castleId='main';hero.retreatRounds=0;hero.readyAt=0;}const h=harness({initial:s});const result=[];for(let i=0;i<3;i++){h.click('arena',{side:'player',castle:'main'});result.push(h.read().selectedHero);}assert.equal(new Set(result).size,3);assert.match(h.nodes.get('round-number').innerHTML,/data-basic/);return result;});


test('twenty seeded full UI matches reach a single final result',()=>{const results=[];for(let i=0;i<20;i++){const h=harness({initial:E.createGame({seed:'ui-'+i,firstSide:i%2?'enemy':'player'})});let decisions=0;while(h.read().state.phase!=='finished'&&decisions<250){h.advance(5000);const r=h.read();if(r.state.phase==='finished')break;assert.equal(r.busy,false);if(r.state.phase==='playerAttack')h.run("(()=>{const p=selectAttack(state,'player');const a=availableAttacks(state,'player').find(a=>a.id===p.attackId);selectedHero=a.heroId;selectedMode=a.mode;selectedTarget=p.targetId;render();takeAction();})()");else if(r.state.phase==='playerDefense')h.run("selectedDefense=selectDefense(state,'player').defenseId;render();takeAction()");else assert.fail('Unexpected idle phase '+r.state.phase);decisions++;}h.advance(5000);assert.equal(h.read().state.phase,'finished');assert.equal(h.errors.length,0);assert.equal(h.nodes.get('modal').open,true);results.push({seed:i,winner:h.read().state.winner,rounds:h.read().state.round});}return{matches:results.length,playerWins:results.filter(r=>r.winner==='player').length,enemyWins:results.filter(r=>r.winner==='enemy').length,maxRounds:Math.max(...results.map(r=>r.rounds))};});


test('opening defense copy does not promise absent first-attack regeneration',()=>{const s=E.applyAttack(E.createGame({firstSide:'enemy'}),'enemy',{attackId:'ilda:quick',targetId:'right'});const h=harness({initial:s});const next=E.playerDefend(s,{defenseId:'brace'});assert.equal(next.energy.player,s.energy.player);const note=h.nodes.get('action-note').textContent;assert(!note.includes('+3')||note.includes('ilk')||note.includes('İlk'),'Opening defense note incorrectly promises +3: '+note);return note;});


test('newGame alternates initiative across two consecutive rematches',()=>{const h=harness({initial:E.createGame({firstSide:'player'})});assert.equal(h.read().state.firstSide,'player');h.run('newGame()');assert.equal(h.read().state.firstSide,'enemy');assert.equal(h.read().state.energy.enemy,3);assert.equal(h.read().state.energy.player,4);h.run('newGame()');assert.equal(h.read().state.firstSide,'player');assert.equal(h.read().state.energy.player,3);assert.equal(h.read().state.energy.enemy,4);assert.equal(h.errors.length,0);});

test('reload preserves which side starts the next rematch',()=>{const h=harness({initial:E.createGame({firstSide:'player'})});h.run('newGame()');assert.equal(h.read().state.firstSide,'enemy');const refreshed=harness({storage:h.store});assert.equal(refreshed.read().state.firstSide,'enemy');refreshed.run('newGame()');assert.equal(refreshed.read().state.firstSide,'player');assert.equal(refreshed.read().state.energy.player,3);assert.equal(refreshed.read().state.energy.enemy,4);assert.equal(refreshed.errors.length,0);});

console.log(JSON.stringify({tests,summary:{passed:tests.filter(t=>t.pass).length,total:tests.length}},null,2));

if (tests.some(t => !t.pass)) process.exitCode = 1;
