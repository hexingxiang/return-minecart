/* 三站快运 · 触屏、时钟、结账和车库 */
(() => {
  'use strict';
  const ui=window.MineInterface;
  const engine=window.MineExpress.create();
  const q=selector=>document.querySelector(selector);
  const board=q('#fast-board'),ctx=board.getContext('2d');
  const dialog=q('#fast-dialog');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active=false;
  let animation=null;
  let boardView,plannedPreview;
  const feedback=ui.makeOreFeedback(engine,reduced);
  let visibleSecond=null;
  let lastDraw=0;
  let raf=0;
  let sheet='';
  let modalFocus=null;

  const s=()=>engine.state;
  function met(counts){
    return counts.copper>=s().order.copper && counts.crystal>=s().order.crystal;
  }
  function sale(counts){
    return (counts.copper*2+counts.crystal*4)*(s().bonus==='double'?2:1);
  }
  function paintName(){
    return s().paint==='standard'?'default':s().paint;
  }
  function prices(){
    return s().bonus==='double'?'铜 4 币 · 晶 8 币':'铜 2 币 · 晶 4 币';
  }

  function clock(nowMs){
    const state=s(), duration=MineExpress.durations[state.station-1]*1000;
    const seconds=Math.ceil(nowMs/1000);
    if(seconds!==visibleSecond){
      q('#fast-time').textContent=seconds+'s';
      q('.fast-clock').classList.toggle('urgent',seconds<=5 && state.started && state.phase==='plan');
      if(visibleSecond!==null && seconds>=1 && seconds<=4 && state.started && !state.paused && state.phase==='plan')ui.tone(340,.045);
      visibleSecond=seconds;
    }
    q('#fast-time-bar').style.transform='scaleX('+Math.max(0,Math.min(1,nowMs/duration))+')';
  }

  function refresh(message='',previous=null){
    const state=s(),plan=state.phase==='plan',planned=engine.preview(),counts=state.result||planned;
    plannedPreview=planned;
    const gain=previous?feedback.add(previous,planned):'';
    boardView=ui.makeBoardView(engine,planned,state.station-1,paintName());
    boardView.express=true;
    boardView.oddity=state.oddity;
    boardView.jade=state.jade;
    if(!plan && !animation && state.result){
      boardView.cart=state.path[0];boardView.collected=state.result.steps.flatMap(step=>step.ores);
    }
    q('#fast-name').textContent=state.stage.name;
    q('#fast-stage').textContent='第 '+state.station+' / 3 站';
    q('#fast-no').textContent='No. '+String(state.run).padStart(3,'0');
    q('#fast-rails').textContent=state.budget-engine.used();
    q('#fast-time-label').textContent=!plan?'已发车':state.started?'发车铃':'首步起计';
    const order=q('#fast-ores');
    order.innerHTML=ui.orderMarkup(state,counts);
    ui.paintIcons(order);
    q('#fast-quote').textContent=(state.result?state.result.fare:sale(counts))+' 币';
    q('#fast-pot').textContent=state.pot;
    q('#fast-coins').textContent=state.coins;
    q('#fast-best').textContent=state.best+' 币';
    q('#fast-bonus').innerHTML=ui.iconMarkup(state.bonus==='double'?'voucher':state.bonus==='rail'?'spare':'coin')+' '+
      (state.bonus==='double'?'加价券生效 · ':state.bonus==='rail'?'备用轨生效 · +1 轨 · ':'')+prices()+
      (state.rebarRail?'<div class="steel-line">'+ui.iconMarkup('rebar')+' 螺纹钢改轨 · 再加 1 格</div>':'');
    ui.paintIcons(q('#fast-bonus'));
    const first=state.jade?'点矿看采位。贴着青绿原石铺轨，满单能带回玉。':'点矿看采位。铺第一格才开始倒计时。';
    let note=planned.foundJade?'这条线路能捎回玉石。交齐订单，可卖 48 币或自己开石。':
      planned.foundRebar?'这块铜矿夹着螺纹钢。满单续运，下一站额外 +1 轨。':
      met(planned)?'货单已齐。现在发车，或再多捎些矿。':'铃响会自动发车，先让线路贴齐订单里的矿。';
    if(!state.started && plan)note=first;
    if(!plan)note={offer:state.result?.jade==='pending'?'本站已交货，还有一块玉石原石等你处理。':'本站已交货。可以收车落袋，或选道具去下一站。',banked:'本趟货款已入账，可在收藏车库换车。',lost:'本趟结束。重新开车会换一条首站路线。'}[state.phase];
    q('#fast-note').textContent=message || feedback.note || gain || note;
    q('#fast-save').textContent=engine.storageOK?'快运进度已保存在此浏览器。':'当前浏览器仅能在本次打开时保留进度。';
    q('#fast-undo').disabled=!plan || state.path.length<2 || Boolean(animation);
    q('#fast-go').disabled=Boolean(animation) || (plan && state.path.length<2);
    q('#fast-yard').disabled=Boolean(animation);q('#fast-scout').disabled=Boolean(animation);
    const shortage=MineFeedback.shortage(state.order,planned);
    const go=q('#fast-go');
    if(plan && state.path.length>1 && !animation){
      ui.dispatchLabel(go,shortage?'缺货发车 · 本趟结束':'满单发车 · '+sale(planned)+' 币',shortage?'short':'ready',
        shortage || '整车矿石可售出');
    }else ui.dispatchLabel(go,animation?'正在返程…':plan?'发车交货':
      state.phase==='offer'?(state.result?.jade==='pending'?'处理玉石原石 →':'领取货款或继续 →'):'查看本趟结算 →');
    clock(engine.remaining());
    render(performance.now());
  }

  function openSheet(kind,title,body,buttons){
    sheet=kind;
    q('#fast-dialog-inner').innerHTML='<h2 id="fast-dialog-title">'+title+'</h2>'+body+'<div class="modal-actions">'+buttons+'</div>';
    ui.paintIcons(dialog);
    if(!dialog.open){modalFocus=document.activeElement;dialog.showModal();}
    dialog.scrollTop=0;
    (dialog.querySelector('.primary') || dialog.querySelector('button'))?.focus({preventScroll:true});
    const close=dialog.querySelector('[data-fast-close]');
    if(close)close.onclick=()=>dialog.close();
  }

  function resumeClock(){
    if(active && !document.hidden && !dialog.open && s().phase==='plan'){
      const action=engine.resume();
      if(action.expired)beginReturn(action);
    }
  }

  function pauseClock(){
    if(s().phase!=='plan' || s().paused)return;
    const action=engine.pause();
    if(action.expired && active)beginReturn(action);
  }

  function info(title,body){
    if(animation)return;
    pauseClock();
    if(animation)return;
    openSheet('info',title,body,'<button class="control primary" data-fast-close>回矿区</button>');
  }
  function showRules(){
    info('三站快运怎么玩','<p>一趟最多三站，发车铃分别在 24、21、18 秒后响。点矿能看品级、产量和采位，第一格轨道落下才开始读秒。铃响时，矿车会按当前线路自动回程。</p>'+
      '<p>交齐订单，整车矿都能卖。前两站可以当场落袋，也可以从加价券和备用轨中选一件，带着货款继续跑。</p>'+
      '<p>勘探时倒计时暂停。下一站的矿图免费，隔一站用一张勘探券。每累计交货三站会获得一张新券。</p>'+
      '<p>缺货就结束这一趟，随车货款会损失。已落袋的矿币、车型和收藏记录永久保留。第三站成功会自动落袋。</p>'+
      '<p>留意铜矿旁露出的螺纹钢。满单带回并继续跑，下一站额外多一节轨。它还能与备用轨叠加。</p>'+
      '<p>有些矿脉夹着青绿色的玉石原石。交齐订单可以直接卖给商家，或自己切开，按开出的价格卖。玉款随车，加价券只对铜矿和蓝晶生效。</p>');
  }

  function vehicleCards(state){
    const progress=MineExpress.albumProgress(state.album);
    return '<div class="vehicle-grid">'+MineExpress.paints.map(model=>{
      const current=model.id===state.paint, owned=state.paints.includes(model.id);
      const locked=!owned && (model.milestone || state.coins<model.price);
      let detail=current?'正在驾驶':owned?'换上这辆车':model.price+' 币兑换并换上';
      if(!owned && model.milestone){
        detail=model.requirement+' · '+Math.min(progress[model.milestone],model.target)+'/'+model.target;
      }
      return '<button class="vehicle-card" data-paint="'+model.id+'" aria-pressed="'+current+'" '+
        (current||locked?'disabled':'')+'><canvas data-model="'+model.id+'" width="80" height="64" aria-hidden="true"></canvas>'+
        '<b>'+model.name+'</b><small>'+detail+'</small></button>';
    }).join('')+'</div>';
  }

  function albumView(album){
    const names={20:'石皮偏厚',40:'浅青细纹',80:'浓翠透光',100:'满翠通透'};
    const cuts=MineExpress.jadeCuts.map(({value})=>{
      const count=album.cuts[value];
      return '<li class="'+(count?'found':'unseen')+'">'+ui.iconMarkup('jade-cut')+
        '<b>'+names[value]+'</b><span>'+value+' 币 · '+(count?'×'+count:'未开出')+'</span></li>';
    }).join('');
    const fossils=ui.fossilAlbum().map(item=>'<li class="'+(item.owned?'found':'unseen')+'">'+
      ui.iconMarkup(item.id)+'<b>'+item.name+'</b><span>'+(item.owned?'已收藏':'待发掘')+'</span></li>').join('');
    return '<p class="album-stats">快运累计交货 <b>'+album.deliveries+'</b> 站 · 整块出售 <b>'+album.sold+
      '</b> 次</p><h3 class="album-label">玉石切面 · '+MineExpress.albumProgress(album).grades+
      ' / 4</h3><ul class="album-grid">'+cuts+'</ul><h3 class="album-label">主线化石</h3><ul class="album-grid fossils">'+fossils+'</ul>';
  }

  function openYard(tab='models'){
    if(animation)return;
    if(active){pauseClock();if(animation)return;}
    const state=s(), album=tab==='album';
    const tabs='<div class="yard-tabs" aria-label="车库视图"><button data-yard-tab="models" aria-pressed="'+!album+
      '">车型 · '+state.paints.length+'/'+MineExpress.paints.length+'</button><button data-yard-tab="album" aria-pressed="'+album+'">收藏图鉴</button></div>';
    const equipped=MineExpress.paints.find(model=>model.id===state.paint);
    const body=album?albumView(state.album):'<p class="yard-summary">当前驾驶 <strong>'+equipped.name+'</strong> · 余额 '+state.coins+
      ' 币</p>'+vehicleCards(state)+'<p class="jade-foot">所有车型共用采矿数值，可在主线和快运中驾驶。</p>';
    openSheet('yard','收藏车库',tabs+body,'<button class="control primary" data-fast-close>回矿区</button>');
    dialog.querySelectorAll('[data-model]').forEach(canvas=>{
      MineArt.drawVehicle(canvas.getContext('2d'),canvas.dataset.model,canvas.width,canvas.height);
    });
    dialog.querySelectorAll('[data-yard-tab]').forEach(button=>{
      button.onclick=()=>{openYard(button.dataset.yardTab);dialog.querySelector('[data-yard-tab][aria-pressed="true"]').focus({preventScroll:true});};
    });
    dialog.querySelectorAll('[data-paint]').forEach(button=>{
      button.onclick=()=>{
        const action=engine.buyPaint(button.dataset.paint);
        if(!action.ok){openYard();return;}
        ui.setPaint(paintName());ui.tone(560,.14);refresh();openYard();
      };
    });
  }

  function openScout(fromOffer=false){
    if(animation)return;
    if(active){pauseClock();if(animation)return;}
    const close=()=>{if(fromOffer)showOutcome();else dialog.close();};
    MineScout.open({
      engine:active?engine:ui.campaign, express:active, paint:paintName(), close,
      backLabel:fromOffer?'返回站间选择':q('#modal').open?'返回结算':'返回矿区',
      show:(title,body,buttons)=>openSheet('scout',title,body,buttons),
      advance:fromOffer?startNext:null
    });
  }

  function showJade(){
    const offer=MineExpress.jadeOffer, cuts=MineExpress.jadeCuts;
    const odds=cuts.map(cut=>'<li><b>'+cut.value+' 币</b><span>'+cut.weight+'%</span></li>').join('');
    openSheet('jade','这块玉，卖还是开？',
      '<div class="jade-counter">'+ui.iconMarkup('jade')+'<div><small>商家回收价</small><strong>'+offer+' <em>币</em></strong></div></div>'+
      '<p>整块卖，商家出 '+offer+' 币。自己切，按切面的成色卖，开出的价就定了。</p>'+
      '<ul class="jade-odds" aria-label="开石售价及概率">'+odds+'</ul><p class="jade-foot">玉款装入本趟矿车，收车落袋时一起入账。</p>',
      '<button class="control" id="fast-jade-sell">直接卖 · '+offer+' 币</button><button class="control primary" id="fast-jade-cut">自己开石</button>');
    for(const method of ['sell','cut'])q('#fast-jade-'+method).onclick=()=>{
      const action=engine.resolveJade(method);
      refresh(action.ok?'':action.reason);
      if(action.ok){ui.tone(method==='cut'?730:480,.12);showOutcome();}
      else if(s().phase!=='plan')showOutcome();
      else dialog.close();
    };
  }

  function jadeReceipt(r){
    if(r.jade!=='sold' && r.jade!=='cut')return '';
    const cut=r.jade==='cut';
    const diff=r.jadeValue-MineExpress.jadeOffer;
    const title=cut?(diff<0?'切开只值 ':'切开值 '):'原石成交 · ';
    const comparison=diff===0?'和商家报价相同。':'比刚才的报价'+(diff<0?'少了':'多了')+Math.abs(diff)+' 币。';
    return '<div class="jade-receipt" role="status">'+ui.iconMarkup(cut?'jade-cut':'jade')+'<span><b>'+
      title+r.jadeValue+' 币</b><small>'+
      (cut?comparison:'按商家报价卖出。')+'玉款已装车。</small></span></div>';
  }

  function newModelNotice(state,r){
    if(!r.met)return '';
    const progress=MineExpress.albumProgress(state.album);
    const models=[];
    if(r.jadeValue && progress.jade===1)models.push('穿山甲钻车');
    if(state.album.deliveries===5)models.push('蒸汽邮车');
    if(r.jade==='cut' && progress.grades===4 && state.album.cuts[r.jadeValue]===1)models.push('金龙巡游车');
    const unlocked=models.length?'<p class="new-model">新车型已入库 · '+models.join('、')+'</p>':'';
    return unlocked+(r.ticketEarned?'<p class="new-model">累计交货奖励 · 勘探券 +1</p>':'');
  }

  function showOutcome(){
    const state=s(),r=state.result;
    if(!r || animation || !active)return;
    if(state.phase==='offer'){
      if(r.jade==='pending'){showJade();return;}
      const next=engine.nextStop(), steel=Boolean(r.foundRebar);
      const manifest='<div class="fast-ticket"><b>'+ui.oreText(r)+' · 本站 '+r.fare+' 币</b><div class="manifest">随车货款 '+state.pot+' 币，下一站缺货就会损失。</div></div>';
      const discovery=steel?'<div class="steel-find">'+ui.iconMarkup('rebar')+'<span><b>挖出了螺纹钢</b><small>谁把工地埋这儿了？续运时改成 1 节轨。</small></span></div>':'';
      const nextInfo='<div class="fast-choice"><div class="next-stop-header"><h3>下一站 · '+next.name+'</h3><button id="offer-scout" class="quiet">看勘探图</button></div><p class="desc">'+ui.oreText(next.order)+' · '+next.seconds+' 秒 · 基础 '+next.budget+' 轨</p></div>';
      const goods=buttonItem('double','voucher','加价券','下一站整车卖双倍。含金量还在上升。')+
        buttonItem('rail','spare','备用轨','下一站多铺 1 格'+(steel?'，加上捡来的钢料共多 2 格。':'。'));
      const bellNote=r.timeout?'<p class="desc">发车铃一响，矿车卡点下班。本站货已交齐。</p>':'';
      openSheet('offer','收车，还是再跑一站？',jadeReceipt(r)+newModelNotice(state,r)+manifest+discovery+bellNote+nextInfo+goods,
        '<button class="control primary" id="fast-bank">收车落袋 · '+state.pot+' 币</button>');
      q('#offer-scout').onclick=()=>openScout(true);
      q('#fast-bank').onclick=()=>{const res=engine.bank();if(!res.ok){dialog.close();refresh(res.reason);return;}refresh();showOutcome();};
      for(const item of ['double','rail'])q('#fast-'+item).onclick=()=>startNext(item);
    }else if(state.phase==='lost'||state.phase==='banked'){
      const paid=state.phase==='banked';
      const missing={copper:Math.max(0,state.order.copper-r.copper),crystal:Math.max(0,state.order.crystal-r.crystal)};
      const title=paid?(state.station===3?'三站全收！':'货款已落袋'):'这趟断单了';
      const reason=paid?'这趟存下 '+state.settled+' 币。':(r.timeout?'发车铃响了，':'发车时')+'还差 '+ui.oreText(missing)+'。';
      const detail=paid?'账上 '+state.coins+' 币 · 单趟最高 '+state.best+' 币':
        '本趟损失 '+state.lostFare+' 币 · 账上仍有 '+state.coins+' 币';
      let quip='';
      if(!paid && state.lostFare>0)quip='<p class="desc">“早知道上一站就收手了。”</p>';
      else if(!paid && r.copper+r.crystal===0)quip='<p class="desc">矿区空军，带回一车新鲜空气。</p>';
      else if(paid && r.timeout && state.station===3)quip='<p class="desc">卡点下班。这车矿，班味儿比矿味还重。</p>';
      const lastStep=paid?'':MineFeedback.lastStepHint(state);
      const advice=lastStep?'<p class="route-review">'+lastStep+'</p>':'';
      openSheet('result',title,ui.finaleMarkup(paid)+'<div class="fast-ticket"><b>'+reason+'</b><div class="manifest">'+detail+'</div></div>'+advice+quip+newModelNotice(state,r),
        '<button class="control" data-fast-close>看线路</button><button class="control primary" id="fast-again">'+(paid?'再开一趟 →':'重新开始')+'</button>');
      q('#fast-again').onclick=()=>{const res=engine.restart();dialog.close();refresh(res.ok?'':res.reason);board.focus({preventScroll:true});};
      ui.playFinale(dialog);
    }
  }
  function buttonItem(id,icon,name,detail){
    return '<button class="fast-item" id="fast-'+id+'">'+ui.iconMarkup(icon)+'<span><b>'+name+'</b><small>'+detail+'</small></span><span class="action">续运 →</span></button>';
  }
  function startNext(item){
    const res=engine.advance(item);
    dialog.close();refresh(res.ok?'':res.reason);
    if(res.ok){ui.tone(480);board.focus({preventScroll:true});}
  }

  function beginReturn(response){
    if(!response.result){if(!response.ok)refresh(response.reason);return;}
    if(animation)return;
    if(dialog.open)dialog.close();
    feedback.clear();
    animation={start:performance.now(),steps:response.result.steps,frame:-1};
    ui.tone(125,.13,'triangle',.08);ui.tone(247,.16,'triangle',.07,.10);
    refresh(response.result.timeout?'发车铃响，按当前线路交货。':'矿车正在沿原路收矿。');
  }

  function render(now){
    if(!boardView || !active)return;
    const v={...boardView};
    if(animation){
      const steps=animation.steps;
      const t=Math.max(0,(now-animation.start)/(reduced?45:140));
      const n=ui.returnFrame(v,steps,t);
      if(n!==animation.frame){if(steps[n].ores.length){ui.tone(420+24*n,.13);ui.tone(840+48*n,.15,'triangle',.055,.075);if(!reduced && board.animate)board.animate([{filter:'brightness(1.2)'},{filter:'brightness(1)'}],{duration:210});}else ui.tone(105,.04,'triangle',.025);}
      animation.frame=n;
      if(t>=steps.length+.4){
        animation=null;
        queueMicrotask(()=>{if(!active)return;refresh();showOutcome();});
      }
    }
    feedback.apply(v,now);
    MineArt.drawBoard(ctx,v,reduced?0:now);
  }
  function loop(now){
    raf=0;
    if(!active || document.hidden)return;
    if(s().phase==='plan' && !dialog.open){
      const action=engine.tick();
      if(!action.ok)refresh(action.reason);
      else if(action.expired)beginReturn(action);
      clock(engine.remaining());
    }
    if(animation || (!reduced && now-lastDraw>(feedback.pulsing?32:95))){render(now);lastDraw=now;}
    raf=requestAnimationFrame(loop);
  }
  function startLoop(){
    if(!raf && active && !document.hidden)raf=requestAnimationFrame(loop);
  }
  function move(x,y){
    if(!active || animation || dialog.open || s().phase!=='plan')return;
    const tip=s().path[s().path.length-1];
    if(tip.x===x && tip.y===y)return;
    const previous=plannedPreview,length=s().path.length;
    feedback.unselect();
    const action=engine.move(x,y);
    if(action.expired){beginReturn(action);return;}
    if(action.ok){
      if(s().path.length<length)feedback.clear();
      ui.tone(265+14*s().path.length,.075,'square',.045);
    }
    refresh(action.ok?'':action.reason,action.ok && s().path.length>length?previous:null);
  }
  function undo(){
    if(animation || dialog.open || s().phase!=='plan')return;
    feedback.clear();
    const action=engine.undo();
    if(action.expired){beginReturn(action);return;}
    if(action.ok)ui.tone(175);refresh(action.ok?'':action.reason);
  }
  function go(){
    if(animation || dialog.open)return;
    if(s().phase==='plan')beginReturn(engine.dispatch());else showOutcome();
  }

  function switchMode(toExpress){
    if(toExpress && !ui.canLeave())return;
    if(!toExpress && active)pauseClock();
    active=toExpress;
    q('#campaign-view').hidden=active;q('#campaign-yard').hidden=active;q('#save-status').hidden=active;q('#express-view').hidden=!active;
    q('#express-tab').setAttribute('aria-pressed',String(active));
    q('#campaign-tab').setAttribute('aria-pressed',String(!active));
    try{history.replaceState(null,'',active?'#express':location.pathname+location.search);}catch{}
    if(active){
      resumeClock();refresh();startLoop();
      if(s().phase!=='plan' && !animation)showOutcome();
    }else{
      cancelAnimationFrame(raf);raf=0;animation=null;
      ui.setPaint(paintName());
      ui.resumeCampaign();
    }
  }
  ui.bindBoardPointer(board,()=>active && s().phase==='plan' && !animation && !dialog.open,move,feedback,()=>refresh());
  document.addEventListener('keydown',e=>{
    if(!active || dialog.open || e.ctrlKey || e.altKey || e.metaKey)return;
    if(e.target.closest('button') && (e.key===' '||e.key==='Enter'))return;
    const dirs={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
    const d=dirs[e.key];
    if(d){e.preventDefault();const head=s().path[s().path.length-1];move(head.x+d[0],head.y+d[1]);}
    else if(e.key==='Backspace'){e.preventDefault();undo();}
    else if(e.key===' ' && !e.repeat){e.preventDefault();go();}
  });
  q('#fast-undo').onclick=undo;q('#fast-go').onclick=go;q('#fast-yard').onclick=()=>openYard();q('#campaign-yard').onclick=()=>openYard();
  q('#fast-scout').onclick=()=>openScout();q('#campaign-scout').onclick=()=>openScout();
  q('#modal').addEventListener('click',event=>{if(event.target.closest('#result-scout'))openScout();});
  q('#express-tab').onclick=()=>switchMode(true);q('#campaign-tab').onclick=()=>switchMode(false);
  q('#help').onclick=()=>active?showRules():ui.showCampaignHelp();
  dialog.addEventListener('cancel',event=>{
    if(sheet==='scout' && active && s().phase==='offer'){
      event.preventDefault();showOutcome();
    }
  });
  dialog.addEventListener('close',()=>{
    sheet='';resumeClock();
    if(modalFocus?.isConnected&&!modalFocus.disabled)modalFocus.focus({preventScroll:true});
  });
  document.addEventListener('visibilitychange',()=>{
    if(!active)return;
    if(document.hidden){pauseClock();cancelAnimationFrame(raf);raf=0;}
    else{resumeClock();refresh();startLoop();}
  });
  addEventListener('pagehide',()=>{if(active)pauseClock();});
  addEventListener('pageshow',()=>{if(active){resumeClock();refresh();startLoop();}});
  ui.setPaint(paintName());
  if(location.hash==='#express')switchMode(true);
  else if(s().started && s().phase==='plan')engine.pause();
})();
