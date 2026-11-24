const assert=require('node:assert/strict');
global.window=global;
for (const name of ['levels','engine','express-maps','express','feedback']) require('../game/'+name+'.js');
const rules=MineGame.rules;
const count=(s)=>JSON.stringify(s);
let sites=0, previews=0, suggestions=0, confirmedPushCosts=new Set();
for(let level=0;level<MineLevels.stages.length;level++){
  const stage=MineLevels.stages[level], root=rules.decodeStage(stage,stage.rows,false);
  for(const equipped of [null,'coil','lens']){
    const s={...root,phase:'plan',path:[{x:0,y:3}],order:stage.order,rubble:stage.rubble,budget:stage.budget,equipped};
    const start=count(s);
    for(let y=0;y<7;y++)for(let x=0;x<8;x++){
      const ore=MineFeedback.inspect(s,x,y);
      if(!['copper','crystal'].includes(s.board[y][x])){assert.equal(ore,null);continue;}
      assert.equal(ore.amount,s.amounts[y][x]);assert.ok(ore.grade && ore.note);
      const proof=[];
      for(let py=0;py<7;py++)for(let px=0;px<8;px++){
        if(s.board[py][px]!=='ground')continue;
        const q=rules.computeReturn({...s,path:[{x:px,y:py}]});
        if(q.steps[0].ores.some(p=>p.x===x&&p.y===y))proof.push({x:px,y:py});
      }
      assert.deepEqual(ore.approaches,proof);sites++;
    }
    assert.equal(count(s),start);
    function walk(){
      const before=rules.computeReturn(s), head=s.path.at(-1);
      const valid=[];
      for(const [dx,dy,dir] of [[0,1,'下'],[0,-1,'上'],[1,0,'右'],[-1,0,'左']]){
        const x=head.x+dx,y=head.y+dy;
        if(s.path.some(p=>p.x===x&&p.y===y))continue;
        if(!rules.placeRail(s,x,y).ok)continue;
        const after=rules.computeReturn(s),delta=MineFeedback.added(before,after);
        for(const type of ['copper','crystal']){
          const sum=delta.filter(p=>p.type===type).reduce((a,p)=>a+p.amount,0);
          assert.equal(sum,after[type]-before[type]);
        }
        if(!MineFeedback.shortage(s.order,after))valid.push({dir,cost:rules.trackCost(s,{x,y})});
        previews++;
        if(s.path.length<=4)walk();
        assert(rules.removeRail(s).ok);
      }
      if(s.path.length<2 || !MineFeedback.shortage(s.order,before))return;
      const lost={...s,phase:'done',result:{...before,met:false}};
      const frozen=count(lost),hint=MineFeedback.lastStepHint(lost);
      assert.equal(!!hint,!!valid.length);
      if(hint){
        const cost=Math.min(...valid.map(v=>v.cost));
        assert(valid.some(v=>v.cost===cost && hint.includes('往'+v.dir) && hint.includes('用 '+cost+' 节轨')));
        confirmedPushCosts.add(cost);suggestions++;
      }
      assert.equal(count(lost),frozen);
    }
    walk();assert.equal(count(s),start);
  }
}
assert.deepEqual(confirmedPushCosts,new Set([1,2]));
assert.equal(MineFeedback.shortage({copper:3,crystal:2},{copper:2,crystal:0}),'还缺铜 1、晶 2');
console.log({sites,previews,suggestions,railCosts:[...confirmedPushCosts]});
