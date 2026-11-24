'use strict';
const assert = require('node:assert/strict');
global.window={}; require('./levels.js'); require('./express-maps.js'); require('./engine.js'); require('./express.js');
const {MineExpress:E}=window;
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
function storage() {
  const m=new Map();
  return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};
}
function harness(seed=42) {
  let time=100000;
  const db=storage();
  const make=()=>E.create({seed,storage:db,now:()=>time});
  return {db,t:(delta)=>{time+=delta;},make,e:make()};
}
function bestRoute(s, limit=s.budget, requireRebar=null, requireJade=null) {
  let best=null, bestValue=-1;
  const used=new Set([24]),route=[];
  function dfs(x,y,remaining,ore) {
    const mined = new Map(ore);
    for (const [dx,dy] of dirs) {
      const a=x+dx,b=y+dy,type=s.board[b]?.[a];
      if(type==='copper'||type==='crystal')mined.set(b*8+a,[type,s.amounts[b][a]]);
    }
    const bag={copper:0,crystal:0}; for(const [type,amount] of mined.values())bag[type]+=amount;
    const fare=bag.copper*2+bag.crystal*4;
    const hitsSeam=Boolean(s.oddity && mined.has(s.oddity.y*8+s.oddity.x));
    const hitsJade=Boolean(s.jade && mined.has(s.jade.y*8+s.jade.x));
    if(route.length && (requireRebar===null || hitsSeam===requireRebar) &&
       (requireJade===null || hitsJade===requireJade) &&
       bag.copper>=s.order.copper && bag.crystal>=s.order.crystal && fare>bestValue) {
      best=route.slice(); bestValue=fare;
    }
    for(const [dx,dy] of dirs) {
      const a=x+dx,b=y+dy,k=b*8+a;
      if(s.board[b]?.[a]!=='ground'||used.has(k))continue;
      const cost=s.rubble.some(p=>p.x===a&&p.y===b)?2:1;
      if(cost>remaining)continue;
      used.add(k);route.push([a,b]);
      dfs(a,b,remaining-cost,mined);
      used.delete(k);route.pop();
    }
  }
  dfs(0,3,limit,new Map());
  return {route:best,value:bestValue};
}
function lay(e, route) {for(const [x,y] of route)assert.ok(e.move(x,y).ok);}
function settleStone(e,choice='sell'){
  if(e.state.result?.jade!=='pending')return 0;
  const {ok,amount}=e.resolveJade(choice);assert.ok(ok);return amount;
}
function win(e,timeout=false,h=null) {
  const s=e.state;const {route,value}=bestRoute(s);assert.ok(route);
  lay(e,route);
  const got=e.preview();assert.equal(got.copper*2+got.crystal*4,value);
  if(timeout)h.t(e.remaining());
  const result=timeout?e.tick():e.dispatch();
  assert.ok(result.ok);assert.equal(result.expired,timeout);
  assert.equal(result.result.met,true);assert.equal(result.result.timeout,timeout);
  assert.equal(result.result.fare,value*(s.bonus==='double'?2:1));
  assert.ok(!e.dispatch().ok);
  return result.result.fare+settleStone(e);
}
const seen=new Set(); let journeys=0;
for(let seed=0;seed<50;seed++){
  const h=harness(seed); const e=h.e; let lastIndex=null;
  for(let round=0;round<4;round++){
    if(lastIndex!==null)assert.notEqual(e.state.firstIndex,lastIndex);
    lastIndex=e.state.firstIndex;
    const initial=e.state.coins;let sum=0;
    for(let station=1;station<=3;station++){
      assert.equal(e.state.station,station);assert.equal(e.state.started,false);
      assert.equal(e.remaining(),[24000,21000,18000][station-1]);h.t(4000);assert.ok(!e.tick().expired);
      const map=e.state;seen.add(map.stage.name+' '+JSON.stringify(map.board));
      const par=e.par();assert.ok(bestRoute(map,par).route);assert.equal(bestRoute(map,par-1).route,null);
      const next=e.nextStop();sum+=win(e,seed%4===0,h);
      if(station<3){
        assert.equal(e.state.coins,initial);
        assert.equal(e.state.pot,sum); assert.equal(e.state.phase,'offer');
        const bonus=(station+round)%2?'double':'rail';
        assert.ok(e.advance(bonus).ok);
        assert.equal(e.state.budget,next.budget+(bonus==='rail'?1:0)+(e.state.rebarRail?1:0));
        assert.equal(e.state.stage.name,next.name);assert.deepEqual(e.state.order,next.order);
      }
    }
    assert.equal(e.state.phase,'banked');assert.equal(e.state.pot,0);assert.equal(e.state.coins,initial+sum);
    assert.ok(e.state.best>=sum);assert.equal(e.state.settled,sum);
    assert.ok(!e.bank().ok); assert.deepEqual(h.make().state.result,e.state.result);
    const previousSeed=e.state.runSeed;
    assert.ok(e.restart().ok); assert.equal(e.state.lastRunSeed,previousSeed); assert.notEqual(e.state.runSeed,previousSeed);
    journeys++;
  }
}
assert.equal(seen.size,18);
console.log(journeys+' three-stop journeys / 18 template orientations verified for exact par, rates, buffs, restart variety and atomic settlement.');
const h=harness(3);let e=h.e;
h.t(36000);assert.equal(e.remaining(),24000);
assert.equal(e.move(99,99).ok,false);assert.equal(e.state.started,false);
const route=bestRoute(e.state).route;
lay(e,route.slice(0,1));h.t(1000);assert.equal(e.remaining(),23000);
assert.ok(e.undo().ok);assert.equal(e.state.started,true);h.t(250);assert.equal(e.remaining(),22750);
assert.ok(e.pause().ok);h.t(240000);assert.equal(e.remaining(),22750);assert.equal(e.tick().expired,false);
assert.ok(!e.move(...route[0]).ok);
e=h.make();assert.equal(e.remaining(),22750);assert.ok(e.state.paused);
assert.ok(e.resume().ok);h.t(100);assert.equal(e.remaining(),22650);
e=h.make();assert.equal(e.remaining(),22650);
lay(e,route);h.t(22649);assert.equal(e.tick().expired,false);
h.t(1);const atZero=e.dispatch();assert.ok(atZero.ok&&atZero.expired&&atZero.result.met);
assert.equal(e.tick().expired,false);settleStone(e);const pot=e.state.pot;
assert.ok(e.advance('double').ok);const rt=bestRoute(e.state).route;lay(e,rt.slice(0,1));
assert.ok(e.undo().ok);h.t(21000);
const end=e.move(...rt[0]);assert.ok(!end.ok&&end.expired);
assert.equal(e.state.phase,'lost');assert.equal(e.state.lostFare,pot);assert.equal(e.state.result.fare,0);
assert.equal(e.state.coins,0);assert.equal(e.state.pot,0);assert.equal(e.state.best,0);
e=h.make();assert.equal(e.state.lostFare,pot);assert.ok(!e.bank().ok);
assert.ok(e.restart().ok);assert.equal(e.state.lostFare,0);
console.log('Pause/refresh/deadline boundaries, first valid rail timer, undo-to-empty timer, failed cargo loss and non-payment verified.');
const direct=harness(24);const d=direct.e;
const single=win(d);const first=d.bank();assert.ok(first.ok);assert.equal(first.amount,single);
assert.equal(d.state.coins,single);assert.equal(d.state.settled,single);assert.equal(d.state.best,single);
assert.ok(!d.bank().ok);assert.ok(!d.advance('double').ok);
assert.ok(!d.buyPaint('cinnabar').ok);
while(d.state.coins<120){
 assert.ok(d.restart().ok);win(d);assert.ok(d.advance('double').ok);win(d);assert.ok(d.advance('double').ok);win(d);
}
const coins=d.state.coins;assert.ok(d.buyPaint('celadon').ok);assert.equal(d.state.coins,coins-36);
assert.equal(d.state.paint,'celadon');assert.ok(d.buyPaint('celadon').ok);assert.equal(d.state.coins,coins-36);
assert.ok(d.buyPaint('cinnabar').ok);assert.equal(d.state.coins,coins-116);assert.equal(d.state.paint,'cinnabar');
assert.ok(d.equipPaint('standard').ok);assert.equal(d.state.paint,'standard');assert.ok(d.equipPaint('celadon').ok);
const restored=direct.make();assert.equal(restored.state.paint,'celadon');assert.deepEqual(restored.state.paints,d.state.paints);
assert.equal(restored.state.best,d.state.best);assert.equal(restored.state.coins,d.state.coins);
assert.equal(direct.db.getItem('huicheng-minecart.save.v3'),null);
console.log('Early bank, third-station bank, both paints, duplicate purchases, best run and isolated saves verified.');
const stale=harness(17);
stale.db.setItem('huicheng-minecart.save.v3','untouched-main-game');
const a=stale.e;win(a);const b=stale.make();const payday=a.state.pot;
assert.ok(a.bank().ok);assert.ok(!b.bank().ok);assert.equal(b.state.coins,payday);
assert.ok(!b.bank().ok);assert.equal(b.state.coins,payday);
assert.equal(stale.db.getItem('huicheng-minecart.save.v3'),'untouched-main-game');
assert.ok(b.restart().ok);
const rt2=bestRoute(b.state).route;lay(b,rt2);
stale.t(24001);const reopen=stale.make();assert.equal(reopen.remaining(),0);
assert.ok(reopen.tick().result.met);assert.equal(reopen.phase,undefined);
assert.equal(reopen.state.phase,'offer');assert.ok(!reopen.tick().expired);
console.log('Reload while expired and double-bank from concurrent windows checked, preexisting main progression untouched.');
let pickups=0, skipped=0, doubleBoost=0, onSecond=0;
for(let seed=0;seed<20;seed++){
  const h=harness(seed);let e=h.e;
  for(let run=1;run<=6;run++){
    const chosen=e.state.rebarStation;
    assert.ok(chosen===1||chosen===2);if(run===1)assert.equal(chosen,1);
    if(chosen===2)onSecond++;
    let previousFound=false;
    for(let i=1;i<=3;i++){
      const s=e.state;assert.equal(s.rebarRail,previousFound);
      assert.equal(Boolean(s.oddity),i===chosen);
      if(s.oddity){assert.equal(s.oddity.kind,'rebar');assert.equal(s.board[s.oddity.y][s.oddity.x],'copper');}
      assert.deepEqual(h.make().state.oddity,s.oddity);
      let route;
      if(s.oddity){
        const steel=bestRoute(s,s.stage.budget,true).route;assert.ok(steel,'a base budget winning route must include steel');
        const avoid=bestRoute(s,s.stage.budget,false).route;
        if(avoid && seed%3===1){route=avoid;skipped++;}
        else {route=steel;pickups++;}
      }else route=bestRoute(s).route;
      lay(e,route);const predicted=e.preview();
      const {result}=e.dispatch();assert.equal(result.foundRebar,predicted.foundRebar);
      assert.ok(result.met);
      assert.equal(result.fare,(result.copper*2+result.crystal*4)*(s.bonus==='double'?2:1));
      e=h.make();assert.deepEqual(e.state.result,result);settleStone(e);
      previousFound=result.foundRebar;
      if(i<3){
        const selected=(run%2===0||seed===0)?'double':'rail';
        const base=e.nextStop().budget;
        assert.ok(e.advance(selected).ok);
        assert.equal(e.state.budget,base+(selected==='rail'?1:0)+(previousFound?1:0));
        if(selected==='rail'&&previousFound)doubleBoost++;
        e=h.make();assert.equal(e.state.rebarRail,previousFound);
      }
    }
    assert.ok(e.restart().ok);assert.equal(e.state.rebarRail,false);
  }
}
assert.ok(pickups&&skipped&&doubleBoost&&onSecond);
const bankSteel=harness(94), eb=bankSteel.e;
lay(eb,bestRoute(eb.state,eb.state.budget,true).route);
const resultSteel=eb.dispatch().result;assert.equal(resultSteel.foundRebar,true);
const steelDeposit=resultSteel.fare+settleStone(eb);assert.ok(eb.bank().ok);assert.equal(eb.state.coins,steelDeposit);
assert.ok(eb.restart().ok);assert.equal(eb.state.rebarRail,false);
function v1(raw){
  const d=JSON.parse(raw);d.version=1;delete d.oddity;delete d.rebarStation;delete d.rebarRail;
  return JSON.stringify(d);
}
for(const phase of ['untouched','plan','offer','banked']){
  const h=harness(0),e=h.e;
  const route=bestRoute(e.state,e.state.stage.budget,true).route;
  if(phase==='plan')lay(e,route.slice(0,1));
  if(phase==='offer'||phase==='banked'){lay(e,route);e.dispatch();if(phase==='banked'){settleStone(e);e.bank();}}
  const legacy=storage();
  legacy.setItem(E.storageKey,v1(h.db.getItem(E.storageKey)));
  const updated=E.create({storage:legacy,now:()=>100000});
  assert.deepEqual(updated.state.path,e.state.path);assert.equal(updated.state.phase,e.state.phase);
  assert.equal(updated.state.coins,e.state.coins);assert.equal(updated.state.pot,e.state.pot);
  assert.equal(updated.state.rebarRail,false);assert.equal(Boolean(updated.state.oddity),phase==='untouched');
  if(phase==='offer'){assert.equal(updated.state.result.foundRebar,false);assert.ok(updated.advance('rail').ok);
    assert.equal(updated.state.rebarRail,false);assert.equal(updated.state.budget,updated.state.stage.budget+1);}
  if(phase==='banked'){assert.ok(updated.restart().ok);assert.ok([1,2].includes(updated.state.rebarStation));}
}
console.log('Rebar: '+pickups+' pickups, '+skipped+' optional bypasses, '+doubleBoost+' double-rail buffs, '+onSecond+' second-stop occurrences. Price-neutral bank/restart and four v1 migration scenarios verified.');
// Ore value, merchant choice and cash-out are three distinct transactions.
function jadeOffer(e) {
  const route=bestRoute(e.state, e.state.stage.budget, null, true).route;
  assert.ok(route,'jade is accessible while fulfilling the order with the base cart');
  lay(e,route);const goods=e.preview();assert.ok(goods.foundJade);
  const oldPot=e.state.pot;
  const result=e.dispatch().result;
  assert.ok(result.met && result.foundJade);assert.equal(result.jade,'pending');
  assert.equal(result.fare,(goods.copper*2+goods.crystal*4)*(e.state.bonus==='double'?2:1));
  assert.equal(e.state.pot,oldPot+result.fare);
  assert.ok(!e.bank().ok);assert.ok(!e.advance('double').ok);
  return result;
}
function forkRaw(raw,engine=E){
  const db=storage();db.setItem(engine.storageKey,raw);
  return {db,load:()=>engine.create({storage:db,now:()=>100000})};
}
const zeroAlbum={deliveries:0,sold:0,cuts:{20:0,40:0,80:0,100:0}};
const gemstone=harness(404);
assert.deepEqual(gemstone.e.state.album,zeroAlbum);
assert.equal(gemstone.e.state.jadeStation,1);
assert.ok(!gemstone.e.buyPaint('inkjade').ok && !gemstone.e.equipPaint('gilt').ok);
const oreSale=jadeOffer(gemstone.e);
assert.equal(gemstone.e.state.album.deliveries,1);
const sealed=gemstone.db.getItem(E.storageKey);
const leftPot=gemstone.e.state.pot, otherTab=gemstone.make();
assert.equal(gemstone.e.resolveJade('sell').amount,48);
assert.equal(gemstone.e.state.result.fare,oreSale.fare);
assert.equal(gemstone.e.state.pot,leftPot+48);
assert.ok(!otherTab.resolveJade('cut').ok);
assert.equal(otherTab.resolveJade('sell').amount,48);
assert.equal(otherTab.state.pot,leftPot+48);
assert.deepEqual(otherTab.state.album,{...zeroAlbum,deliveries:1,sold:1});
assert.ok(otherTab.state.paints.includes('inkjade'));
assert.equal(otherTab.state.paint,'standard');
assert.ok(otherTab.advance('double').ok);
lay(otherTab,bestRoute(otherTab.state).route.slice(0,1));otherTab.undo();
gemstone.t(21001);assert.equal(otherTab.tick().result.met,false);
assert.equal(otherTab.state.lostFare,leftPot+48);assert.equal(otherTab.state.coins,0);
assert.ok(otherTab.restart().ok);assert.deepEqual(gemstone.make().state.album,{...zeroAlbum,deliveries:1,sold:1});
assert.equal(gemstone.make().state.paints.includes('inkjade'),true);
const fromPending=forkRaw(sealed);
const cutFirst=fromPending.load();const cutAgain=forkRaw(sealed).load();
const outcome=cutFirst.resolveJade('cut').amount;
assert.equal(cutAgain.resolveJade('cut').amount,outcome);
assert.equal(fromPending.load().resolveJade('cut').amount,outcome);
assert.equal(fromPending.load().state.album.cuts[outcome],1);
assert.equal(fromPending.load().state.pot,leftPot+outcome);
assert.ok(!fromPending.load().resolveJade('sell').ok);
assert.ok(cutFirst.bank().ok);assert.equal(cutFirst.state.coins,leftPot+outcome);
assert.equal(fromPending.load().state.coins,cutFirst.state.coins);

// Control only the random bucket for the sealed cut, driving the public transaction for all 100 bins.
const fsv=require('node:fs'), vmv=require('node:vm');
const runSeed=JSON.parse(sealed).runSeed;
const randomRules=window.MineGame.rules;
let bucket=0;
const shadow={MineGame:{rules:{...randomRules,randomFor(k){
  return k===(runSeed^0x7e36d0a1) ? ()=>((bucket+0.5)/100) : randomRules.randomFor(k);
}}},ExpressMaps:window.ExpressMaps};
vmv.runInNewContext(fsv.readFileSync(__dirname+'/express.js','utf8'),{window:shadow});
const gradeCounts={20:0,40:0,80:0,100:0};let gross=0;
for(bucket=0;bucket<100;bucket++){
  const simulated=forkRaw(sealed,shadow.MineExpress);
  const sale=simulated.load().resolveJade('cut');
  assert.ok(sale.ok);gradeCounts[sale.amount]++;gross+=sale.amount;
}
assert.deepEqual(gradeCounts,{20:40,40:25,80:25,100:10});assert.equal(gross/100,E.jadeOffer);

// Earn the three models from real transactions, preserving wallet, rail budget, coat and randomness.
const fleet=harness(1117);let driver=fleet.e, stops=0,gems=0,sawSecond=false,sawAbsent=false,overlap=false;
let fifth=false;
for(let run=1;run<=200;run++){
  const appearance=driver.state.jadeStation;
  if(appearance===2)sawSecond=true;
  if(appearance===0)sawAbsent=true;
  for(let station=1;station<=3;station++){
    const s=driver.state, bonus=s.bonus;
    assert.equal(Boolean(s.jade),appearance===station);
    if(s.jade && s.oddity && s.jade.x===s.oddity.x && s.jade.y===s.oddity.y)overlap=true;
    const route=bestRoute(s,s.budget,null,s.jade?true:null).route;assert.ok(route);
    const savedBefore=s.coins, wear=s.paint, before=driver.state.album.deliveries;
    lay(driver,route);
    const good=driver.preview(),out=driver.dispatch().result;
    assert.ok(out.met);assert.equal(out.fare,(good.copper*2+good.crystal*4)*(bonus==='double'?2:1));
    stops++;assert.equal(driver.state.album.deliveries,before+1);
    assert.equal(driver.state.album.deliveries,stops);
    assert.ok(!driver.dispatch().ok);
    if(stops<5)assert.ok(!driver.state.paints.includes('nightmail'));
    if(stops===5){assert.ok(driver.state.paints.includes('nightmail'));fifth=true;}
    if(out.jade==='pending'){
      const beforePot=driver.state.pot;
      const choice=driver.resolveJade('cut');
      assert.ok(choice.ok);assert.ok([20,40,80,100].includes(choice.amount));
      assert.equal(driver.state.pot,beforePot+choice.amount,'double ticket never multiplies jade');
      assert.equal(driver.state.coins,savedBefore);
      assert.equal(driver.state.paint,wear);
      gems++;
    }
    const progress=E.albumProgress(driver.state.album);
    assert.deepEqual(progress,{delivery:stops,jade:gems,grades:Object.values(driver.state.album.cuts).filter(Boolean).length});
    assert.equal(driver.state.paints.includes('gilt'),progress.grades===4);
    assert.equal(driver.state.paints.includes('inkjade'),gems>=1);
    driver=fleet.make();assert.deepEqual(E.albumProgress(driver.state.album),progress);
    if(station<3)assert.ok(driver.advance('double').ok);
  }
  assert.ok(driver.restart().ok);
  if(gems>8&&E.albumProgress(driver.state.album).grades===4&&sawAbsent&&sawSecond)break;
}
assert.ok(fifth&&sawAbsent&&sawSecond&&driver.state.paints.includes('gilt'));
const fleetCoins=driver.state.coins;
assert.ok(driver.equipPaint('gilt').ok);assert.equal(driver.state.coins,fleetCoins);
assert.equal(fleet.make().state.paint,'gilt');

// Known v3 decision and manifest are migrated once, with old offers never retroactively creating a stone.
for(const choice of ['sell','cut']){
  const clone=forkRaw(sealed),e=clone.load();const pay=e.resolveJade(choice).amount;
  const raw=JSON.parse(clone.db.getItem(E.storageKey));raw.version=3;delete raw.album;
  raw.paints=['standard'];raw.paint='standard';
  const old=forkRaw(JSON.stringify(raw));let g=old.load();
  assert.equal(g.state.album.deliveries,1);assert.equal(g.state.album.sold,choice==='sell'?1:0);
  if(choice==='cut')assert.equal(g.state.album.cuts[pay],1);
  assert.equal(g.state.pot,e.state.pot);assert.ok(g.state.paints.includes('inkjade'));
  assert.ok(g.equipPaint('inkjade').ok);
  assert.deepEqual(old.load().state.album,g.state.album);
  assert.equal(old.load().resolveJade(choice).amount,pay);assert.deepEqual(old.load().state.album,g.state.album);
}
const preJade=JSON.parse(sealed);
preJade.version=2;delete preJade.album;delete preJade.jade;delete preJade.jadeStation;
const prior=forkRaw(JSON.stringify(preJade)),oldOffer=prior.load();
assert.equal(oldOffer.state.jade,null);assert.equal(oldOffer.state.result.jade,'none');
assert.equal(oldOffer.state.album.deliveries,1);assert.deepEqual(oldOffer.state.album.cuts,zeroAlbum.cuts);
assert.ok(!oldOffer.resolveJade('sell').ok);assert.ok(oldOffer.bank().ok);
console.log('Jade: verified all 100 probability bins and a mean of 48; sealed-reroll persistence, concurrent sales, held pot loss, v2/v3 import, and all earned models ('+stops+' deliveries, '+gems+' genuine cuts).');
const scoutTrips=harness(5432);let scoutCar=scoutTrips.e;
for(let run=1;run<=15;run++){
  const budget=scoutCar.state.surveyTickets;assert.equal(budget,1);
  const initialRaw=scoutTrips.db.getItem(E.storageKey);
  const next=scoutCar.scout(1);assert.ok(next.ok);assert.equal(next.number,2);
  assert.equal(scoutCar.scout(2).locked,true);assert.equal(scoutCar.state.surveyTickets,budget);
  assert.equal(scoutTrips.db.getItem(E.storageKey),initialRaw);
  const future=scoutCar.revealScout();assert.ok(future.ok);assert.equal(future.number,3);
  assert.equal(scoutCar.state.surveyTickets,budget-1);assert.deepEqual(scoutCar.revealScout().map,future.map);
  scoutCar=scoutTrips.make();assert.deepEqual(scoutCar.scout(2).map,future.map);
  win(scoutCar);assert.ok(scoutCar.scout(1).ok);assert.deepEqual(scoutCar.scout(2).map,future.map);
  assert.ok(scoutCar.advance('double').ok);assert.deepEqual(window.MineGame.rules.surveyMap(scoutCar.state),next.map);
  assert.deepEqual(scoutCar.scout(1).map,future.map);
  assert.equal(scoutCar.scout(2).locked,false);assert.equal(scoutCar.revealScout().ok,false);
  assert.equal(scoutCar.state.surveyTickets,budget-1);
  win(scoutCar);assert.ok(scoutCar.advance('rail').ok);
  assert.deepEqual(window.MineGame.rules.surveyMap(scoutCar.state),future.map);
  assert.equal(scoutCar.scout(1).ok,false);assert.equal(scoutCar.revealScout().ok,false);
  win(scoutCar);assert.equal(scoutCar.state.result.ticketEarned,true);assert.equal(scoutCar.state.surveyTickets,budget);
  assert.equal(scoutCar.revealScout().ok,false);assert.ok(scoutCar.restart().ok);
}
const plainCrew=harness(184);const profile=JSON.parse(plainCrew.db.getItem(E.storageKey));
profile.album={deliveries:21,sold:9,cuts:{20:2,40:1,80:2,100:1}};
profile.paints=['standard','inkjade','nightmail','gilt'];profile.paint='gilt';
const ornateStore=forkRaw(JSON.stringify(profile));
const simple=plainCrew.e,fancy=ornateStore.load();
for(let runs=0;runs<4;runs++){
  for(let station=1;station<=3;station++){
    assert.equal(simple.state.runSeed,fancy.state.runSeed);
    const geometry=g=>[g.state.board,g.state.amounts,g.state.rubble,g.state.budget,g.state.order,g.state.oddity,g.state.jade,g.par()];
    assert.deepEqual(geometry(simple),geometry(fancy));assert.equal(simple.remaining(),fancy.remaining());
    const route=bestRoute(simple.state).route;
    lay(simple,route);lay(fancy,route);assert.deepEqual(simple.preview(),fancy.preview());
    const a=simple.dispatch().result,b=fancy.dispatch().result;
    assert.equal(a.fare,b.fare);assert.equal(a.foundJade,b.foundJade);
    assert.equal(settleStone(simple,'cut'),settleStone(fancy,'cut'));
    assert.equal(simple.state.coins,fancy.state.coins);assert.equal(simple.state.pot,fancy.state.pot);
    if(station<3){assert.ok(simple.advance('rail').ok);assert.ok(fancy.advance('rail').ok);}
  }
  assert.ok(simple.restart().ok);assert.ok(fancy.restart().ok);
}
console.log('Fast scouting: 15 mirrored runs matched both future maps, one charge per convoy, no last-stop charge, every third delivery award. Cosmetic parity across 12 paired stations verified.');
