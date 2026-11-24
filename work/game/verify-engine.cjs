'use strict';
const assert = require('node:assert/strict');
global.window = {};
require('./levels.js');
require('./engine.js');
const { MineGame } = window;
function solve(state, limit=10) {
  const board = state.board;
  const goals = state.order;
  const path = [{ x:0, y:3 }];
  const dirs = [[1,0],[0,1],[0,-1],[-1,0]];
  function visit(x,y,visited,edges,counts,spent) {
    const nextCounts = { ...counts };
    const added = new Set(edges);
    for (const [dx,dy] of [...dirs,[1,1],[-1,-1],[1,-1],[-1,1]]) {
      const i = x+dx, j = y+dy;
      const type = board[j]?.[i];
      if (dx && dy && (state.equipped === 'coil' ? type !== 'copper' : state.equipped === 'lens' ? type !== 'crystal' : true)) continue;
      if ((type === 'copper' || type === 'crystal') && !added.has(j*8+i)) {
        nextCounts[type] += state.amounts[j][i];
        added.add(j*8+i);
      }
    }
    if (path.length > 1 && nextCounts.copper >= goals.copper && nextCounts.crystal >= goals.crystal) return path.slice();
    if (spent >= limit) return null;
    for (const [dx,dy] of dirs) {
      const i = x+dx, j = y+dy;
      const price = state.rubble?.some(p=>p.x===i&&p.y===j)?2:1;
      if (spent + price > limit || board[j]?.[i] !== 'ground' || visited.has(j*8+i)) continue;
      visited.add(j*8+i);
      path.push({x:i,y:j});
      const solution = visit(i,j,visited,added,nextCounts,spent+price);
      if (solution) return solution;
      visited.delete(j*8+i);
      path.pop();
    }
    return null;
  }
  return visit(0,3,new Set([24]),new Set(),{copper:0,crystal:0},0);
}
function relicRoute(state) {
  const relic=state.relic;
  if(!relic)return null;
  const queue=[[{x:0,y:3}]], costs=[0], visited=new Set();
  while(queue.length) {
    let next=costs.indexOf(Math.min(...costs));
    const path=queue.splice(next,1)[0], spent=costs.splice(next,1)[0];
    const p=path[path.length-1], mark=8*p.y+p.x;
    if(visited.has(mark))continue;
    visited.add(mark);
    if(spent && Math.abs(p.x-relic.x)+Math.abs(p.y-relic.y)===1)return path;
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]) {
      const x=p.x+dx,y=p.y+dy, id=8*y+x;
      const extra=state.rubble.some(r=>r.x===x&&r.y===y)?2:1;
      if(state.board[y]?.[x]!=='ground'||visited.has(id)||spent+extra>state.stage.budget)continue;
      queue.push([...path,{x,y}]);costs.push(spent+extra);
    }
  }
  return null;
}
function fakeStorage() {
  const m = new Map();
  return {getItem:k => m.get(k)||null, setItem:(k,v)=>m.set(k,v)};
}
function win(g) {
  const par=g.par();
  assert.ok(par>=1 && par<=g.state.stage.budget);
  assert.equal(g.par(),par);
  assert.equal(solve(g.state,par-1),null);
  const solution = solve(g.state,par);
  assert.ok(solution, 'order reachable with 10 rails');
  const previous = {...g.state.wallet};
  for (const p of solution.slice(1)) assert.ok(g.move(p.x,p.y).ok);
  const preview = g.preview();
  const collected={copper:0,crystal:0};
  const ores = preview.steps.flatMap(p=>p.ores.map(q=>{
    assert.equal(q.amount,g.state.amounts[q.y][q.x]);
    collected[q.type]+=q.amount;
    return 8*q.y+q.x;
  }));
  assert.equal(preview.copper,collected.copper);
  assert.equal(preview.crystal,collected.crystal);
  assert.equal(new Set(ores).size,ores.length);
  assert.equal(g.used(),par);
  const {ok,result}=g.dispatch();
  assert.ok(ok&&result.met);
  assert.equal(g.state.wallet.copper, previous.copper + preview.copper);
  assert.equal(g.state.wallet.crystal, previous.crystal + preview.crystal);
  assert.equal(g.state.wallet.plans, previous.plans + (result.card.isNew ? 0 : 1));
  assert.equal(g.dispatch().ok,false);
  if(result.dig==='pending'){
    assert.ok(!g.next().ok);assert.ok(!g.visit(1).ok);
    assert.ok(g.resolveDig(false).ok);
    assert.equal(g.state.result.dig,'miss');
  }
  if (g.state.round<=10) assert.ok(g.state.gold.includes(g.state.round));
}
let maps = 0;
const distinct = new Set();
for(let seed = 0;seed<100;seed++) {
  const g=MineGame.create({seed, storage:null});
  assert.equal(g.storageOK,false);
  const encountered=new Set();
  for(let n=0;n<25;n++) {
    const state=g.state;
    assert.equal(state.round,n+1);
    assert.deepEqual(state.path,[{x:0,y:3}]);
    assert.equal(g.dispatch().ok,false);
    assert.equal(g.move(7,6).ok,false);
    assert.ok(g.state.stage.par<=g.state.stage.budget);
    if (n<10) {
      assert.equal(g.state.stage.par,window.MineLevels.stages[n].par);
      assert.equal(g.state.stage.endless,false);
    } else {
      assert.ok(g.state.stage.par>=9);
      assert.ok(g.state.rubble.length>0 && g.state.rubble.every(p=>g.state.board[p.y][p.x]==='ground'));
      assert.ok(g.state.relic);
      const {x,y,id}=g.state.relic;
      assert.equal(g.state.board[y][x],'rock');
      assert.ok(relicRoute(g.state),'optional deep relic accessible at base cost');
      encountered.add(id);
      assert.equal(g.state.stage.endless,true);
      distinct.add(JSON.stringify([g.state.board,g.state.amounts,g.state.order]));
    }
    assert.ok(g.equip(null).ok);
    assert.equal(g.par(),g.state.stage.par);
    assert.equal(solve(state,g.par()-1),null);
    assert.ok(solve(state,g.par()));
    if (g.state.owned.length) assert.ok(g.equip(g.state.owned[n%g.state.owned.length]).ok);
    win(g);
    assert.ok(g.next().ok);
    maps++;
  }
  assert.equal(encountered.size,window.MineLevels.relics.length);
}
const store=fakeStorage(), g=MineGame.create({seed:33,storage:store});
assert.ok(g.storageOK);
assert.equal(g.undo().ok,false); assert.ok(g.move(1,3).ok);
assert.equal(g.move(1,2).ok,false); assert.ok(g.undo().ok);
assert.ok(g.move(1,3).ok); assert.equal(g.move(0,3).ok,true);
win(g);
const won=g.state.result, saved=MineGame.create({storage:store});
assert.deepEqual(saved.state.result,won); assert.equal(saved.dispatch().ok,false);
assert.deepEqual(saved.state.wallet,g.state.wallet);
assert.ok(saved.next().ok);
assert.equal(g.next().ok,false);
assert.equal(g.state.round,2);
assert.ok(g.equip(won.card.id).ok);
for(let i=0;i<12;i++) {
  win(g); assert.ok(g.next().ok);
}
const preup={...g.state.wallet}, before=g.state.budget;
assert.ok(g.upgrade().ok); assert.equal(g.state.budget,before+1);
assert.equal(g.state.wallet.copper,preup.copper-4);
assert.equal(g.state.wallet.crystal,preup.crystal-1);
assert.ok(g.upgrade().ok); assert.ok(g.upgrade().ok);
assert.equal(g.upgrade().ok,false);
assert.equal(g.redeem(g.state.owned[0]).ok,false);
for (const card of MineGame.cards) {
  assert.ok(g.equip(card.id).ok);
  assert.equal(g.state.budget,g.state.stage.budget+3+(card.id==='long'?2:0));
  const p = [{x:1,y:3},{x:0,y:2},{x:0,y:4}].find(p=>g.state.board[p.y][p.x]==='ground');
  assert.ok(g.move(p.x,p.y).ok);
  assert.equal(g.equip(null).ok,false);
  assert.ok(g.undo().ok);
}
console.log('Verified paths and unique rewards on '+maps+' maps, inventory, upgrade caps, card effects, undo, concurrent/stale and reload paths.');
let redeemed=false;
for (let seed=0; seed<100 && !redeemed; seed++) {
  const g=MineGame.create({seed,storage:null});
  for(let n=0;n<12 && !redeemed;n++) {
    win(g);
    const missing=MineGame.cards.find(c=>!g.state.owned.includes(c.id));
    if (missing && g.state.wallet.plans>=MineGame.redeemCost) {
      const old=g.state.wallet.plans;
      assert.ok(g.redeem(missing.id).ok);
      assert.equal(g.state.wallet.plans,old-MineGame.redeemCost);
      assert.equal(g.redeem(missing.id).ok,false);
      assert.ok(g.next().ok); assert.ok(g.equip(missing.id).ok);
      redeemed=true; break;
    }
    assert.ok(g.next().ok);
  }
}
assert.ok(redeemed);
assert.ok(distinct.size>500,'deep stages vary across seeds');
console.log('Unique deep maps:',distinct.size);
const disk=fakeStorage();
const g1=MineGame.create({storage:disk,seed:7});
for (let n=0;n<5;n++) {
  win(g1);
  assert.ok(g1.next().ok);
}
const lostStore={getItem(){return null;},setItem(){throw new Error('full');}};
const g2=MineGame.create({storage:lostStore,seed:9});
assert.equal(g2.storageOK,false); win(g2);
// A short delivery credits materials once, leaves the same stage queued, and can be resumed/retried.
const retryStore=fakeStorage();
const retry=MineGame.create({storage:retryStore,seed:99});
for(let n=1;n<4;n++){win(retry);assert.ok(retry.next().ok);}
const originalRound=retry.state.round, originalBoard=JSON.stringify(retry.state.board);
const partial=solve(retry.state,retry.par()).slice(1,-1);
for(const p of partial)assert.ok(retry.move(p.x,p.y).ok);
assert.ok(retry.preview().copper+retry.preview().crystal>0);
assert.ok(!retry.dispatch().result.met);
assert.equal(retry.state.result.card,null);
const walletAfterMiss={...retry.state.wallet};
const restoredMiss=MineGame.create({storage:retryStore});
assert.equal(restoredMiss.dispatch().ok,false);
assert.deepEqual(restoredMiss.state.wallet,walletAfterMiss);
if(restoredMiss.state.result.dig==='pending')assert.ok(restoredMiss.resolveDig(false).ok);
assert.ok(restoredMiss.next().ok);
assert.equal(restoredMiss.state.round,originalRound);
assert.equal(JSON.stringify(restoredMiss.state.board),originalBoard);
assert.deepEqual(restoredMiss.state.wallet,walletAfterMiss);
win(restoredMiss); assert.ok(restoredMiss.next().ok); assert.equal(restoredMiss.state.round,originalRound+1);

// Fixed old-game snapshots, including a settled reward, must migrate exactly once.
for(const phase of ['plan','done']) {
  const legacy=fakeStorage();
  const old={version:1,seed:123,round:7,wallet:{copper:90,crystal:43,plans:4},
    owned:['long','coil'],equipped:'long',upgrades:2,
    phase,path:[{x:0,y:3},{x:1,y:3}],reward:phase==='done'?{id:'coil',isNew:false}:null};
  legacy.setItem('huicheng-minecart.save.v1',JSON.stringify(old));
  const migrated=MineGame.create({storage:legacy});
  assert.equal(migrated.state.round,1);assert.equal(migrated.state.phase,'plan');
  assert.deepEqual(migrated.state.wallet,old.wallet);
  assert.deepEqual(migrated.state.owned,old.owned); assert.equal(migrated.state.equipped,'long');
  assert.equal(migrated.state.upgrades,2);
  assert.equal(migrated.state.budget,migrated.state.stage.budget+4);
  assert.equal(migrated.state.result,null);
  assert.ok(migrated.redeem('lens').ok); assert.equal(migrated.state.wallet.plans,1);
  assert.ok(migrated.move(1,3).ok);
  const reloaded=MineGame.create({storage:legacy});
  assert.deepEqual(reloaded.state.path,migrated.state.path); assert.equal(reloaded.state.wallet.plans,1);
  assert.deepEqual(reloaded.state.owned,['long','coil','lens']);
}
for(const bad of ['{','{}','[]','{"version":1,"seed":2}']) {
  const storage=fakeStorage();
  storage.setItem('huicheng-minecart.save.v1', bad);
  const g=MineGame.create({seed:2,storage});
  assert.equal(g.state.round,1);
  assert.ok(g.move(1,3).ok);
  const restored=MineGame.create({storage});
  assert.deepEqual(restored.state.path,g.state.path);
}
const first=MineGame.create({seed:0,storage:null});
console.log('Verified redemption with earned duplicate cards, malformed/quota-limited storage, and first-map par '+first.par()+'.');
// Exercise authentic v2 journeys from the previously delivered engine (including deep generated maps).
const fs=require('node:fs'),vm=require('node:vm');
const oldWindow={};
vm.runInNewContext(fs.readFileSync(__dirname+'/legacy-v2-fixture.cjs','utf8'),{window:oldWindow});
const plain=x=>JSON.parse(JSON.stringify(x));
for(let seed=0;seed<12;seed++){
  const src=fakeStorage(), old=oldWindow.MineGame.create({storage:src,seed});
  for(let round=1; round<=22;round++){
    const path=solve(old.state,old.par());
    for(const p of path.slice(1))assert.ok(old.move(p.x,p.y).ok);
    for(const phase of ['plan','done']){
      if(phase==='done') assert.ok(old.dispatch().ok);
      const db=fakeStorage();
      db.setItem('huicheng-minecart.save.v2',src.getItem('huicheng-minecart.save.v2'));
      const g=MineGame.create({storage:db});
      assert.equal(g.state.legacyTrip,true);assert.equal(g.state.round,round);
      assert.equal(g.state.frontier,round+(phase==='done'?1:0));
      assert.deepEqual(g.state.path,plain(old.state.path));
      assert.deepEqual(g.state.board,plain(old.state.board));
      assert.deepEqual(g.state.rubble,[]);
      assert.equal(g.used(),old.state.path.length-1);
      assert.deepEqual(g.state.wallet,plain(old.state.wallet));assert.deepEqual(g.state.owned,plain(old.state.owned));
      assert.equal(g.par(),old.par());
      if(phase==='done'){
        assert.equal(g.state.result.dig,'none');assert.equal(g.state.result.met,old.state.result.met);
        assert.deepEqual(g.state.result.card,plain(old.state.result.card));
        assert.equal(g.dispatch().ok,false);
      }
      const restored=MineGame.create({storage:db});
      assert.deepEqual(restored.state,g.state);
      if(phase==='done'){
        assert.ok(g.next().ok); assert.equal(g.state.legacyTrip,false);assert.equal(g.state.round,round+1);
      }
    }
    assert.ok(old.next().ok);
  }
}
console.log('528 genuine v2 mid-track and settled journeys retained exact maps, paths, payouts and progress.');
function lay(g, coords) {
  for (const [x,y] of coords) assert.ok(g.move(x,y).ok);
}
const digDb=fakeStorage();
let digGame=MineGame.create({seed:11,storage:digDb});
const digRoute=[[1,3],[2,3],[2,2],[2,1]];
assert.equal(digGame.state.frontier,1);
assert.ok(!digGame.visit(2).ok);
lay(digGame,digRoute);
assert.ok(!digGame.visit(1).ok);
assert.equal(digGame.preview().relicStep,0);
const firstTrip=digGame.dispatch().result;
assert.ok(firstTrip.met && firstTrip.firstClear && firstTrip.card && firstTrip.dig==='pending');
assert.equal(digGame.state.frontier,2);
assert.equal(digGame.state.bestRails[1],4);assert.deepEqual(digGame.state.gold,[]);
assert.ok(!digGame.next().ok);assert.ok(!digGame.visit(1).ok);
digGame=MineGame.create({storage:digDb});
assert.equal(digGame.state.result.dig,'pending');
const walletBeforeDig={...digGame.state.wallet};
assert.ok(digGame.resolveDig(false).ok);assert.ok(digGame.resolveDig(false).ok);
assert.ok(!digGame.resolveDig(true).ok);assert.deepEqual(digGame.state.collection,[]);
assert.deepEqual(digGame.state.wallet,walletBeforeDig);
assert.ok(digGame.visit(1).ok);
lay(digGame,[[1,3]]);
const previousPlans=digGame.state.wallet.plans;
const revisit=digGame.dispatch().result;
assert.ok(revisit.met && !revisit.firstClear && revisit.card===null && revisit.dig==='none');
assert.equal(digGame.state.wallet.plans,previousPlans);
assert.equal(digGame.state.bestRails[1],1);assert.deepEqual(digGame.state.gold,[1]);
assert.ok(digGame.next().ok);assert.equal(digGame.state.round,2);
assert.ok(digGame.visit(1).ok);
lay(digGame,digRoute);assert.equal(digGame.dispatch().result.dig,'pending');
assert.ok(digGame.resolveDig(true).ok);assert.ok(digGame.resolveDig(true).ok);assert.ok(!digGame.resolveDig(false).ok);
assert.deepEqual(digGame.state.collection,['fern']);
digGame=MineGame.create({storage:digDb});assert.deepEqual(digGame.state.collection,['fern']);assert.equal(digGame.state.result.dig,'found');
assert.equal(digGame.state.bestRails[1],1);assert.deepEqual(digGame.state.gold,[1]);
assert.ok(digGame.visit(1).ok);lay(digGame,digRoute);assert.equal(digGame.dispatch().result.dig,'none');
assert.ok(digGame.next().ok);assert.equal(digGame.state.round,2);
win(digGame);assert.ok(digGame.next().ok);
assert.equal(digGame.trackCost(1,3),2);lay(digGame,[[1,3]]);
assert.equal(digGame.used(),2);assert.ok(digGame.undo().ok);assert.equal(digGame.used(),0);
assert.ok(digGame.move(1,3).ok);assert.ok(digGame.move(0,3).ok);assert.equal(digGame.used(),0);
console.log('Verified pending and resolved dig reloads, idempotent dig success/skip, free reruns, first-clear frontier, personal best/gold, weighted undo.');
const independent=MineGame.create({seed:9, storage:null});
let uncovered=false;
for(let i=0;i<25&&!uncovered;i++){
  const path=relicRoute(independent.state);
  if(path && !independent.state.collection.includes(independent.state.relic.id)){
    for(const p of path.slice(1)) assert.ok(independent.move(p.x,p.y).ok);
    const preview=independent.preview();
    if(preview.copper<independent.state.order.copper||preview.crystal<independent.state.order.crystal){
      const level=independent.state.round; const id=independent.state.relic.id;
      const {result}=independent.dispatch();
      assert.equal(result.met,false);assert.equal(result.card,null);assert.equal(result.dig,'pending');
      assert.ok(independent.resolveDig(true).ok);assert.ok(independent.next().ok);
      assert.equal(independent.state.round,level);assert.ok(independent.state.collection.includes(id));
      uncovered=true;break;
    }
    while(independent.used())assert.ok(independent.undo().ok);
  }
  win(independent);assert.ok(independent.next().ok);
}
assert.ok(uncovered);
console.log('All 1500 sampled deep relics reachable with base budget, all three relic IDs at every seed, and recovery without order completion verified.');
const mineDb=fakeStorage();
let traveler=MineGame.create({seed:222,storage:mineDb});
const mapFields=state=>MineGame.rules.surveyMap(state);
assert.equal(traveler.state.surveyTickets,1);
let rawPlan=mineDb.getItem('huicheng-minecart.save.v3');
let ahead=traveler.scout(1);
assert.ok(ahead.ok);assert.equal(ahead.number,2);assert.equal(traveler.scout(2).locked,true);
assert.equal(rawPlan,mineDb.getItem('huicheng-minecart.save.v3'));
assert.equal(traveler.scout(3).ok,false);
let ticketMap=traveler.revealScout();assert.equal(ticketMap.number,3);assert.ok(ticketMap.ok);
assert.equal(traveler.state.surveyTickets,0);
assert.deepEqual(traveler.revealScout().map,ticketMap.map);assert.equal(traveler.state.surveyTickets,0);
traveler=MineGame.create({storage:mineDb});
assert.ok(traveler.scout(2).ok);assert.equal(traveler.state.surveyTickets,0);
win(traveler);
const firstCard=traveler.state.result.card.id;
const beforePlanning={...traveler.state.wallet};assert.ok(traveler.prepareEquip(firstCard,2).ok);
assert.equal(traveler.state.equipped,null);assert.equal(traveler.state.plannedEquipment[2],firstCard);
const afterPlanning=MineGame.create({storage:mineDb});assert.equal(afterPlanning.state.plannedEquipment[2],firstCard);
assert.deepEqual(afterPlanning.state.wallet,beforePlanning);assert.equal(afterPlanning.state.equipped,null);
traveler=afterPlanning;assert.ok(traveler.next().ok);
assert.deepEqual(mapFields(traveler.state),ahead.map);assert.equal(traveler.state.equipped,firstCard);
assert.equal(traveler.state.plannedEquipment[2],undefined);assert.equal(traveler.scout(2).locked,true);
assert.deepEqual(traveler.scout(1).map,ticketMap.map);
assert.ok(traveler.prepareEquip(null).ok);win(traveler);assert.ok(traveler.next().ok);
assert.equal(traveler.state.equipped,null);assert.ok(traveler.state.surveyTickets===0);
assert.deepEqual(mapFields(traveler.state),ticketMap.map);
win(traveler);assert.ok(traveler.state.result.ticketEarned);assert.equal(traveler.state.surveyTickets,1);
assert.ok(traveler.visit(3).ok);
const route3=solve(traveler.state,traveler.par());
for(const p of route3.slice(1))assert.ok(traveler.move(p.x,p.y).ok);
assert.ok(traveler.dispatch().result.met);assert.equal(traveler.state.result.ticketEarned,false);
if(traveler.state.result.dig==='pending')traveler.resolveDig(false);
assert.equal(traveler.state.surveyTickets,1);assert.ok(traveler.next().ok);
for(let level=4;level<=16;level++){
 assert.equal(traveler.state.round,level);
 const expected=traveler.scout(1).map;
 win(traveler);assert.equal(traveler.state.result.ticketEarned,level%3===0);
 assert.ok(traveler.next().ok);
 assert.deepEqual(mapFields(traveler.state),expected,'static/deep map matches preview');
}
assert.ok(traveler.visit(1).ok);
const prevTickets=traveler.state.surveyTickets;
assert.equal(traveler.revealScout().number,3);assert.equal(traveler.state.surveyTickets,prevTickets);
console.log('Campaign scout: immutable previews, one-time reveal, ticket cadence, revisits, preselected gear, 10 fixed stages and deep forecasts verified.');
