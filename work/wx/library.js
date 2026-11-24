/* Native survey, collection and vehicle showroom. Shares the active game save. */
'use strict';

const cutNames = { 20:'石皮偏厚', 40:'浅青细纹', 80:'浓翠透光', 100:'满翠通透' };
const effects = { long:'多带 2 节轨道', coil:'斜角也收铜矿', lens:'斜角也收蓝晶' };
const colors = { jade:'#9ed7ad', brass:'#e3bd7d', dim:'#a8b9b1', rail:'#697b7f', metal:'#43565e' };

function caption(ctx, text, x, y, color, px=12) {
  ctx.font = 'bold ' + px + 'px sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function rail(ctx, x, y, width) {
  ctx.fillStyle = '#846145';
  for (let n = x + 4; n < x + width - 3; n += 9) ctx.fillRect(n, y - 1, 4, 6);
  ctx.fillStyle = colors.rail; ctx.fillRect(x, y, width, 2);
  ctx.fillStyle = colors.metal; ctx.fillRect(x, y + 3, width, 2);
}

module.exports = function createLibrary(host) {
  const models = host.MineExpress.paints;
  const specimens = host.MineLevels.relics;

  function closeTo(afterClose) {
    host.close();
    if (typeof afterClose === 'function') afterClose();
  }

  function scout(offset=1, afterClose, advance) {
    const express = host.mode() === 'express';
    const engine = express ? host.fast : host.game;
    const unit = express ? '站' : '关';
    const back = () => closeTo(afterClose);
    const backLabel = afterClose ? (express ? '返回站间选择' : '返回结算') : '返回矿区';
    const source = express ? '累计交货每满 3 站，领取 1 张勘探券。' : '首次通过第 3、6、9… 关，各得 1 张勘探券。';

    function render(distance, feedback) {
      const result = engine.scout(distance), state = engine.state;
      const other = distance === 1 ? 2 : 1;
      const otherAction = {label: other === 1 ? '看下一' + unit + ' · 免费' : '看隔一' + unit + '的矿图', run:() => render(other)};
      const lines = [], actions = [];
      let visual;
      if (!result.ok) {
        if (result.locked) {
          lines.push('第 ' + result.number + ' ' + unit + '的矿图尚未揭开。', '花 1 张勘探券查看，之后可重复查看。', '持有 ' + state.surveyTickets + ' 张券。', source);
          actions.push({ label:'确认用 1 张券勘探', primary:true, disabled:state.surveyTickets < 1, run:() => {
            const reveal = engine.revealScout();
            if (!reveal.ok) host.toast(reveal.reason);
            render(distance);
          }});
        } else lines.push(result.reason || '本趟没有后续矿图。');
        actions.push(otherAction);
      } else {
        const { map, number } = result, stage = map.stage;
        const zone = express ? number - 1 : number <= 3 ? 0 : number <= 7 ? 1 : 2;
        const view = host.mapView(map, zone, express);
        visual = {static:true,width:320, height:280, maxFraction:.45, draw(ctx,w,h){host.art.drawBoard(ctx,view,0);}};
        const cargo = [map.order.copper ? '铜 ' + map.order.copper : '', map.order.crystal ? '晶 ' + map.order.crystal : ''].filter(Boolean).join('、');
        lines.push('第 ' + number + ' ' + unit + ' · ' + stage.name, '货单 ' + cargo + '　基础 ' + stage.budget + ' 轨' + (express ? '　' + host.MineExpress.durations[number-1] + ' 秒' : ''));
        const legend = ['黄车为起点','黄矿是铜','蓝矿是晶'];
        if (map.rubble.length) legend.push('裂地耗 2 轨');
        if (map.relic) legend.push('琥珀岩壁藏化石');
        if (map.oddity) legend.push('银肋为钢筋');
        if (map.jade) legend.push('绿石皮是玉料');
        lines.push(legend.join(' · '));
        actions.push(otherAction);
        if (express) {
          if (distance === 1 && state.phase === 'offer' && typeof advance === 'function') {
            if (state.result.foundRebar) lines.push('上站的螺纹钢随车再加 1 轨。');
            actions.push({ label:'带加价券去这站', detail:'铜矿和蓝晶卖双倍', run:() => advance('double') },
              { label:'带备用轨去这站', detail:'这一站多带 1 轨', run:() => advance('rail') });
          } else lines.push('前一站交货后，可为这张图选加价券或备用轨。');
        } else {
          const plan = state.plannedEquipment;
          const explicit = Object.prototype.hasOwnProperty.call(plan, number);
          const selected = explicit ? plan[number] : state.equipped;
          const cards = [{id:null,name:'标准矿斗'},...host.MineGame.cards.filter(card => state.owned.includes(card.id))];
          const selectedName = cards.find(card => card.id === selected)?.name || '标准矿斗';
          lines.push((explicit ? '已预装' : '沿用当前装备') + ' · ' + selectedName + '。进入第 ' + number + ' 关时生效。');
          for (const card of cards) {
            const same = selected === card.id;
            actions.push({label:(same ? '✓ ' : '预装 ') + card.name, detail:effects[card.id] || '贴边采矿',
              disabled:explicit && same, run:() => {
                const response = engine.prepareEquip(card.id, number);
                if (!response.ok) host.toast(response.reason);
                render(distance, response.ok ? '已为这张矿图预装' + card.name : '');
              }});
          }
        }
        if (feedback) host.toast(feedback);
        lines.push('持有 ' + state.surveyTickets + ' 张勘探券。' + source);
      }
      actions.push({label:backLabel, run:back});
      host.sheet({ title:'矿道勘探 · ' + (distance === 1 ? '下一' + unit : '隔一' + unit), visual, lines, actions, onClose:back });
    }
    render(offset === 2 ? 2 : 1);
  }

  function yard(afterClose) {
    const back = () => closeTo(afterClose);
    const end = { label: afterClose ? '返回上一步' : '返回矿区', run:back };
    const state = () => host.fast.state;
    function status(model) {
      const s = state();
      if (model.id === s.paint) return '正在驾驶';
      if (s.paints.includes(model.id)) return '已入库';
      if (model.milestone) {
        const n = host.MineExpress.albumProgress(s.album)[model.milestone];
        return model.requirement + ' · ' + Math.min(n, model.target) + '/' + model.target;
      }
      return model.price + ' 币兑换';
    }

    function gallery() {
      const s = state();
      const select = index => { if (models[index]) inspect(models[index]); };
      const visual = {static:true,width:320,height:142,onTap(x,y){
        if (x >= 0 && x < 320 && y >= 0 && y < 142) select(Math.floor(y/71)*3+Math.floor(x/(320/3)));
      },draw(ctx){
        for (let i=0;i<models.length;i++) {
          const m=models[i],col=i%3,row=Math.floor(i/3),x=col*107,y=row*71;
          const active=m.id===state().paint, owned=state().paints.includes(m.id);
          ctx.save();ctx.translate(x+11,y);host.art.drawVehicle(ctx,m.id,82,48);ctx.restore();
          rail(ctx,x+9,y+45,85);
          caption(ctx,m.name,x+51,y+60,active?colors.brass:owned?colors.jade:colors.dim,11);
          if(active){ctx.fillStyle=colors.brass;ctx.fillRect(x+10,y+2,11,2);ctx.fillRect(x+10,y+2,2,8);}
        }
      }};
      const actions = [{ label:'打开收藏图鉴', run:album }, ...models.map((m,i) => ({label:m.name, detail:status(m), run:() => select(i)})), end];
      const featured=models.find(m=>m.id===s.paint);
      host.sheet({ title:'收藏车库', visual, lines:['驾驶 ' + featured.name + '　余额 ' + s.coins + ' 币',
        '车型 ' + s.paints.length + ' / ' + models.length + '。所有车型共用采矿数值。'], actions, onClose:back });
    }

    function inspect(model) {
      const s=state(),owned=s.paints.includes(model.id),driving=s.paint===model.id;
      const unlocked=owned || (!model.milestone && s.coins>=model.price);
      const visual={static:true,width:320,height:110,draw(ctx){
        ctx.save();ctx.translate(65,0);host.art.drawVehicle(ctx,model.id,190,106);ctx.restore();rail(ctx,52,98,216);
      }};
      const action={label:driving?'正在驾驶':owned?'换上这辆车':model.milestone?'达成条件后自动入库':model.price+' 币兑换并驾驶',
        disabled:driving || !unlocked,primary:!driving && unlocked,run:() => {
          const res=host.fast.buyPaint(model.id);
          if (!res.ok) host.toast(res.reason);
          else host.toast('已换上' + model.name);
          inspect(model);
        }};
      host.sheet({title:model.name,visual,lines:[status(model)+'　余额 '+s.coins+' 币','主线和快运共用这辆车。'],
        actions:[action,{label:'返回全部车型',run:gallery},end],onClose:gallery});
    }

    function album() {
      const s=state(), counts=s.album, cutGrades=host.MineExpress.albumProgress(counts).grades;
      const collected=host.game.state.collection;
      const visual={static:true,width:320,height:74,draw(ctx){
        const items=[...host.MineExpress.jadeCuts.map(cut=>({id:'jade-cut',value:cut.value,known:counts.cuts[cut.value]>0})),
          ...specimens.map(item=>({id:item.id,name:item.name,known:collected.includes(item.id)}))];
        const stride=44;
        items.forEach((item,i)=>{
          const x=6+i*stride;
          ctx.fillStyle=item.known?'#344b48':'#2c373e';ctx.fillRect(x,8,41,55);
          ctx.save();ctx.globalAlpha=item.known?1:.48;host.art.drawIcon(ctx,item.id,x+5,12,2);ctx.restore();
          caption(ctx,item.name||item.value+' 币',x+21,54,item.known?colors.jade:colors.dim,9);
        });
      }};
      const lines=['快运交货 ' + counts.deliveries + ' 站　原石整卖 ' + counts.sold + ' 次。', '翡翠成色 ' + cutGrades + '/4'];
      for(const cut of host.MineExpress.jadeCuts) lines.push(cutNames[cut.value]+' · '+cut.value+' 币 · '+(counts.cuts[cut.value]?'已开出 ×'+counts.cuts[cut.value]:'待开出'));
      lines.push('主线化石 '+collected.length+'/'+specimens.length);
      for(const item of specimens) lines.push(item.name+' · '+(collected.includes(item.id)?'已收藏':'待发掘'));
      host.sheet({title:'收藏图鉴',visual,lines,actions:[{label:'返回车型',run:gallery},end],onClose:gallery});
    }
    gallery();
  }

  return { scout, yard };
};
