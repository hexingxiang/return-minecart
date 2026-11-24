(() => {
  'use strict';
  const q = selector => document.querySelector(selector);
  const game = MineGame.create();
  const board = q('#board');
  const ctx = board.getContext('2d');
  board.width = 320;
  board.height = 280;
  const modal = q('#modal');
  const neighbors = [[0,-1],[1,0],[0,1],[-1,0]];
  const artTiles = {ground:'floor',rock:'wall',copper:'copper',crystal:'crystal'};
  const cardIcon = {long:'rail',coil:'copper',lens:'crystal'};
  const oreName = {copper:'铜矿',crystal:'蓝晶'};
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let soundOn = true;
  try { soundOn=localStorage.getItem('minecart-sound')!=='off'; } catch {}
  function unlockSound(){
    if(!soundOn)return;
    try{
      const AudioEngine=window.AudioContext || window.webkitAudioContext;
      if(!AudioEngine)return;
      if(!soundContext)soundContext=new AudioEngine();
      if(soundContext.state==='suspended')soundContext.resume().catch(()=>{});
    }catch{}
  }
  document.addEventListener('pointerdown',unlockSound,{capture:true,passive:true});
  document.addEventListener('keydown',unlockSound,true);
  document.addEventListener('click',unlockSound,true);
  let soundContext;
  let animation = null;
  let lastFrame = 0;
  let cachedView;
  let cachedPreview;
  let drawnCell = -1;
  let modalReturnFocus = null;
  let excavation = null;

  function iconMarkup(name, cls='icon') {
    return '<canvas class="'+cls+'" data-icon="'+name+'" width="16" height="16" aria-hidden="true"></canvas>';
  }

  function paintIcons(root=document) {
    root.querySelectorAll('[data-icon]').forEach(canvas => {
      canvas.width=16; canvas.height=16;
      const c=canvas.getContext('2d'), name=canvas.dataset.icon;
      if(name==='audio' || name==='plan') {
        const sprite=name==='audio'
          ? ['     11    ','   1111  1 ',' 111111   1',' 111111   1',' 111111   1','   1111  1 ','     11    ']
          : [' 11111111',' 12222221',' 12112121',' 12222221',' 12111221',' 12222221',' 11111111'];
        sprite.forEach((line,y)=>[...line].forEach((ch,x)=>{
          if(ch===' ') return;
          c.fillStyle=ch==='1'?'#e6c384':'#637789'; c.fillRect(x+2,y+4,1,1);
        }));
      } else {
        MineArt.drawIcon(c,name==='card'?'ticket':name,0,0,1);
      }
    });
  }

  function paintTitle(){
    const c=q('#title-art').getContext('2d',{willReadFrequently:true});
    c.clearRect(0,0,80,20);
    c.font='900 18px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
    c.fillStyle='#fff'; c.textBaseline='alphabetic'; c.textAlign='center';
    [...'回程矿车'].forEach((letter,i)=>c.fillText(letter,10+i*20,16));
    const image=c.getImageData(0,0,80,20);
    for(let n=0;n<image.data.length;n+=4){
      image.data[n]=246; image.data[n+1]=225; image.data[n+2]=186;
      image.data[n+3]=image.data[n+3]>70?255:0;
    }
    c.putImageData(image,0,0);
  }

  function tone(freq,seconds=0.09,type='triangle',level=0.085,delay=0){
    if(!soundOn || !soundContext || soundContext.state!=='running') return;
    try{
      const osc=soundContext.createOscillator(),gain=soundContext.createGain();
      osc.type=type; osc.frequency.value=freq;
      const now=soundContext.currentTime+delay;
      gain.gain.setValueAtTime(0,now); gain.gain.linearRampToValueAtTime(level,now+0.008);
      gain.gain.exponentialRampToValueAtTime(0.001,now+seconds);
      osc.connect(gain); gain.connect(soundContext.destination);
      osc.start(now); osc.stop(now+seconds+0.012);
    }catch{}
  }

  function chord(notes){notes.forEach((f,i)=>tone(f,.18,'triangle',.07,i*.085));}
  function impact(canvas){if(!reducedMotion && canvas.animate)canvas.animate([{filter:'brightness(1.20)',transform:'translateY(1px)'},{filter:'brightness(1)',transform:'translateY(0)'}],{duration:210,easing:'ease-out'});}
  const same=(a,b)=>a.x===b.x && a.y===b.y;
  const key=p=>p.x+','+p.y;
  function makeOreFeedback(controller,reduced){
    let selected=null, pulse=null;
    return {
      at(x,y){return MineFeedback.inspect(controller.state,x,y);},
      toggle(ore){selected=selected && same(selected,ore)?null:ore;},
      unselect(){selected=null;},
      clear(){selected=null;pulse=null;},
      get note(){return selected?.note || '';},
      get pulsing(){return Boolean(pulse);},
      add(previous,current){
        const ores=MineFeedback.added(previous,current);
        if(!ores.length)return '';
        if(!reduced){
          const now=performance.now();
          // Keep gains from adjacent cells visible together during a fast swipe.
          const recent=pulse && now-pulse.start<150?pulse.ores:[];
          pulse={ores:[...recent,...ores],start:now};return '';
        }
        const gained={copper:0,crystal:0};
        ores.forEach(ore=>{gained[ore.type]+=ore.amount;});
        return '线路新增 '+oreText(gained)+'。';
      },
      apply(view,now){
        if(selected)view.inspect=selected;
        if(!pulse)return;
        const progress=Math.max(0,(now-pulse.start)/MineFeedback.pulseMs);
        if(progress>=1){pulse=null;return;}
        view.pulse={ores:pulse.ores,progress};
      }
    };
  }
  const feedback=makeOreFeedback(game,reducedMotion);

  function dispatchLabel(button,title,status='',detail=''){
    button.dataset.dispatch=status;
    button.replaceChildren(document.createTextNode(title));
    if(detail){
      const line=document.createElement('small');
      line.className='dispatch-detail';line.textContent=detail;button.append(line);
    }
  }

  function makeBoardView(controller, preview, zone, paint){
    const s=controller.state, tip=s.path[s.path.length-1], remaining=s.budget-controller.used();
    const moves=neighbors.map(([dx,dy])=>({x:tip.x+dx,y:tip.y+dy})).filter(p=>
      s.phase==='plan' && s.board[p.y]?.[p.x]==='ground' &&
      controller.trackCost(p.x,p.y)<=remaining && !s.path.some(v=>same(v,p)));
    return {
      tiles:s.board.map(row=>row.map(v=>artTiles[v]||'floor')),amounts:s.amounts,start:s.path[0],
      path:s.path,moves,cart:tip,collected:[],effects:[],returning:false,zone,paint,
      rubble:s.rubble,relic:s.relic,relicCollected:s.relic && s.collection.includes(s.relic.id),
      relicInReach:preview.relicStep>=0,targets:s.phase==='plan'?preview.steps.flatMap(step=>step.ores):[]
    };
  }

  let cartPaint='standard';
  function updateView(s) {
    cachedPreview=game.preview();
    cachedView=makeBoardView(game,cachedPreview,s.round<=3?0:s.round<=7?1:2,cartPaint);
    if(s.phase==='done' && !animation && s.result){
      cachedView.cart=s.path[0];
      cachedView.collected=s.result.steps.flatMap(step=>step.ores);
    }
  }

  function orderMarkup(s,counts){
    return Object.keys(oreName).filter(type=>s.order[type]>0).map(type=>{
      const met=counts[type]>=s.order[type];
      return '<div class="ore-row '+(met?'done':'')+'">'+iconMarkup(type)+'<span>'+oreName[type]+'</span><span class="number">'+counts[type]+' / '+s.order[type]+(met?' ✓':'')+'</span></div>';
    }).join('');
  }

  function drawOrder(s,counts){
    q('#order-rows').innerHTML=orderMarkup(s,counts);
    paintIcons(q('#order-rows'));
  }

  function stockMarkup(id,num,label){
    return '<span class="stock" title="'+label+'">'+iconMarkup(id)+'<span>'+label+' '+num+'</span></span>';
  }

  const campaign=MineLevels.stages;
  const specimens=MineLevels.relics;
  function specimen(id){return specimens.find(item=>item.id===id);}
  function nextLabel(s){
    if(!s.result?.firstClear && s.round<s.frontier)return '返回第 '+s.frontier+' 关 →';
    if(!s.result?.met)return '再试本关';
    if(s.round===campaign.length)return '进入深层矿区 →';
    return '进入下一关 →';
  }

  function oreText(quantities){
    return Object.keys(oreName).filter(type=>quantities[type]>0)
      .map(type=>quantities[type]+' '+oreName[type]).join('、') || '0 份矿石';
  }

  function refresh(message='',previous=null){
    const s=game.state;
    updateView(s);
    const gain=previous?feedback.add(previous,cachedPreview):'';
    const moving=Boolean(animation);
    const planning=s.phase==='plan' && !moving;
    const atStart=planning && s.path.length===1;
    const num=String(s.round).padStart(2,'0');
    q('#shift').textContent='第 '+num+' 关';
    q('#stage-name').textContent=s.stage.name;
    q('#express-tab').disabled=moving;
    q('#atlas').disabled=moving;q('#campaign-yard').disabled=moving;q('#campaign-scout').disabled=moving;
    q('#help').disabled=moving;
    const used=game.used();
    q('#rails').textContent=s.budget-used;
    q('#par').textContent='最短满单 '+game.par()+' 轨';
    q('#order-no').textContent='No. '+String(s.round).padStart(3,'0');
    const counts=moving?{copper:0,crystal:0}:(s.result || cachedPreview);
    drawOrder(s,counts);
    const side=q('#side-order');
    side.hidden=!s.relic;
    if(s.relic){
      const owned=s.collection.includes(s.relic.id);
      const withinReach=cachedView.relicInReach;
      side.classList.toggle('ready',owned||withinReach);
      const label=owned?'已收藏':withinReach?'回程可敲开':'贴着发光岩壁铺轨可发掘';
      side.innerHTML=iconMarkup('relic')+'支线 · '+label;
      paintIcons(side);
    }
    q('#launch').disabled=moving || (planning && s.path.length===1);
    const shortage=MineFeedback.shortage(s.order,cachedPreview);
    if(planning && !atStart){
      dispatchLabel(q('#launch'),shortage?'缺货发车 · 留在本关':'满单发车',shortage?'short':'ready',
        shortage || (s.round<s.frontier?'交齐本关订单':'首通抽装备卡'));
    }else dispatchLabel(q('#launch'),moving?'正在收矿…':planning?'发车收矿':nextLabel(s));
    q('#undo').disabled=!planning || s.path.length===1;
    q('#route-tip').hidden=!planning || s.round<3;
    const lesson={3:'带裂纹的碎岩格，要用 2 节轨道加固。',4:'亮铜矿簇每处出 2 份铜矿。',6:'蓝晶矿簇每处出 2 份蓝晶。',8:'赤铜富矿每处出 3 份铜矿。',9:'蓝晶富矿每处出 3 份蓝晶。'};
    const openingHint=s.round<=2?s.stage.tip:(lesson[s.round] || '按订单选择矿脉，再铺一条能把它们一起带回的路线。');
    const defaultHint=atStart?(s.round===1?'向右铺一格能交单，点矿看采位。藏品在北边的发光岩壁。':openingHint):
      moving?'矿车正在沿轨道回收矿石。':s.phase==='done'?(s.result.met?'订单已交齐，矿石已入库。':'矿石已入库，原图可以再试。'):
      (cachedPreview.copper>=s.order.copper && cachedPreview.crystal>=s.order.crystal)?
        (s.round<s.frontier?'这条线路已凑齐订单，可以发车。':'这条线路已凑齐订单！现在发车可以抽装备卡。'):
      (cachedView.moves.length===0?'这条线无法再延伸，可以发车或撤回调整。':'票面数字是这条线路预计收回的矿石。');
    q('#hint').textContent=(gain+message) || feedback.note || defaultHint;
    q('#hint').classList.remove('warn');
    q('#card-count').innerHTML='<button id="deck" class="quiet" style="min-height:26px;padding:3px 7px">卡册 '+s.owned.length+'/'+MineGame.cards.length+'</button>';
    q('#deck').onclick=()=>showDeck(false);
    q('#deck').disabled=moving;
    q('#museum').disabled=moving;
    q('#museum').textContent='图鉴 '+s.collection.length+'/'+specimens.length;
    q('#shelf').innerHTML=specimens.map(item=>{
      const owned=s.collection.includes(item.id);
      return '<button class="spec-slot '+(owned?'owned':'unknown')+'" data-specimen="'+item.id+'" '+(moving?'disabled':'')+'>'+
        iconMarkup(item.id)+'<span>'+item.name+'</span></button>';
    }).join('');
    const available=MineGame.cards.filter(c=>s.owned.includes(c.id));
    const basic={id:'',name:'标准矿斗',description:'收取轨道上下左右相邻的矿物，每处矿脉只收一次。'};
    const equipment=[basic,...available];
    q('#equip').innerHTML=equipment.map(c=>{
      const on=(s.equipped||'')===c.id;
      return '<button class="equip-item" data-equip="'+c.id+'" aria-pressed="'+on+'" '+(!atStart?'disabled':'')+'>'+iconMarkup(cardIcon[c.id]||'cart')+'<span>'+c.name+'</span><span class="state">'+(on?'已装备':'装配')+'</span></button>';
    }).join('');
    q('#equip-desc').textContent=(equipment.find(c=>c.id===(s.equipped||''))||basic).description;
    q('#stock').innerHTML=stockMarkup('copper',s.wallet.copper,'铜矿')+stockMarkup('crystal',s.wallet.crystal,'蓝晶')+stockMarkup('plan',s.wallet.plans,'图纸');
    const cost=MineGame.upgradeCost(s);
    q('#craft').textContent=cost?'制作 1 节长轨（'+cost.copper+' 铜 · '+cost.crystal+' 晶）':'长轨已全部制成';
    q('#craft').disabled=!atStart || !cost || s.wallet.copper<cost.copper || s.wallet.crystal<cost.crystal;
    q('#redeem').hidden=!(s.wallet.plans>0 && s.owned.length<MineGame.cards.length);
    q('#redeem').textContent='图纸换卡（'+MineGame.redeemCost+' 张）';
    q('#redeem').disabled=!atStart || s.wallet.plans<MineGame.redeemCost;
    q('#save-status').textContent=game.storageOK?'进度保存在此浏览器。':'浏览器存储当前不可用，进度仅在本次打开时保留。';
    paintIcons(q('.tools'));
    if(!moving) render(performance.now());
  }

  function warn(text) {
    refresh();
    q('#hint').textContent=text; q('#hint').classList.add('warn');
  }

  function moveTo(x,y) {
    if(animation || modal.open || game.state.phase!=='plan')return;
    const s=game.state,tip=s.path[s.path.length-1];
    if(same(tip,{x,y}))return;
    const previousLength=s.path.length,previous=cachedPreview;
    feedback.unselect();
    const result=game.move(x,y);
    if(!result.ok){warn(result.reason);return;}
    const removed=game.state.path.length<previousLength;
    if(removed)feedback.clear();
    const reinforced=!removed && game.trackCost(x,y)===2;
    tone(removed?180:reinforced?135:270+(game.state.path.length%6)*24,.075,'square',.045);if(!removed)tone(820,.035,'triangle',.035,.025);
    refresh(reinforced?'碎岩已加固，耗用 2 节轨道。':'',removed?null:previous);
  }

  function undo(){
    if(animation || modal.open || game.state.phase!=='plan')return;
    feedback.clear();
    const result=game.undo();
    if(!result.ok){warn(result.reason);return;}
    tone(180);refresh();
  }

  let exitAnimation=false;
  function launch(){
    if(animation || modal.open)return;
    if(game.state.phase==='done'){
      if(game.state.result.dig==='pending')openDig();else nextRound();
      return;
    }
    feedback.clear();
    const response=game.dispatch();
    if(!response.ok){warn(response.reason);return;}
    chord([125,185,247]);impact(board);
    animation={started:performance.now(),result:response.result,interval:reducedMotion?70:205};
    drawnCell=-1;exitAnimation=false;refresh();
  }

  function returnFrame(v,steps,t){
    const n=Math.min(Math.floor(t),steps.length-1),p=Math.min(1,t-n);
    const current=steps[n], next=steps[Math.min(n+1,steps.length-1)];
    const dir=next.x>current.x?'right':next.x<current.x?'left':next.y>current.y?'down':'up';
    v.cart={x:current.x+(next.x-current.x)*p,y:current.y+(next.y-current.y)*p,dir};
    v.moves=[];v.returning=true;
    v.collected=steps.slice(0,n+1).flatMap(step=>step.ores);
    v.effects=current.ores.map(o=>({from:o,to:v.cart,progress:p,type:o.type,amount:o.amount}));
    return n;
  }

  function render(now){
    if(!cachedView)return;
    const v={...cachedView}, a=animation;
    if(a){
      const steps=a.result.steps;
      let t=Math.max(0,((a.pauseTime??now)-a.started)/a.interval);
      if(!excavation && game.state.result?.dig==='pending' && t>=a.result.relicStep){
        t=a.result.relicStep;
        a.pauseTime=a.started+t*a.interval;
        openDig();
      }
      const n=returnFrame(v,steps,t);
      const current=steps[n];
      if(n!==drawnCell){
        drawnCell=n;const counts={copper:0,crystal:0};
        v.collected.forEach(o=>counts[o.type]+=o.amount);
        drawOrder(game.state,counts);
        if(current.ores.length){const f=440+([0,2,4,7,9,12][(v.collected.length-1)%6])*27;chord([f,f*1.5,f*2]);impact(board);}else tone(105,.045,'triangle',.025);
      }
      if(t>=steps.length+0.7 && !exitAnimation){
        exitAnimation=true;
        queueMicrotask(()=>{animation=null;refresh();chord(a.result.met?[392,523,659,784]:[330,247,165]);showResult();});
      }
    }
    feedback.apply(v,now);
    MineArt.drawBoard(ctx,v,reducedMotion?0:now);
  }

  function tick(now){
    if(excavation && !document.hidden)displayMeter(now);
    if(!q('#campaign-view').hidden && !document.hidden && (animation || (!reducedMotion && now-lastFrame>(feedback.pulsing?32:90)))){
      render(now);lastFrame=now;
    }
    requestAnimationFrame(tick);
  }

  function modalContent(title,body,buttons){
    if(!modal.open)modalReturnFocus=document.activeElement;
    q('#modal-inner').innerHTML='<h2 id="modal-title">'+title+'</h2>'+body+'<div class="modal-actions">'+buttons+'</div>';
    paintIcons(modal);if(!modal.open)modal.showModal();
    q('#modal [data-close]')?.addEventListener('click',()=>modal.close());
    q('#modal .primary')?.focus({preventScroll:true});
    modal.scrollTop=0;
  }
  const closeButton='<button class="control primary" data-close>知道了</button>';

  function finaleMarkup(won){
    const outcome=won?'win':'loss';
    const caption=won?'走上人生巅峰':'倾家荡产';
    const description=won?'矿工放下矿箱，开着敞篷跑车冲上山顶。':'仓库见底，矿工守着空矿车和一张欠单。';
    return '<figure class="finale-scene '+outcome+'"><canvas width="320" height="128" data-finale="'+outcome+
      '" role="img" aria-label="'+description+'"></canvas><figcaption>'+caption+'</figcaption></figure>';
  }

  function playFinale(dialog){
    const canvas=dialog.querySelector('canvas[data-finale]');
    const outcome=canvas.dataset.finale;
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const duration=outcome==='win'?3800:2700;
    const start=performance.now();
    let lastFrame=-1;
    function frame(now){
      if(!dialog.open || !canvas.isConnected)return;
      const progress=motion.matches?1:Math.min(1,Math.max(0,(now-start)/duration));
      const frameIndex=Math.floor(progress*duration*24/1000);
      if(frameIndex!==lastFrame || progress===1){
        MineFinaleArt.draw(canvas,outcome,progress);
        lastFrame=frameIndex;
      }
      if(progress<1)requestAnimationFrame(frame);
    }
    frame(start);
    tone(outcome==='win'?660:148,.17);
  }

  function aimPosition(now){
    if(excavation.manual)return excavation.position;
    const sweep=((now-excavation.started)/excavation.period)%2;
    return sweep<=1?sweep:2-sweep;
  }

  function displayMeter(now){
    if(excavation.resolved)return;
    const pos=aimPosition(now);
    excavation.needle.style.left=(pos*100)+'%';
    excavation.meter.dataset.hit=String(pos>=excavation.left && pos<=excavation.right);
  }

  function openDig(){
    const s=game.state;
    if(excavation || !s.relic || s.result?.dig!=='pending')return;
    const width=s.round<=3?.36:s.round<=7?.29:.24;
    const left={fern:.27,amber:.53,shell:.39}[s.relic.id];
    const manual=reducedMotion;
    const controls=manual?'<div class="aim-control"><button class="quiet" id="aim-left">← 左移</button><button class="quiet" id="aim-right">右移 →</button></div>':'';
    modalContent('矿壁里有东西',
      '<div class="dig-display">'+iconMarkup('relic')+'</div><p>'+
      (manual?'用左右键或下方按钮移动指针，对准金纹后敲击。':'矿车已停稳。等白色指针扫到金纹时敲击，它会来回摆动。')+
      '</p><div class="dig-meter" id="dig-meter" aria-label="敲击瞄准条"><span class="dig-band" style="left:'+
      (left*100)+'%;width:'+(width*100)+'%"></span><span class="dig-needle"></span></div>'+controls,
      '<button class="control" id="dig-skip">直接回程</button><button class="control primary" id="dig-strike">敲击矿壁</button>');
    excavation={left,right:left+width,started:performance.now(),period:s.round<=3?1280:1030,manual,position:.1,
      resolved:false,meter:q('#dig-meter'),needle:q('.dig-needle')};
    displayMeter(performance.now());
    if(manual){
      q('#aim-left').onclick=()=>adjustAim(-.1);
      q('#aim-right').onclick=()=>adjustAim(.1);
    }
    q('#dig-strike').onclick=()=>{
      const pos=aimPosition(performance.now());
      finishDig(pos>=excavation.left && pos<=excavation.right);
    };
    q('#dig-skip').onclick=()=>finishDig(false,true);
  }

  function adjustAim(delta){
    if(!excavation?.manual || excavation.resolved)return;
    excavation.position=Math.max(0,Math.min(1,excavation.position+delta));
    displayMeter(performance.now());
  }

  function finishDig(hit,skipped=false){
    if(!excavation || excavation.resolved)return;
    const r=game.resolveDig(hit);
    excavation.resolved=true;
    if(!r.ok || skipped){continueReturn();return;}
    const item=specimen(game.state.relic.id);
    if(hit){chord([440,660,880]);cachedView.relicCollected=true;}
    else tone(145,.12);
    modalContent(hit?'发现'+item.name:'矿壳没有裂开',
      '<div class="dig-display">'+iconMarkup(hit?item.id:'relic')+'</div><p>'+
      (hit?item.description+' 已收入矿井藏品。':'这一锤偏离了金纹。订单矿石照常入库，以后重访还能再试。')+'</p>',
      '<button class="control primary" id="dig-continue">继续回程 →</button>');
    q('#dig-continue').onclick=continueReturn;
  }

  function continueReturn(){
    excavation=null;
    if(modal.open)modal.close();
    if(animation){
      animation.started+=performance.now()-animation.pauseTime;
      animation.pauseTime=null;
    }else{
      refresh();
      if(game.state.result?.dig==='pending')openDig();else showResult();
    }
  }

  function showHelp(){
    modalContent('怎么开这趟矿车',
      '<p>① 点车头上下左右的亮格铺轨，沿已铺的轨道退一格可以收回。矿石和硬岩要绕开。</p>'+
      '<p>② 单点矿脉可查看产量，亮起的采位是可以贴轨收矿的位置。小矿出 1 份，矿簇出 2 份，富矿出 3 份。订单会显示整条路线预计收回的数量。</p>'+
      '<p>③ 第 3 关起有碎岩地面，踏入一格会消耗 2 节轨道。撤回这格，两节都会返还。</p>'+
      '<p>④ 让轨道从发光藏品岩壁旁经过，回程可以停靠敲矿。对准金纹敲开矿壳，藏品会永久收入图鉴。</p>'+
      '<p>勘探图可免费预看下一关，花一张勘探券还能看隔一关。在矿图下预装已收集的装备，到达那一关时会自动装上。</p>'+
      '<p>交齐订单可解锁下一关，首次完成会抽一张装备卡。用最少轨道满单可获金轨章。点关名可回访已通过的矿井。方向键铺轨、退格撤轨、空格发车。</p>',closeButton);
  }

  function canVisit(s){
    return !animation && !excavation && ((s.phase==='plan' && s.path.length===1) ||
      (s.phase==='done' && s.result?.dig!=='pending'));
  }

  function visitLevel(level){
    feedback.clear();
    const result=game.visit(level);
    if(!result.ok){modal.close();warn(result.reason);return;}
    modal.close();refresh();board.focus({preventScroll:true});
  }

  function wireVisits(){
    modal.querySelectorAll('[data-visit]').forEach(b=>b.onclick=()=>visitLevel(Number(b.dataset.visit)));
  }

  function showMuseum(selected){
    const s=game.state;
    const entries=specimens.map(item=>{
      const owned=s.collection.includes(item.id);
      const sites=campaign.flatMap((stage,i)=>stage.relic?.id===item.id?[i+1]:[]);
      const usable=sites.find(n=>n<=s.frontier && n!==s.round);
      let detail=owned?item.description:'在第 '+sites.join('、')+' 关的发光岩壁可以找到它。';
      if(!owned && s.relic?.id===item.id)detail='本关有它的痕迹。贴着发光岩壁铺轨，回程时敲开矿壳。';
      const jump=!owned && usable && canVisit(s)?'<button class="quiet visit" data-visit="'+usable+'">去第 '+usable+' 关</button>':'';
      return '<div class="spec-entry '+(owned?'owned':'unknown')+'" id="entry-'+item.id+'">'+iconMarkup(item.id)+
        '<div><b>'+item.name+'</b> <small class="small">'+(owned?'已收藏':'待发掘')+'</small><p>'+detail+'</p>'+jump+'</div></div>';
    }).join('');
    modalContent('矿井藏品 · '+s.collection.length+'/'+specimens.length,entries,closeButton);
    wireVisits();
    if(selected)modal.querySelector('#entry-'+selected)?.scrollIntoView({block:'nearest'});
  }

  function showAtlas(){
    const s=game.state;
    const rows=campaign.map((stage,index)=>{
      const level=index+1;
      const current=level===s.round;
      const cleared=level<s.frontier;
      const golden=s.gold.includes(level);
      const status=golden?'★ 金轨':cleared?'已通过':current?'当前':level===s.frontier?'已解锁':'待解锁';
      const jump=level<=s.frontier && !current && canVisit(s);
      const record=s.bestRails[level]?(' · 纪录 '+s.bestRails[level]+' 轨'):'';
      const button=jump?'<button class="quiet visit" data-visit="'+level+'">'+(golden?'★ ':'')+(cleared?'重访':'出发')+'</button>':
        '<small class="'+(cleared?'cleared':'')+'">'+status+'</small>';
      return '<li'+(current?' aria-current="step"':'')+'><span class="num">'+String(level).padStart(2,'0')+
        '</span><div><b>'+stage.name+'</b><span class="order-target">'+oreText(stage.order)+
        ' · 标准矿斗最省 '+stage.par+' 轨'+record+'</span></div>'+button+'</li>';
    }).join('');
    const names=['小矿','矿簇','富矿'];
    const legend=names.map((name,index)=>'<span>'+iconMarkup('copper'+(index+1))+name+' ×'+(index+1)+'</span>').join('');
    const deep=s.frontier>campaign.length && s.round!==s.frontier && canVisit(s)?
      '<button class="quiet" data-visit="'+s.frontier+'">返回深层第 '+s.frontier+' 关</button>':'';
    modalContent('关卡手册','<div class="grade-key">'+legend+'</div><ol class="stage-list">'+rows+
      '</ol>'+deep+'<p class="next-intro">铺轨前或回营后可以重访旧矿井，补齐藏品和金轨纪录。</p>',closeButton);
    wireVisits();
  }

  function showDeck(redeem){
    const s=game.state;
    const rows=MineGame.cards.map(c=>{
      const own=s.owned.includes(c.id);
      const choose=redeem && !own;
      return '<div class="card-reveal">'+iconMarkup(cardIcon[c.id])+' <strong>'+c.name+'</strong> · '+(own?'已收集':'待发现')+'<small>'+c.description+'</small>'+
        (choose?'<button class="quiet" data-redeem="'+c.id+'">兑换这张</button>':'')+'</div>';
    }).join('');
    modalContent(redeem?'选择要兑换的装备':'装备卡册',
      '<p>每关首次满单免费抽一张，三张卡等概率，各占 1/3。重复卡转成 1 张图纸，'+MineGame.redeemCost+' 张图纸可换一张指定装备。</p>'+rows,closeButton);
    modal.querySelectorAll('[data-redeem]').forEach(b=>b.onclick=()=>{
      const result=game.redeem(b.dataset.redeem);
      if(!result.ok){modal.close();warn(result.reason);return;}
      modal.close();refresh('新装备已加入卡册，可在随车装备中装配。');
    });
  }

  function showResult(){
    const s=game.state,r=s.result;if(!r || animation)return;
    if(r.dig==='pending'){openDig();return;}
    const card=r.card && MineGame.cards.find(c=>c.id===r.card.id);
    let reward='';
    if(card){
      reward='<div class="card-reveal">'+iconMarkup(cardIcon[card.id])+' <b>'+card.name+'</b><small>'+
        (r.card.isNew?'新装备已收入卡册。'+card.description:'已持有这件装备，获得 1 张图纸。')+'</small></div>';
    }
    const missing={copper:Math.max(0,s.order.copper-r.copper),crystal:Math.max(0,s.order.crystal-r.crystal)};
    const orderLine=r.met?(card?'订单已交齐，获得一次免费抽卡。':'重访订单已交齐。'):'还差 '+oreText(missing)+'。重试时可以重新规划这张地图。';
    const used=game.used(), minimum=game.par();
    const target=r.met && used===minimum?'★ 金轨章 · '+used+' 节满单，已是最短线路。':'这次铺了 '+used+' 节轨道，最短满单路线为 '+minimum+' 节。';
    const title=r.met?(s.round===campaign.length && r.firstClear?'主线通关！':'第 '+s.round+' 关完成！'):'第 '+s.round+' 关 · 交货不足';
    const ticket=r.ticketEarned?'<p class="new-model">获得 1 张勘探券，可查看隔一关的矿图。</p>':'';
    const upcoming=r.firstClear?'<div class="next-stop-header"><p class="next-intro">下一关 · '+
      (campaign[s.round]?.name||'深层矿区')+'</p><button class="quiet" id="result-scout">看图预装</button></div>':'';
    const find=r.dig==='found'?'<p>'+iconMarkup(s.relic.id)+' 新藏品 · '+specimen(s.relic.id).name+'</p>':'';
    let actions='<button class="control" data-close>看线路</button><button class="control primary" id="next">'+nextLabel(s)+'</button>';
    if(s.round<s.frontier && (r.dig==='miss' || !r.met)){
      actions=r.met?'<button class="control" id="retry">再挖一次</button><button class="control primary" id="next">'+nextLabel(s)+'</button>':
        '<button class="control" id="next">'+nextLabel(s)+'</button><button class="control primary" id="retry">再试本关</button>';
    }
    const lastStep=r.met?'':MineFeedback.lastStepHint(s);
    const advice=lastStep?'<p class="route-review">'+lastStep+'</p>':'';
    modalContent(title,finaleMarkup(r.met)+'<p>带回 <strong>'+oreText(r)+'</strong>，已存入工坊。</p><p>'+orderLine+'</p>'+advice+'<p>'+target+'</p>'+find+reward+ticket+upcoming,actions);
    if(q('#retry'))q('#retry').onclick=()=>visitLevel(s.round);
    q('#next').onclick=nextRound;
    playFinale(modal);
  }

  function nextRound(){
    feedback.clear();
    const result=game.next();
    if(!result.ok){warn(result.reason);return;}
    if(modal.open)modal.close();
    refresh();board.focus({preventScroll:true});
  }

  q('#launch').onclick=launch;q('#undo').onclick=undo;q('#help').onclick=showHelp;q('#atlas').onclick=showAtlas;
  q('#museum').onclick=()=>showMuseum();
  q('#shelf').onclick=e=>{const b=e.target.closest('[data-specimen]');if(b)showMuseum(b.dataset.specimen);};
  q('#route-tip').onclick=()=>{feedback.clear();render(performance.now());q('#hint').classList.remove('warn');q('#hint').textContent=game.state.stage.tip;};
  q('#redeem').onclick=()=>showDeck(true);
  q('#craft').onclick=()=>{
    const r=game.upgrade();
    if(!r.ok){warn(r.reason);return;}
    tone(500,.15);refresh('长轨做好了。今后每班都多一节轨道。');
  };
  q('#equip').onclick=e=>{
    const b=e.target.closest('[data-equip]');if(!b)return;
    feedback.clear();
    const r=game.equip(b.dataset.equip || null);
    if(!r.ok){warn(r.reason);return;}tone(420);refresh();
  };
  q('#audio span').textContent=soundOn?'音效开':'音效关';
  q('#audio').setAttribute('aria-pressed',String(soundOn));
  q('#audio').onclick=()=>{
    try{
      const AudioEngine=window.AudioContext || window.webkitAudioContext;
      if(!AudioEngine){warn('此浏览器未提供游戏音效。');return;}
      if(!soundContext)soundContext=new AudioEngine();
      if(soundContext.state==='suspended')soundContext.resume().catch(()=>{});
      soundOn=!soundOn;
      try{localStorage.setItem('minecart-sound',soundOn?'on':'off');}catch{}
      if(soundOn)unlockSound();
      q('#audio span').textContent=soundOn?'音效开':'音效关';
      q('#audio').setAttribute('aria-pressed',String(soundOn));tone(460,.09);
    }catch{warn('当前浏览器无法启用音效。');}
  };
  function bindBoardPointer(canvas,allowed,place,feedback,onInspect){
    let pointer=null, lastCell='', tapOre=null;
    function position(event){
      const box=canvas.getBoundingClientRect();
      return {x:Math.floor((event.clientX-box.left)*8/box.width),y:Math.floor((event.clientY-box.top)*7/box.height)};
    }
    function visit(cell,first){
      if(key(cell)===lastCell)return;
      lastCell=key(cell);
      if(!first)tapOre=null;
      if(cell.x<0 || cell.y<0 || cell.x>=8 || cell.y>=7)return;
      const ore=feedback.at(cell.x,cell.y);
      if(ore){if(first)tapOre=ore;return;}
      place(cell.x,cell.y);
    }
    canvas.addEventListener('pointerdown',event=>{
      if(!event.isPrimary || event.button!==0 || !allowed())return;
      event.preventDefault();canvas.focus({preventScroll:true});
      pointer=event.pointerId;lastCell='';tapOre=null;
      canvas.setPointerCapture(pointer);visit(position(event),true);
    });
    canvas.addEventListener('pointermove',event=>{
      if(event.pointerId===pointer && allowed())visit(position(event),false);
    });
    canvas.addEventListener('pointerup',event=>{
      if(event.pointerId!==pointer)return;
      const ore=tapOre;
      pointer=null;tapOre=null;
      if(ore && same(ore,position(event)) && allowed()){
        feedback.toggle(ore);onInspect();
      }
    });
    canvas.addEventListener('lostpointercapture',event=>{
      if(event.pointerId===pointer){pointer=null;tapOre=null;}
    });
  }
  bindBoardPointer(board,()=>!animation && !modal.open && game.state.phase==='plan',moveTo,feedback,()=>refresh());
  document.addEventListener('keydown',e=>{
    if(q('#campaign-view').hidden)return;
    if(excavation?.manual && !excavation.resolved && ['ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();adjustAim(e.key==='ArrowLeft'?-.1:.1);return;
    }
    if(modal.open || q('#fast-dialog').open || e.ctrlKey || e.metaKey || e.altKey)return;
    if(e.target.closest('button') && (e.key===' '||e.key==='Enter'))return;
    const map={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};
    if(map[e.key]){
      e.preventDefault();const path=game.state.path,head=path[path.length-1],delta=map[e.key];
      moveTo(head.x+delta[0],head.y+delta[1]);
    }else if(e.key==='Backspace'){e.preventDefault();undo();}
    else if(e.key===' '){e.preventDefault();if(!e.repeat)launch();}
  });
  modal.addEventListener('cancel',e=>{
    if(!excavation)return;
    e.preventDefault();
    if(excavation.resolved)continueReturn();else finishDig(false,true);
  });
  modal.addEventListener('close',()=>{
    if(modalReturnFocus?.isConnected && !modalReturnFocus.disabled) modalReturnFocus.focus({preventScroll:true});
  });
  window.MineInterface={iconMarkup,paintIcons,tone,makeBoardView,returnFrame,bindBoardPointer,makeOreFeedback,dispatchLabel,orderMarkup,oreText,finaleMarkup,playFinale,
    campaign:game,
    fossilAlbum:()=>specimens.map(item=>({id:item.id,name:item.name,owned:game.state.collection.includes(item.id)})),
    canLeave:()=>!modal.open && !animation,showCampaignHelp:showHelp,
    resumeCampaign(){if(game.state.phase==='done' && game.state.result?.dig==='pending' && !modal.open)showResult();},
    setPaint(value){cartPaint=value;updateView(game.state);if(!animation)render(performance.now());}};
  paintTitle();paintIcons();refresh();requestAnimationFrame(tick);
  if(game.state.phase==='done' && location.hash!=='#express')showResult();
})();
