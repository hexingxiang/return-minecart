/* Short- and long-range mine surveys, shared by the campaign and express run. */
(() => {
  'use strict';
  const start={x:0,y:3};
  const tileNames={ground:'floor',rock:'wall',copper:'copper',crystal:'crystal'};
  const cardIcons={long:'rail',coil:'copper',lens:'crystal'};
  const cardEffects={standard:'贴边采矿',long:'多带 2 节轨道',coil:'斜角也收铜矿',lens:'斜角也收蓝晶'};
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=id=>'<canvas width="16" height="16" class="scout-icon" data-scout-icon="'+escape(id)+'" aria-hidden="true"></canvas>';
  const at=(p,x,y)=>p && p.x===x && p.y===y;

  function mapSummary(map){
    const terrain={ground:'空地',rock:'岩壁',copper:'铜',crystal:'晶'};
    return map.board.map((row,y)=>{
      const description=row.map((tile,x)=>{
        if(at(start,x,y))return '起点';
        if(at(map.relic,x,y))return '藏品岩壁';
        if(map.rubble.some(p=>at(p,x,y)))return '碎岩';
        const amount=map.amounts[y][x];
        return terrain[tile]+(amount?'×'+amount:'')+(at(map.jade,x,y)?'含玉料':'')+(at(map.oddity,x,y)?'含钢筋':'');
      });
      return '第'+(y+1)+'行，从左到右为'+description.join('、')+'。';
    }).join(' ');
  }

  function drawMap(canvas,map,options,number){
    const collection=options.engine.state.collection||[];
    MineArt.drawBoard(canvas.getContext('2d'),{
      tiles:map.board.map(row=>row.map(tile=>tileNames[tile])),
      amounts:map.amounts,rubble:map.rubble,relic:map.relic,
      oddity:map.oddity,jade:map.jade,start,path:[start],cart:start,paint:options.paint,
      zone:options.express?number-1:(number<=3?0:number<=7?1:2),
      express:options.express,relicCollected:map.relic && collection.includes(map.relic.id)
    },0);
  }

  function legend(map){
    const keys=[[icon('cart'),'起点'],['<i class="scout-wall-dot" aria-hidden="true"></i>','岩壁']];
    if(map.board.some(row=>row.includes('copper')))keys.push([icon('copper'),'铜矿']);
    if(map.board.some(row=>row.includes('crystal')))keys.push([icon('crystal'),'蓝晶']);
    if(map.rubble.length)keys.push([icon('rubble'),'碎岩 2 轨']);
    if(map.relic)keys.push([icon('relic'),'藏品壁']);
    if(map.oddity)keys.push([icon('rebar'),'钢筋']);
    if(map.jade)keys.push([icon('jade'),'玉料']);
    return '<ul class="scout-legend" aria-label="地形图例">'+keys.map(([mark,text])=>'<li>'+mark+text+'</li>').join('')+'</ul>';
  }

  function loadout(state,number){
    const plan=state.plannedEquipment || {};
    const set=Object.prototype.hasOwnProperty.call(plan,number);
    const selected=set?plan[number]:state.equipped;
    const standard={id:null,name:'标准矿斗'};
    const cards=[standard,...MineGame.cards.filter(card=>state.owned.includes(card.id))];
    const name=(cards.find(card=>card.id===selected)||standard).name;
    const buttons=cards.map(card=>'<button class="quiet scout-gear" data-prepare="'+(card.id||'')+
      '" aria-pressed="'+(card.id===selected)+'">'+icon(cardIcons[card.id]||'cart')+'<span><b>'+escape(card.name)+
      '</b><small>'+cardEffects[card.id||'standard']+'</small></span></button>').join('');
    return '<div class="scout-action"><h3>为第 '+number+' 关预装</h3><div class="scout-gear-list">'+buttons+
      '</div><p class="scout-detail">'+(set?'已预装':'当前沿用')+' · '+escape(name)+'</p></div>';
  }

  function upgrades(options,offset,state){
    if(offset!==1 || state.phase!=='offer' || typeof options.advance!=='function'){
      const text=offset===1?'到站交货后可选择加价券或备用轨。':'抵达前一站并交货后，可选这张地图的改装。';
      return '<p class="scout-detail">'+text+'</p>';
    }
    const steel=Boolean(state.result?.foundRebar);
    return '<div class="scout-action"><h3>选好改装，直接续运</h3><div class="scout-upgrades">'+
      '<button class="scout-upgrade" data-scout-bonus="double">'+icon('voucher')+'<span><b>加价券</b><small>铜矿和蓝晶卖双倍</small></span></button>'+
      '<button class="scout-upgrade" data-scout-bonus="rail">'+icon('spare')+'<span><b>备用轨</b><small>本站多 1 节轨</small></span></button></div>'+
      (steel?'<p class="scout-detail">'+icon('rebar')+' 上站捡到的螺纹钢随车再加 1 节轨。</p>':'')+'</div>';
  }

  function mapMarkup(result,options,offset){
    const {map,number}=result;
    const stage=map.stage,order=map.order;
    const unit=options.express?'站':'关';
    const manifest=[order.copper?icon('copper')+'铜 '+order.copper:'',order.crystal?icon('crystal')+'晶 '+order.crystal:''].filter(Boolean);
    const seconds=options.express?MineExpress.durations[number-1]:null;
    const action=options.express?upgrades(options,offset,options.engine.state):loadout(options.engine.state,number);
    return '<div class="scout-stage"><h3>第 '+number+' '+unit+' · '+escape(stage.name)+'</h3><div class="scout-stats">'+
      '<span aria-label="订单">货单　'+manifest.join('　')+'</span><span>'+icon('rail')+'基础 '+stage.budget+' 轨</span>'+
      (seconds?'<span>'+icon('bell')+seconds+' 秒</span>':'')+'</div></div>'+
      '<div class="scout-chart"><canvas id="scout-map" width="320" height="280" role="img" aria-label="'+
      escape(stage.name)+'勘探图，出发点在左边第四行" aria-describedby="scout-description"></canvas></div>'+
      '<div id="scout-description" class="sr">'+escape(mapSummary(map))+'</div>'+legend(map)+action;
  }

  function lockedMarkup(result,options){
    const state=options.engine.state,unit=options.express?'站':'关';
    const enough=state.surveyTickets>0;
    return '<section class="scout-sealed">'+icon('ticket')+'<h3>第 '+result.number+' '+unit+'的矿图待勘探</h3>'+
      '<p>用 1 张勘探券揭开这张地图，之后可反复查看。</p>'+
      '<button id="scout-spend" class="control primary"'+(enough?'':' disabled')+'>'+
      (enough?'确认用 1 张券勘探':'需要 1 张勘探券')+'</button></section>';
  }

  function open(options,initialOffset=1){
    const {engine,express}=options;
    const source=express?'每累计完成 3 站快运交货，可得 1 张券。':'首次通过第 3、6、9… 关，各得 1 张券。';
    const unit=express?'站':'矿';
    const initial=initialOffset===2?2:1;

    function render(offset,message='',focusSelector=''){
      const previousScroll=focusSelector?document.getElementById('fast-dialog')?.scrollTop||0:0;
      const query=engine.scout(offset);
      const ticketCount=engine.state.surveyTickets;
      const tab=(n,name)=>'<button role="tab" id="scout-tab-'+n+'" data-scout-offset="'+n+'" aria-selected="'+
        (offset===n)+'" tabindex="'+(offset===n?'0':'-1')+'" aria-controls="scout-content">'+name+'</button>';
      let content;
      if(query.ok)content=mapMarkup(query,options,offset);
      else if(query.locked)content=lockedMarkup(query,options);
      else content='<div class="scout-empty">'+icon('bell')+'<p>'+escape(query.reason||'当前没有可勘探的地图')+'</p></div>';
      const body='<section id="scout-panel"><div class="scout-toolbar"><div role="tablist" aria-label="勘探距离" class="scout-tabs">'+
        tab(1,'下一'+unit+' · 免费')+tab(2,'隔一'+unit)+'</div><span class="scout-wallet">'+icon('ticket')+
        '券 <b>'+ticketCount+'</b></span></div><div id="scout-content" role="tabpanel" aria-labelledby="scout-tab-'+offset+'">'+
        content+'</div><p class="scout-source">'+source+'</p>'+(message?'<p class="scout-feedback" role="status">'+escape(message)+'</p>':'')+'</section>';
      const backLabel=options.backLabel || (express && engine.state.phase==='offer'?'返回站间选择':'返回矿区');
      options.show('矿道勘探',body,'<button class="control" id="scout-close">'+escape(backLabel)+'</button>');
      const panel=document.getElementById('scout-panel');
      if(!panel)return;
      if(query.ok)drawMap(panel.querySelector('#scout-map'),query.map,options,query.number);
      panel.querySelectorAll('[data-scout-icon]').forEach(canvas=>{
        MineArt.drawIcon(canvas.getContext('2d'),canvas.dataset.scoutIcon);
      });
      for(const button of panel.querySelectorAll('[data-scout-offset]')){
        button.onclick=()=>render(Number(button.dataset.scoutOffset));
        button.onkeydown=e=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
          e.preventDefault();e.stopPropagation();
          render(e.key==='Home'?1:e.key==='End'?2:3-Number(button.dataset.scoutOffset));
        };
      }
      const spend=panel.querySelector('#scout-spend');
      if(spend)spend.onclick=()=>{
        const response=engine.revealScout();
        render(2,response.ok?'远处矿图已揭开。':response.reason);
      };
      panel.querySelectorAll('[data-prepare]').forEach(button=>{
        button.onclick=()=>{
          const id=button.dataset.prepare||null;
          const response=engine.prepareEquip(id,query.number);
          render(offset,response.ok?'装备将在进入第 '+query.number+' 关时生效。':response.reason,
            '[data-prepare="'+(id||'')+'"]');
        };
      });
      panel.querySelectorAll('[data-scout-bonus]').forEach(button=>{
        button.onclick=()=>options.advance(button.dataset.scoutBonus);
      });
      document.getElementById('scout-close').onclick=options.close;
      if(previousScroll)panel.closest('dialog').scrollTop=previousScroll;
      (panel.querySelector(focusSelector||'#scout-tab-'+offset))?.focus({preventScroll:true});
    }
    render(initial);
  }

  window.MineScout={open};
})();
