/* Explanations derived from the same pickup, rail cost and order rules as dispatch. */
(() => {
  'use strict';
  const rules=window.MineGame.rules;
  const names={copper:'铜矿',crystal:'蓝晶'};
  const shortNames={copper:'铜',crystal:'晶'};
  const grades=['','小矿','矿簇','富矿'];
  const sameCell=(p,x,y)=>p && p.x===x && p.y===y;

  function inspect(state,x,y){
    const type=state.board[y]?.[x];
    if(state.phase!=='plan' || !names[type])return null;
    const amount=state.amounts[y][x], grade=grades[amount];
    const approaches=[];
    for(let py=y-1;py<=y+1;py++){
      for(let px=x-1;px<=x+1;px++){
        if(state.board[py]?.[px]!=='ground')continue;
        const tile={x:px,y:py};
        if(rules.pickupSites(state,tile).some(ore=>sameCell(ore,x,y)))approaches.push(tile);
      }
    }
    let hint='沿标记格铺轨可收';
    if(approaches.some(tile=>tile.x!==x && tile.y!==y)){
      hint=type==='copper'?'线圈可从斜角收铜':'透镜可从斜角收晶';
    }
    if(!approaches.length)hint='周围没有可采位置';
    const extras=[];
    if(sameCell(state.jade,x,y))extras.push('原石');
    if(sameCell(state.oddity,x,y))extras.push('螺纹钢');
    const find=extras.length?'，夹有'+extras.join('和'):'';
    const note=names[type]+' · '+grade+' '+amount+' 份'+find+'。'+hint+'。';
    return {x,y,type,amount,grade,approaches,note};
  }

  // Return order changes when the cart moves; coordinate identity is stable.
  function added(previous,next){
    if(!previous || !next)return [];
    const id=ore=>ore.y*window.MineGame.width+ore.x;
    const covered=new Set(previous.steps.flatMap(step=>step.ores.map(id)));
    return next.steps.flatMap(step=>step.ores.filter(ore=>!covered.has(id(ore))));
  }

  function shortage(order,counts){
    const missing=[];
    for(const key of ['copper','crystal']){
      const n=order[key]-(counts[key]||0);
      if(n>0)missing.push(shortNames[key]+' '+n);
    }
    return missing.length?'还缺'+missing.join('、'):'';
  }

  function lastStepHint(state){
    if(!state.result || state.result.met || state.phase==='plan')return '';
    const head=state.path[state.path.length-1];
    const directions=[[1,0,'右'],[-1,0,'左'],[0,1,'下'],[0,-1,'上']];
    let best=null;
    for(const [dx,dy,direction] of directions){
      const x=head.x+dx,y=head.y+dy;
      // A move to the previous cell retracts track. Only test a new rail.
      if(state.board[y]?.[x]!=='ground' || state.path.some(p=>sameCell(p,x,y)))continue;
      const trial={...state,phase:'plan',path:state.path.slice()};
      if(!rules.placeRail(trial,x,y).ok)continue;
      if(shortage(state.order,rules.computeReturn(trial)))continue;
      const cost=rules.trackCost(state,{x,y});
      if(!best || cost<best.cost)best={direction,cost};
    }
    return best?'发车前往'+best.direction+'再铺一格，用 '+best.cost+' 节轨就能交齐。':'';
  }

  window.MineFeedback={inspect,added,shortage,lastStepHint,pulseMs:780};
})();
