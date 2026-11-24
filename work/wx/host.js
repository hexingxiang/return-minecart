/* Shared portrait renderer for the WeChat Page canvas and the Mini Game screen. */
const loadCore = require('./core');
const createCampaign = require('./campaign');
const createExpress = require('./express-mode');
const createLibrary = require('./library');

module.exports = function createHost(platform) {
  const { canvas, makeCanvas } = platform;
  const core = loadCore(makeCanvas);
  const art = core.MineArt;
  const feedback = core.MineFeedback;
  const ctx = canvas.getContext('2d');
  const boardCanvas = makeCanvas(320, 280);
  const boardCtx = boardCanvas.getContext('2d');
  const store = platform.storage;
  const game = core.MineGame.create({storage:store});
  const fast = core.MineExpress.create({storage:store});
  const icons = new Map();
  const W=360;
  const color={bg:'#151d25',panel:'#23313b',edge:'#43525a',ink:'#eee5cf',muted:'#a8b5af',gold:'#f4bf70',green:'#a5d6b7'};
  let ui, modes, modeId=store?.getItem('mine.mobile.mode')==='express'?'express':'campaign';
  let sound=store?.getItem('mine.mobile.sound')==='on';
  let width,height,scale,offset,top,bottom,H,dpr,areas=[],grid=null,panel=null,gesture=null;
  let toastText='',toastUntil=0,live=false,handle=null,lastPaint=0,ready=false;
  let frameTime=0;
  let feedbackOwner=null,previousLength=0,inspection=null,pulse=null;
  const now=platform.now || Date.now;
  function resize() {
    const v=platform.metrics();
    width=v.width;height=v.height;
    if (!(width>0 && height>0))return;
    dpr=Math.min(v.ratio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    scale=Math.min(width/W,height/580);
    offset=(width-W*scale)/2;H=height/scale;
    const capsuleY=v.capsule?.bottom;
    top=Math.max((v.top||0)/scale+3, capsuleY>0 ? capsuleY/scale-36 : 0);
    bottom=Math.max(4,(v.bottom||0)/scale);
    if(ready && live)draw(now());
  }
  const text=(s,x,y,size=14,tint=color.ink,bold=false,align='left')=>{
    ctx.font=(bold?'bold ':'')+size+'px sans-serif';ctx.fillStyle=tint;
    ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(s??''),x,y);
  };
  function linesOf(value,maxWidth,size) {
    ctx.font=size+'px sans-serif';
    const lines=[];let row='';
    for(const ch of String(value??'')){
      if(ch==='\n'){lines.push(row);row='';continue;}
      if(row && ctx.measureText(row+ch).width>maxWidth){lines.push(row);row=ch;}else row+=ch;
    }
    if(row)lines.push(row);
    return lines;
  }
  function shorten(value,w,size) {
    const row=linesOf(value,w,size);
    return row.length<=1?(row[0]||''):row[0].slice(0,-1)+'…';
  }
  function box(x,y,w,h,fill,edge){
    if(w<=0||h<=0)return;
    ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);
    if(edge){ctx.strokeStyle=edge;ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);}
  }
  function icon(name,x,y,size) {
    let sprite=icons.get(name);
    if(!sprite){sprite=makeCanvas(16,16);art.drawIcon(sprite.getContext('2d'),name);icons.set(name,sprite);}
    ctx.drawImage(sprite,x,y,size,size);
  }
  function area(label,x,y,w,h,fn){
    if(typeof fn==='function' && w>0 && h>0)areas.push({label,x,y,w,h,fn});
  }
  function control(action,x,y,w,h){
    if(!action)return;
    const on=!action.disabled, primary=action.primary && on;
    const pressed=gesture?.hit?.label===action.label&&!gesture.moved;
    box(x,y+2,w,h-2,'#101820');
    box(x,y+(pressed?1:0),w,h-2,primary?'#efb969':on?'#2b3943':'#25303a',primary?'#ffdaa0':'#4e5b62');
    const tint=primary?'#33271b':on?color.ink:'#9ba5a4';
    text(shorten(action.label,w-14,14),x+w/2,y+(action.hint?15:h/2),14,tint,true,'center');
    if(action.hint)text(shorten(action.hint,w-14,11),x+w/2,y+33,11,tint,false,'center');
    if(on)area(action.label,x,y,w,h,action.run);
  }
  function boardView(engine,zone,express) {
    const s=engine.state,preview=engine.preview(),head=s.path[s.path.length-1],remaining=s.budget-engine.used();
    const moves=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>({x:head.x+dx,y:head.y+dy}))
      .filter(p=>s.phase==='plan'&&s.board[p.y]?.[p.x]==='ground'&&engine.trackCost(p.x,p.y)<=remaining&&!s.path.some(v=>v.x===p.x&&v.y===p.y));
    return {...mapView(s,zone,express),path:s.path,moves,cart:head,
      targets:s.phase==='plan'?preview.steps.flatMap(step=>step.ores):[],relicInReach:preview.relicStep>=0};
  }
  function mapView(s,zone,express){
    const tiles={ground:'floor',rock:'wall',copper:'copper',crystal:'crystal'};
    const start={x:0,y:3};
    return {tiles:s.board.map(row=>row.map(v=>tiles[v])),amounts:s.amounts,start,path:[start],cart:start,
      collected:[],effects:[],moves:[],targets:[],rubble:s.rubble,relic:s.relic,oddity:s.oddity,jade:s.jade,
      relicCollected:!!s.relic && game.state.collection.includes(s.relic.id),zone,express,paint:fast.state.paint};
  }
  function returnFrame(v,steps,t){
    const n=Math.min(steps.length-1,Math.max(0,Math.floor(t))),p=Math.min(1,Math.max(0,t-n));
    const a=steps[n],b=steps[Math.min(n+1,steps.length-1)];
    v.cart={x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,dir:b.x>a.x?'right':b.x<a.x?'left':b.y>a.y?'down':'up'};
    v.moves=[];v.returning=true;v.collected=steps.slice(0,n+1).flatMap(step=>step.ores);
    v.effects=a.ores.map(o=>({from:o,to:v.cart,progress:p,type:o.type,amount:o.amount}));
    return n;
  }
  function chrome(){
    box(0,0,W,H,color.bg);
    box(14,top+3,30,30,'#dbae6b');icon('cart',17,top+6,24);text('回程矿车',53,top+18,22,color.ink,true);
    text('音效'+(sound?'开':'关'),180,top+18,12,sound?color.gold:color.muted,false,'center');
    area('音效',147,top-2,66,40,()=>{
      sound=!sound;try{store?.setItem('mine.mobile.sound',sound?'on':'off');}catch{}
      if(sound)platform.sound?.('rail');else platform.quiet?.();
    });
    box(14,top+42,W-28,1,color.edge);
  }
  function nav(){
    const y=H-bottom-55;
    box(0,y,W,55+bottom,'#1b2630');box(0,y,W,1,color.edge);
    const tabs=[['主线','cart','campaign'],['快运','bell','express'],['勘探','ticket','scout'],['车库','inkjade','yard']];
    tabs.forEach(([label,pic,id],i)=>{
      const x=i*W/4,chosen=id===modeId;
      if(chosen)box(x+21,y,48,3,color.gold);
      icon(pic,x+W/8-10,y+7,20);text(label,x+W/8,y+39,12,chosen?color.gold:color.muted,chosen,'center');
      area(label,x,y,W/4,55,()=>{
        if(id==='scout'){ui.scout();return;}if(id==='yard'){ui.yard();return;}
        switchMode(id);
      });
    });
  }
  function play(o){
    const engine=modeId==='express'?fast:game,s=engine.state,planning=s.phase==='plan';
    if(!planning || s!==feedbackOwner || s.path.length<previousLength) {
      inspection=null;pulse=null;
    }
    feedbackOwner=s;previousLength=s.path.length;
    const selected=inspection && feedback.inspect(s,inspection.x,inspection.y);
    if(pulse && frameTime-pulse.start>=feedback.pulseMs)pulse=null;
    const view={...o.view,inspect:selected,pulse:pulse?{
      ores:pulse.ores,progress:Math.max(0,(frameTime-pulse.start)/feedback.pulseMs)
    }:null};
    const shortage=feedback.shortage(o.order,o.counts),full=!shortage;
    const x=14,w=W-28, bar=H-bottom-55;
    const compact=H-top-bottom<635;
    const header=top+(compact?44:50);
    const footer=bar-9;
    const tools=(o.tools||[]).filter(Boolean);
    const toolH=tools.length?(compact?39:42):0;
    const actionY=footer-48,toolY=actionY-toolH-(compact?4:7);
    const infoY=header+(compact?45:57);
    const gridStart=infoY+(compact?40:46),noteSpace=compact?25:43;
    const maxGrid=Math.min(w-6,(toolY-gridStart-noteSpace)*8/7);
    const gw=Math.max(132,maxGrid),gh=gw*7/8;
    const gy=gridStart+Math.max(0,(toolY-gridStart-noteSpace-gh)*.38),gx=(W-gw)/2;
    text(o.kicker,x,header+8,12,color.green,true);
    text(shorten(o.title,237,21),x,header+33,21,color.ink,true);
    text(shorten(o.badge??'',112,13),W-14,header+12,13,color.gold,true,'right');
    text('余轨 '+o.rails,W-14,header+34,14,color.ink,true,'right');
    box(x,infoY,w,34,'#ead3a3');box(x+4,infoY+4,2,25,'#967447');
    for(let tooth=x+2;tooth<x+w-2;tooth+=8)box(tooth,infoY+34,4,2,'#ead3a3');
    text('货单',x+14,infoY+18,13,'#53442f',true);
    let ox=x+55;
    for(const [key,name] of [['copper','铜'],['crystal','晶']]){
      const need=o.order?.[key]||0;if(!need)continue;
      const got=o.counts?.[key]||0;icon(key,ox,infoY+9,18);
      text(name+' '+got+'/'+need,ox+21,infoY+18,14,got>=need?'#26573b':'#443b30',true);ox+=89;
    }
    const stampX=x+w-57;
    if(full)box(stampX,infoY+7,49,21,'#325d46');
    text(full?'已齐单':'待装齐',stampX+24,infoY+18,12,full?'#f2eacf':'#735e3c',true,'center');
    box(gx-3,gy-3,gw+6,gh+6,'#090f16',color.edge);
    art.drawBoard(boardCtx,view,o.now??frameTime);ctx.drawImage(boardCanvas,gx,gy,gw,gh);
    if(!selected && modeId==='campaign' && s.frontier===1 && planning && s.path.length===1){
      const side=gw/8, tx=gx+side*1.5, ty=gy+side*3.5;
      const bright='#efc783';
      ctx.strokeStyle=bright;ctx.lineWidth=1.5;ctx.strokeRect(tx-side*.36,ty-side*.36,side*.72,side*.72);
      box(tx-5,ty-1,10,2,bright);box(tx+2,ty-4,2,8,bright);box(tx+4,ty-2,2,4,bright);
    }
    if(planning && o.onCell)grid={x:gx,y:gy,w:gw,h:gh,onCell:o.onCell,engine};
    const message=selected?selected.note:pulse?pulse.note:o.note;
    const note=compact?[shorten(message,w-8,13)]:linesOf(message,w-8,13).slice(0,2);
    note.forEach((line,i)=>text(line,x+4,gy+gh+14+i*16,13,selected||pulse?color.green:color.muted));
    if(tools.length)tools.forEach((tool,i)=>{
      const bw=(w-6*(tools.length-1))/tools.length;
      control(tool,x+i*(bw+6),toolY,bw,toolH);
    });
    control(o.undo,x,actionY,95,48);
    if(o.go){
      const shortOrder=planning && s.path.length>1 && !full;
      const go=shortOrder?{...o.go,label:'缺货发车',hint:shortage}:o.go;
      control({...go,primary:!shortOrder},x+103,actionY,w-103,48);
    }
  }
  function sheet(data){
    const visual=data.visual;
    const previous=panel;
    panel={...data,scroll:0,maxScroll:0,surface:visual?makeCanvas(visual.width,visual.height):null};
    if(previous && previous.title===data.title)panel.scroll=previous.scroll;
    grid=null;areas=[];
  }
  function close(){panel=null;areas=[];grid=null;}
  function dismiss(){const fn=panel?.onClose;close();if(fn)fn();}
  function ending(outcome){
    const began=now();
    if(sound)platform.sound?.(outcome);
    return {width:320,height:128,draw(c,w,h,t){core.MineFinaleArt.draw(c.canvas||this.canvas,outcome,Math.min(1,Math.max(0,(t-began)/(outcome==='win'?3800:2700))));}};
  }
  function drawSheet(){
    const p=panel;if(!p)return;
    areas=[];grid=null;
    box(0,0,W,H,'rgba(9,14,20,.80)');
    const mx=9,mw=W-18,pad=14,inner=mw-pad*2;
    const para=(p.lines||[]).flatMap(s=>linesOf(s,inner-4,14));
    const v=p.visual, vh=v?Math.min(H*(v.maxFraction||.29),inner*v.height/v.width):0;
    const actions=(p.actions||[]).map(a=>{
      const detail=a.detail?linesOf(a.detail,inner-24,12):[];
      return {...a,detailLines:detail,height:detail.length?44+detail.length*14:46};
    });
    const fixed=54, natural=(vh?vh+10:0)+para.length*21+(para.length?6:0)+actions.reduce((sum,a)=>sum+a.height+6,0)+10;
    const maxH=Math.max(180,H-top-bottom-45),ph=Math.min(maxH,fixed+natural+9);
    const py=H-bottom-8-ph, start=py+fixed, end=py+ph-7;
    box(mx,py,mw,ph,'#202c37','#7d8687');box(mx+12,py,mw-24,2,'#dcaf6c');
    text(shorten(p.title,mw-66,20),mx+pad,py+27,20,color.ink,true);
    box(mx+mw-44,py+8,34,34,'#303d48');text('×',mx+mw-27,py+24,22,color.muted,false,'center');
    area('关闭',mx+mw-48,py+2,47,48,dismiss);
    p.maxScroll=Math.max(0,natural-(end-start));
    p.scroll=Math.max(0,Math.min(p.scroll,p.maxScroll));p.viewport={top:start,end};
    ctx.save();ctx.beginPath();ctx.rect(mx+3,start,mw-6,end-start);ctx.clip();
    let y=start-p.scroll;
    if(v){
      const surface=p.surface,vc=surface.getContext('2d');
      if(!v.static || !p.visualPainted){
        vc.setTransform(1,0,0,1,0,0);vc.clearRect(0,0,v.width,v.height);
        v.draw.call({canvas:surface},vc,v.width,v.height,frameTime);
        p.visualPainted=true;
      }
      const vw=vh*v.width/v.height, vx=(W-vw)/2, vy=y;
      ctx.drawImage(surface,vx,vy,vw,vh);
      if(v.onTap)area('选择车型',vx,Math.max(start,y),vw,Math.min(end,y+vh)-Math.max(start,y),
        (px,py)=>v.onTap((px-vx)*v.width/vw,(py-vy)*v.height/vh));
      y+=vh+10;
    }
    for(const row of para){text(row,mx+pad,y+10,14,color.muted);y+=21;}
    if(para.length)y+=6;
    actions.forEach(a=>{
      if(y+a.height>start && y<end){
        const bx=mx+pad;
        box(bx,y,inner,a.height,a.primary?'#efbc73':'#2b3944',a.primary?'#ffe0a6':color.edge);
        const ink=a.primary?'#322819':a.disabled?'#a0acaa':color.ink;
        text(shorten(a.label,inner-20,15),bx+11,y+(a.detailLines.length?17:a.height/2),15,ink,true);
        a.detailLines.forEach((line,i)=>text(line,bx+11,y+37+i*14,12,a.primary?'#503e29':color.muted));
        if(!a.disabled)area(a.label,bx,Math.max(start,y),inner,Math.min(end,y+a.height)-Math.max(start,y),a.run);
      }
      y+=a.height+6;
    });
    ctx.restore();
    if(p.maxScroll>0){
      const track=end-start,thumb=Math.max(22,track*track/natural);
      box(mx+mw-4,start+(track-thumb)*p.scroll/p.maxScroll,2,thumb,'#798480');
    }
  }
  function draw(t){
    if(!ready||!live)return;
    frameTime=t;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=color.bg;ctx.fillRect(0,0,width,height);
    ctx.translate(offset,0);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;
    areas=[];grid=null;
    chrome();
    if(modeId==='express' && fast.state.phase==='plan'){
      if(panel && !fast.state.paused)fast.pause();
      else if(!panel && fast.state.paused)fast.resume();
    }
    modes[modeId].draw(t);
    nav();drawSheet();
    if(t<toastUntil){const tw=Math.min(W-28,ctx.measureText(toastText).width+32);box((W-tw)/2,top+48,tw,34,'#384940','#a2ba9e');text(shorten(toastText,tw-12,13),W/2,top+65,13,'#ecf4dc',true,'center');}
  }
  function loop(){
    handle=null;if(!live)return;
    const t=now(), state=(modeId==='express'?fast:game).state;
    const interval=state.phase==='plan' && !panel?.visual?90:32;
    if(t-lastPaint>=interval){lastPaint=t;draw(t);}
    handle=platform.raf(loop);
  }
  function show(){if(live)return;live=true;resize();modes[modeId].show?.();draw(now());if(handle===null)handle=platform.raf(loop);}
  function hide(){if(!live)return;live=false;gesture=null;modes[modeId].hide?.();platform.quiet?.();if(handle!==null)platform.caf(handle);handle=null;}
  function switchMode(next){
    if(next===modeId || panel)return;
    modes[modeId].hide?.();modeId=next;
    try{store?.setItem('mine.mobile.mode',next);}catch{}
    modes[next].show?.();
  }
  function logical(pos){return {x:(pos.x-offset)/scale,y:pos.y/scale};}
  const inside=(p,r)=>r && p.x>=r.x && p.x<r.x+r.w && p.y>=r.y && p.y<r.y+r.h;
  function cellAt(pos){
    return {x:Math.floor((pos.x-grid.x)*8/grid.w),y:Math.floor((pos.y-grid.y)*7/grid.h)};
  }
  function place(pos){
    if(!grid||!inside(pos,grid))return;
    const {x,y}=cellAt(pos);
    const key=x+','+y;if(key===gesture.cell)return;gesture.cell=key;
    const engine=grid.engine,s=engine.state,kind=s.board[y][x];
    if(kind==='copper'||kind==='crystal')return;
    const last=s.path[s.path.length-1],distance=Math.abs(last.x-x)+Math.abs(last.y-y);
    if(distance===0 || (gesture.moved && (kind!=='ground' || distance!==1)))return;
    const before=engine.preview(),len=s.path.length;
    grid.onCell(x,y);
    if(engine.state!==s || s.phase!=='plan' || s.path.length===len)return;
    inspection=null;
    if(s.path.length<len){pulse=null;return;}
    const ores=feedback.added(before,engine.preview());
    if(ores.length){
      const sums={copper:0,crystal:0};
      for(const ore of ores)sums[ore.type]+=ore.amount;
      const gain=[sums.copper?'铜 +'+sums.copper:'',sums.crystal?'晶 +'+sums.crystal:''].filter(Boolean).join(' · ');
      pulse={ores,start:now(),note:'本段新矿　'+gain};
    }
  }
  function touch(kind,pos){
    if(!live || !pos)return;
    const p=logical(pos);
    if(kind==='start'){
      if(gesture)return;
      const hit=areas.slice().reverse().find(r=>inside(p,r));
      const onGrid=!hit && inside(p,grid);
      const tile=onGrid?cellAt(p):null;
      const ore=tile?feedback.inspect(grid.engine.state,tile.x,tile.y):null;
      gesture={id:pos.id,hit,onGrid,ore,down:p,prev:p,cell:null,moved:false,owner:panel};
      if(onGrid && !ore)place(p);
    }else if(gesture && gesture.id===pos.id){
      const g=gesture;
      if(kind==='cancel'){gesture=null;return;}
      if(Math.abs(p.x-g.down.x)+Math.abs(p.y-g.down.y)>7)g.moved=true;
      if(g.moved)g.ore=null;
      const trackSample=kind==='move' || (kind==='end' && g.moved && (p.x!==g.prev.x || p.y!==g.prev.y));
      if(g.onGrid && !g.ore && trackSample && !panel){
        const steps=Math.max(1,Math.ceil(Math.max(Math.abs(p.x-g.prev.x),Math.abs(p.y-g.prev.y))/10));
        for(let i=1;i<=steps;i++)place({x:g.prev.x+(p.x-g.prev.x)*i/steps,y:g.prev.y+(p.y-g.prev.y)*i/steps});
      }else if(kind==='move' && g.moved && panel && g.owner===panel && g.down.y>=panel.viewport?.top){
        panel.scroll=Math.min(panel.maxScroll,Math.max(0,panel.scroll+g.prev.y-p.y));
      }
      if(kind==='end'){
        gesture=null;
        if(!g.moved && g.ore && grid && inside(p,grid)){
          const cell=cellAt(p);
          if(cell.x===g.ore.x && cell.y===g.ore.y){
            const same=inspection && inspection.x===cell.x && inspection.y===cell.y;
            inspection=same?null:cell;pulse=null;toastUntil=0;
          }
        }else if(!g.moved && g.hit && inside(p,g.hit) && g.owner===panel)g.hit.fn(p.x,p.y);
      }else g.prev=p;
    }
    draw(now());
  }
  ui={...core,art,finale:core.MineFinaleArt,game,fast,now,play,boardView,mapView,returnFrame,sheet,ending,close,
    sheetOpen:()=>!!panel,paint:()=>fast.state.paint,mode:()=>modeId,haptic:()=>{platform.haptic?.();if(sound)platform.sound?.('rail');},
    toast(s){toastText=String(s||'');toastUntil=now()+1500;}};
  Object.assign(ui,createLibrary(ui));
  modes={campaign:createCampaign(ui),express:createExpress(ui)};
  ready=true;
  return {show,hide,resize,touch,destroy(){hide();platform.release?.();},cancel(){gesture=null;},back(){if(!panel)return false;dismiss();draw(now());return true;}};
};
