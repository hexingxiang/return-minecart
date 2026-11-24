'use strict';

// 矿井主线的触摸界面。铺轨、结算、存档都由现有 MineGame 实例负责。
module.exports = function createCampaign(host) {
  const game = host.game;
  const catalog = host.MineGame;
  const { stages, relics } = host.MineLevels;
  const travelMs = 150;
  let active = true;
  let journey = null;
  let presentOutcome = game.state.phase === 'done';

  const card = id => catalog.cards.find(item => item.id === id);
  const relic = id => relics.find(item => item.id === id);
  const orderText = bag => [
    bag.copper ? bag.copper + ' 铜' : '',
    bag.crystal ? bag.crystal + ' 晶' : ''
  ].filter(Boolean).join(' · ') || '0 份矿石';

  function action(label, run, extra = {}) {
    return { label, run, ...extra };
  }

  function clearPanels() {
    host.close();
    journey = null;
    presentOutcome = false;
  }

  function runOperation(response, then) {
    if (!response.ok) {
      host.toast(response.reason);
      return;
    }
    if (then) then();
  }

  function visit(level) {
    runOperation(game.visit(level), clearPanels);
  }

  function nextRound() {
    runOperation(game.next(), clearPanels);
  }

  function atDepot() {
    const s = game.state;
    return s.phase === 'plan' && s.path.length === 1 && !journey;
  }

  function canTravel() {
    const s = game.state;
    return !journey && ((s.phase === 'plan' && s.path.length === 1) ||
      (s.phase === 'done' && s.result.dig !== 'pending'));
  }

  function openAtlas() {
    const s = game.state;
    const actions = stages.map((stage, index) => {
      const level = index + 1;
      const status = s.gold.includes(level) ? '★ 金轨' : level < s.frontier ? '已通过' :
        level === s.round ? '当前关卡' : level <= s.frontier ? '已解锁' : '待解锁';
      const record = s.bestRails[level] ? ' · 纪录 ' + s.bestRails[level] + ' 轨' : '';
      return action('第 ' + level + ' 关 · ' + stage.name, () => visit(level), {
        detail: status + ' · ' + orderText(stage.order) + record,
        disabled: level > s.frontier || level === s.round || !canTravel()
      });
    });
    if (s.frontier > stages.length && s.round !== s.frontier) {
      actions.unshift(action('返回深层第 ' + s.frontier + ' 关', () => visit(s.frontier), { disabled: !canTravel() }));
    }
    host.sheet({
      title: '关卡手册',
      lines: ['已解锁至第 ' + s.frontier + ' 关。可在铺轨前或回营后重访旧矿井。'],
      actions
    });
  }

  function openCards() {
    const s = game.state;
    const actions = catalog.cards.map(item => {
      const owned = s.owned.includes(item.id);
      return action(owned ? item.name + ' · 已收藏' : '兑换' + item.name, () => {
        runOperation(game.redeem(item.id), () => {
          host.haptic();
          openCards();
        });
      }, {
        detail: item.description,
        disabled: owned || !atDepot() || s.wallet.plans < catalog.redeemCost
      });
    });
    actions.push(action('返回工坊', openWorkshop));
    host.sheet({
      title: '装备卡册 ' + s.owned.length + ' / ' + catalog.cards.length,
      lines: [
        '每关首次交齐订单可翻一张装备卡，三款各占 1/3。重复卡换成 1 张图纸。',
        '现有 ' + s.wallet.plans + ' 张图纸，' + catalog.redeemCost + ' 张可换一件未收藏的装备。'
      ],
      actions
    });
  }

  function openWorkshop() {
    const s = game.state;
    const available = atDepot();
    const equipped = card(s.equipped);
    const gear = [{ id: null, name: '标准矿斗', description: '拾取轨道上下左右的矿石。' },
      ...catalog.cards.filter(item => s.owned.includes(item.id))];
    const actions = gear.map(item => action(
      (s.equipped === item.id ? '已装配 · ' : '装上 · ') + item.name,
      () => runOperation(game.equip(item.id), openWorkshop),
      { detail: item.description, disabled: !available || s.equipped === item.id }
    ));
    const cost = catalog.upgradeCost(s);
    actions.push(action(cost ? '制作一节永久长轨' : '永久长轨已升满', () => {
      runOperation(game.upgrade(), () => { host.haptic(); openWorkshop(); });
    }, {
      detail: cost ? '花费 ' + orderText(cost) + ' · 此后每关多 1 轨' : '已制作 ' + s.upgrades + ' 节',
      disabled: !available || !cost || s.wallet.copper < cost.copper || s.wallet.crystal < cost.crystal
    }));
    actions.push(action('打开装备卡册', openCards, { detail: '收集进度 ' + s.owned.length + ' / ' + catalog.cards.length }));
    host.sheet({
      title: '矿井工坊',
      lines: [
        '仓库 · ' + s.wallet.copper + ' 铜 · ' + s.wallet.crystal + ' 晶 · ' + s.wallet.plans + ' 图纸',
        available ? '出发装备 · ' + (equipped ? equipped.name : '标准矿斗') : '回营后，在下一趟铺轨前换装或升级。'
      ],
      actions
    });
  }

  function openMuseum() {
    const s = game.state;
    const actions = relics.map(item => {
      const owned = s.collection.includes(item.id);
      const sites = stages.flatMap((stage, i) => stage.relic && stage.relic.id === item.id ? [i + 1] : []);
      const target = sites.find(level => level <= s.frontier && level !== s.round);
      let detail = owned ? item.description : '矿壁线索 · 第 ' + sites.join('、') + ' 关';
      if (!owned && target && canTravel()) detail += ' · 点此前往第 ' + target + ' 关';
      return action(item.name + (owned ? ' · 已收藏' : ' · 待发掘'), () => visit(target), {
        detail, disabled: owned || !target || !canTravel()
      });
    });
    host.sheet({
      title: '矿井藏品 ' + s.collection.length + ' / ' + relics.length,
      lines: ['铺轨靠近发光的岩壁，回程对准金纹敲开矿壳。'],
      actions
    });
  }

  function drawMeter(ctx, w, h, position, left, width) {
    const x = w * 0.08, barW = w * 0.84, y = h * 0.48, barH = Math.max(15, h * 0.25);
    ctx.save();
    ctx.fillStyle = '#171f25'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#5a5550'; ctx.fillRect(x-2,y-2,barW+4,barH+4);
    ctx.fillStyle = '#343e46'; ctx.fillRect(x,y,barW,barH);
    const bandX = x + barW * left, bandW = barW * width;
    ctx.fillStyle = '#bb813d'; ctx.fillRect(bandX,y,bandW,barH);
    ctx.fillStyle = '#f3cf80'; ctx.fillRect(bandX,y,bandW,3);
    for (let mark = bandX + 3; mark < bandX + bandW - 2; mark += 8) {
      ctx.fillRect(mark, y + barH - 6, 2, 4);
    }
    const needle = x + barW * position;
    ctx.fillStyle = '#fff4d6'; ctx.fillRect(needle-2,y-8,4,barH+16);
    ctx.fillRect(needle-4,y-11,8,4);
    ctx.restore();
  }

  function resumeJourney() {
    host.close();
    if (journey && journey.pausedAt !== null) {
      journey.started += host.now() - journey.pausedAt;
      journey.pausedAt = null;
    } else {
      presentOutcome = true;
    }
  }

  function openDig() {
    const s = game.state;
    if (!s.relic || s.result?.dig !== 'pending') return;
    const item = relic(s.relic.id);
    const left = { fern: 0.27, amber: 0.53, shell: 0.39 }[item.id];
    const width = s.round <= 3 ? 0.36 : s.round <= 7 ? 0.29 : 0.24;
    const period = s.round <= 3 ? 1280 : 1030;
    const entered = host.now();
    function pos(now) {
      const leg = (Math.max(0, now - entered) / period) % 2;
      return leg <= 1 ? leg : 2 - leg;
    }
    function strike(skipped) {
      const p = pos(host.now());
      const hit = !skipped && p >= left && p <= left + width;
      runOperation(game.resolveDig(hit), () => {
        host.haptic();
        if (skipped) { resumeJourney(); return; }
        host.sheet({
          title: hit ? '发现' + item.name : '矿壳没有裂开',
          lines: [hit ? item.description + ' 已收入矿井藏品。' : '这锤偏离了金纹。矿石照常入库，重访时还能再试。'],
          actions: [action('继续回程', resumeJourney, {primary:true})],
          onClose: resumeJourney
        });
      });
    }
    host.sheet({
      title: '矿壁里有东西',
      lines: ['等白色指针进入金纹，再敲击岩壁。'],
      visual: { width: 320, height: 88, draw(ctx,w,h,now) { drawMeter(ctx,w,h,pos(now),left,width); } },
      actions: [action('敲击岩壁', () => strike(false), {primary:true}), action('跳过发掘', () => strike(true))],
      // The player can return to the mine and reopen the same pending excavation.
      onClose() { journey = null; presentOutcome = false; }
    });
  }

  function nextLabel(s) {
    if (s.round < s.frontier && !s.result.firstClear) return '返回第 ' + s.frontier + ' 关';
    if (!s.result.met) return '重新开始本关';
    return s.round === stages.length ? '进入深层矿区' : '进入下一关';
  }

  function openResult() {
    const s = game.state, r = s.result;
    if (!r) return;
    if (r.dig === 'pending') { openDig(); return; }
    const lines = ['带回 ' + orderText(r) + '，矿石已入库。'];
    if (!r.met) {
      const missing = { copper: Math.max(0,s.order.copper-r.copper), crystal: Math.max(0,s.order.crystal-r.crystal) };
      lines.push('订单还差 ' + orderText(missing) + '。');
      const hint = host.MineFeedback.lastStepHint(s);
      if (hint) lines.push(hint);
    } else {
      const used = game.used(), par = game.par();
      lines.push((used === par ? '★ 金轨章' : '已交齐订单') + ' · 用轨 ' + used + ' / 最短 ' + par);
    }
    if (r.card) lines.push(r.card.isNew ? '新装备 · ' + card(r.card.id).name + '。' + card(r.card.id).description :
      '翻到重复的' + card(r.card.id).name + '，获得 1 张图纸。');
    if (r.dig === 'found') lines.push('新藏品 · ' + relic(s.relic.id).name);
    if (r.ticketEarned) lines.push('获得 1 张勘探券，可揭开下下关矿图。');
    const actions = [];
    if (!r.met && s.round < s.frontier) {
      actions.push(action('重新开始本关', () => visit(s.round), {primary:true}), action(nextLabel(s), nextRound));
    } else {
      actions.push(action(nextLabel(s), nextRound, {primary:true}));
      if (r.dig === 'miss' && s.round < s.frontier) actions.push(action('重访本关再挖一次', () => visit(s.round)));
    }
    actions.push(action('查看下一关矿图', () => host.scout(1, openResult)));
    const title = r.met ? (r.firstClear && s.round === stages.length ? '主线通关' : '第 ' + s.round + ' 关完成') :
      '第 ' + s.round + ' 关 · 交货不足';
    host.sheet({ title, lines, visual: host.ending(r.met ? 'win' : 'loss'), actions });
  }

  function launch() {
    if (journey) return;
    const s = game.state;
    if (s.phase === 'done') { openResult(); return; }
    runOperation(game.dispatch(), () => {
      host.haptic();
      journey = { started: host.now(), pausedAt: null, stopShown: false };
    });
  }

  function lay(x,y) {
    if (journey || game.state.phase !== 'plan') return;
    const head = game.state.path[game.state.path.length-1];
    if (head.x === x && head.y === y) return;
    runOperation(game.move(x,y), () => host.haptic());
  }

  function collectedQuantities(pieces) {
    const counts = { copper: 0, crystal: 0 };
    for (const piece of pieces) counts[piece.type] += piece.amount;
    return counts;
  }

  function draw(now) {
    if (!active) return;
    const s = game.state, r = s.result;
    const view = host.boardView(game,s.round < 4 ? 0 : s.round < 8 ? 1 : 2,false);
    let counts = r || game.preview(), offerDig = false;
    if (journey && r) {
      let t = Math.max(0, ((journey.pausedAt ?? now) - journey.started) / travelMs);
      if (r.dig === 'pending' && (journey.pausedAt !== null || t >= r.relicStep)) {
        if (journey.pausedAt === null) journey.pausedAt = journey.started + r.relicStep * travelMs;
        t = r.relicStep;
        offerDig = !journey.stopShown;
      }
      host.returnFrame(view,r.steps,t);
      counts = collectedQuantities(view.collected || []);
      if (journey.pausedAt === null && t >= r.steps.length + .45) {
        journey = null;
        presentOutcome = true;
      }
    }
    if (!journey && r) {
      view.cart = s.path[0];
      view.moves = []; view.targets = [];
      view.collected = r.steps.flatMap(step => step.ores);
    }
    const plan = s.phase === 'plan';
    let note = s.stage.tip || '贴着矿脉铺轨，沿原路发车收矿。';
    if (plan && s.round === 1 && s.path.length === 1) note = '向右铺一格就能交单。点矿看采位。';
    if (plan && s.path.length > 1) {
      note = counts.copper >= s.order.copper && counts.crystal >= s.order.crystal ?
        '订单已齐，可以发车。' : '预计带回 ' + orderText(counts) + '。也可以撤回一节改道。';
    } else if (r) {
      note = journey ? '矿车正沿轨道返程收矿。' : r.dig === 'pending' ? '岩壁处有一件藏品等待发掘。' :
        r.met ? '订单已交齐，矿石已入库。' : '矿石已入库，可以重新规划线路。';
    }
    host.play({
      title: s.stage.name, kicker: '矿井主线 · 第 ' + String(s.round).padStart(2,'0') + ' 关',
      order: s.order, counts, rails: s.budget-game.used(), badge: '最短 ' + game.par() + ' 轨',
      note, view, now, onCell: lay,
      undo: { label: '撤轨', run: () => runOperation(game.undo(), () => host.haptic()), disabled: !plan || s.path.length <= 1 || Boolean(journey) },
      go: { label: journey ? '正在返程' : plan ? '发车收矿' : r.dig === 'pending' ? '继续敲矿' : '查看回营结算',
        run: launch, disabled: Boolean(journey) || (plan && s.path.length <= 1) },
      tools: [
        action('关卡手册',openAtlas,{disabled:Boolean(journey)}),
        action('矿井工坊',openWorkshop,{disabled:Boolean(journey)}),
        action('藏品图鉴',openMuseum,{disabled:Boolean(journey)})
      ]
    });
    if (!host.sheetOpen()) {
      if (offerDig && journey) { journey.stopShown = true; openDig(); }
      else if (presentOutcome) { presentOutcome = false; openResult(); }
    }
  }

  return {
    draw,
    show() { active = true; if (!journey && game.state.phase === 'done') presentOutcome = true; },
    hide() { active = false; journey = null; presentOutcome = false; }
  };
};
