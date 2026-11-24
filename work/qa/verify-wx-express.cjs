'use strict';
const path = require('path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
global.window = global;
for (const name of ['levels','engine','feedback','express-maps','express']) require(path.join(root, 'game', name + '.js'));
const createMode = require(path.join(root, 'wx','express-mode.js'));

function fullRoute(state, requireSeams) {
  const s = {...state, path: [{x:0,y:3}]};
  const rules = MineGame.rules;
  let best = null;
  function visit() {
    const cargo = rules.computeReturn(s);
    const ores = cargo.steps.flatMap(step=>step.ores);
    const includes = seam => !seam || ores.some(ore=>ore.x===seam.x && ore.y===seam.y);
    if(s.path.length>1 && cargo.copper>=s.order.copper && cargo.crystal>=s.order.crystal && (!requireSeams || includes(s.oddity) && includes(s.jade))) {
      if(!best || s.path.length<best.length) best=s.path.slice();
    }
    if(rules.usedRails(s)>=s.budget) return;
    const head=s.path.at(-1);
    for(const [dx,dy] of [[1,0],[0,1],[0,-1],[-1,0]]) {
      const p={x:head.x+dx,y:head.y+dy};
      if(s.path.some(q=>q.x===p.x && q.y===p.y))continue;
      if(!rules.placeRail(s,p.x,p.y).ok)continue;
      visit();rules.removeRail(s);
    }
  }
  visit();return best && best.slice(1);
}

function session(seed, store, clock) {
  const now=()=>clock.time;
  const g=MineExpress.create({seed,now,storage:store});
  const host={fast:g,MineExpress,MineFeedback,now,time:clock,paint:()=>g.state.paint,haptic(){},toast(v){throw Error(v)},sheetOpen(){return Boolean(this.currentSheet)},
    close(){this.currentSheet=null},sheet(s){this.currentSheet=s},play(v){this.board=v},
    boardView(g,z){assert.equal(g.state.station-1,z);return {}},returnFrame(v,steps,t){assert.ok(steps.length);this.frames=(this.frames||0)+1;assert.ok(t>=0)},
    ending(outcome){this.finale=outcome;return {}},scout(offset,returnTo,advance){this.scoutArgs={offset,returnTo,advance}},art:{drawIcon(){}},
  };
  const mode=createMode(host);
  const draw=(ms=0)=>{clock.time+=ms;mode.draw(now())};
  const action=prefix=>{const opt=host.currentSheet.actions.find(opt=>opt.label.startsWith(prefix));assert.ok(opt, prefix+' missing on '+host.currentSheet.title);opt.run()};
  const path=seams=>{const route=fullRoute(g.state,seams);assert.ok(route);for(const {x,y} of route)host.board.onCell(x,y);draw();return route};
  const dispatch=()=>{host.board.go.run();draw();assert.ok(host.board.go.disabled);draw(3000);assert.ok(host.frames>0);return host.currentSheet.title};
  mode.show();draw();return {host,g,mode,draw,action,path,dispatch};
}

const store=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}};
let seed;
for(let n=0;n<64;n++)if(fullRoute(MineExpress.create({seed:n,storage:null}).state,true)){seed=n;break}
assert.notEqual(seed,undefined);
for(const jadeMethod of ['整块卖','自己开石']) {
  const storage=store(),clock={time:500},sess=session(seed,storage,clock);
  const {host,g,mode,draw,action,path,dispatch}=sess;
  assert.ok(host.board.badge.includes('24秒'));draw(10000);assert.equal(g.remaining(),24000);assert.ok(host.board.go.disabled);
  const route=fullRoute(g.state,true);host.board.onCell(route[0].x,route[0].y);draw(350);assert.equal(g.remaining(),23650);
  mode.hide();clock.time+=100000;assert.equal(g.remaining(),23650);mode.show();draw(150);assert.equal(g.remaining(),23500);
  host.board.undo.run();draw();assert.equal(g.state.path.length,1);path(true);
  assert.equal(dispatch(),'这块玉，卖还是开？');assert.ok(g.state.result.foundJade && g.state.result.foundRebar);
  const before=g.state.pot;action(jadeMethod);assert.ok(g.state.pot>before);assert.ok(g.state.paints.includes('inkjade'));assert.equal(host.currentSheet.title,'收车，还是再跑一站？');
  if(jadeMethod==='整块卖'){
    action('收车落袋');assert.equal(host.finale,'win');assert.equal(g.state.settled,before+48);assert.equal(g.state.coins,g.state.settled);
    action('回看线路');draw();assert.equal(host.currentSheet,null);host.board.go.run();assert.equal(host.currentSheet.title,'货款已落袋');
    action('再开一趟');draw();assert.equal(g.state.station,1);assert.equal(g.state.run,2);assert.equal(g.state.phase,'plan');
  }else{
    action('看下一站矿图');assert.equal(host.scoutArgs.offset,1);host.scoutArgs.returnTo();host.scoutArgs.advance('double');draw();assert.equal(g.state.station,2);assert.equal(g.state.budget,g.state.stage.budget+1);assert.equal(g.state.bonus,'double');path(false);dispatch();expectDouble=g.state.result.fare;assert.equal(expectDouble,g.state.result.copper*4+g.state.result.crystal*8);
    action('带备用轨');draw();assert.equal(g.state.station,3);assert.equal(g.state.budget,g.state.stage.budget+1);path(false);dispatch();assert.equal(host.currentSheet.title,'三站全收！');assert.equal(host.finale,'win');assert.equal(g.state.surveyTickets,2);
  }
}
var expectDouble;
const st=store(),clock={time:0},test=session(seed,st,clock);const {host,g,draw,mode}=test;
const bad=[[0,1],[0,-1],[1,0]].map(([dx,dy])=>({x:dx,y:3+dy})).find(p=>{const s={...g.state,path:g.state.path.slice()};return MineGame.rules.placeRail(s,p.x,p.y).ok&&!((c=>c.copper>=s.order.copper&&c.crystal>=s.order.crystal)(MineGame.rules.computeReturn(s))) });
assert.ok(bad);host.board.onCell(bad.x,bad.y);draw(300);mode.hide();const remaining=g.remaining();clock.time+=80000;const loaded=session(seed,st,clock);assert.equal(loaded.g.remaining(),remaining);loaded.draw(remaining+1);assert.equal(loaded.g.state.result.timeout,true);loaded.draw(3000);assert.equal(loaded.host.finale,'loss');assert.equal(loaded.host.currentSheet.title,'这趟断单了');loaded.action('再开一趟');loaded.draw();assert.equal(loaded.g.state.run,2);
console.log('PASS touch placement/undo, countdown + cold resume, timeout loss, cut/sell jade, steel, both upgrades, bank early, final station, survey reward and restart.');
