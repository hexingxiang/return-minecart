'use strict';

function fareFor(state, cargo) {
  return (cargo.copper * 2 + cargo.crystal * 4) * (state.bonus === 'double' ? 2 : 1);
}

function cargoText(cargo) {
  const lines = [];
  if (cargo.copper > 0) lines.push('铜 ' + cargo.copper);
  if (cargo.crystal > 0) lines.push('晶 ' + cargo.crystal);
  return lines.join(' · ') || '空车';
}

function orderFilled(state, cargo) {
  return cargo.copper >= state.order.copper && cargo.crystal >= state.order.crystal;
}

function missingCargo(state) {
  return cargoText({
    copper: Math.max(0, state.order.copper - state.result.copper),
    crystal: Math.max(0, state.order.crystal - state.result.crystal)
  });
}

function routeNote(state, preview) {
  if (state.phase === 'lost') return '本趟断单，账上已有的矿币保留。';
  if (state.phase === 'banked') return '货款已落袋，可以进车库换车。';
  if (state.phase === 'offer') return state.result.jade === 'pending' ? '矿车带回一块玉料，等你估价。' : '本站已交货，可以落袋或续运。';
  if (!state.started) return state.jade ? '点矿看采位。绿色石皮里藏着玉料。' : '点矿看采位。铺下第一节轨才开始计时。';
  if (preview.foundJade && preview.foundRebar) return '已圈到玉料和螺纹钢，交齐订单一起带回。';
  if (preview.foundJade) return '已圈到玉料，交齐货单后可卖可切。';
  if (preview.foundRebar) return '已圈到螺纹钢，满单续运可多带 1 轨。';
  return orderFilled(state, preview) ? '货单已齐，现在可发车卖矿。' : '让轨道贴近订单上的矿，铃响会自动发车。';
}

module.exports = function createExpress(host) {
  const engine = host.fast;
  const rules = host.MineExpress;
  const stepMs = 155;
  let active = false;
  let tripAnimation = null;
  let seenResult = null;
  let cache = null;

  function route() {
    const state = engine.state;
    const paint = host.paint();
    const head = state.path[state.path.length - 1];
    if (!cache || cache.state !== state || cache.phase !== state.phase || cache.paint !== paint ||
        cache.length !== state.path.length || cache.x !== head.x || cache.y !== head.y) {
      const preview = engine.preview();
      cache = {
        state, phase: state.phase, paint, length: state.path.length, x: head.x, y: head.y,
        preview, board: host.boardView(engine, state.station - 1, true)
      };
    }
    return cache;
  }

  function startReturn(response) {
    if (!response.result || tripAnimation) return;
    tripAnimation = { start: host.now(), result: response.result };
    seenResult = null;
    host.haptic();
  }

  function handle(response) {
    if (response.expired && response.result) {
      if (active && !host.sheetOpen()) startReturn(response);
      return false;
    }
    if (!response.ok) {
      host.toast(response.reason);
      return false;
    }
    return true;
  }

  function move(x, y) {
    const state = engine.state;
    if (!active || tripAnimation || host.sheetOpen() || state.phase !== 'plan') return;
    const head = state.path[state.path.length - 1];
    if (x === head.x && y === head.y) return;
    handle(engine.move(x, y));
  }

  function undo() {
    if (!active || tripAnimation || host.sheetOpen() || engine.state.phase !== 'plan') return;
    handle(engine.undo());
  }

  function launch() {
    if (!active || tripAnimation || host.sheetOpen()) return;
    if (engine.state.phase !== 'plan') {
      outcome();
      return;
    }
    const response = engine.dispatch();
    if (handle(response)) startReturn(response);
  }

  function advance(bonus) {
    if (!handle(engine.advance(bonus))) return;
    seenResult = null;
    host.close();
    host.haptic();
  }

  function bank() {
    if (handle(engine.bank())) {
      host.haptic();
      outcome();
    }
  }

  function restart() {
    if (!handle(engine.restart())) return;
    seenResult = null;
    host.close();
  }

  function settleJade(method) {
    if (handle(engine.resolveJade(method))) {
      host.haptic();
      outcome();
    }
  }

  function jadeVisual(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = '#1d2c31';
    ctx.fillRect(0, 0, w, h);
    const center = Math.floor(w / 2), base = Math.floor(h * 0.76);
    ctx.fillStyle = '#314445';
    ctx.fillRect(center - 106, base, 212, 2);
    ctx.fillStyle = '#475049';
    ctx.fillRect(center - 85, base + 2, 170, 3);
    host.art.drawIcon(ctx, 'jade', center - 76, base - 49, 3);
    host.art.drawIcon(ctx, 'coin', center + 27, base - 35, 2);
    host.art.drawIcon(ctx, 'coin', center + 44, base - 31, 2);
    ctx.restore();
  }

  function jadeSheet() {
    const odds = rules.jadeCuts.map(cut => cut.value + ' 币（' + cut.weight + '%）');
    host.sheet({
      title: '这块玉，卖还是开？',
      visual: { width: 320, height: 78, draw: jadeVisual },
      lines: [
        '商家报价 ' + rules.jadeOffer + ' 币。也可切开原石，按成色出价。',
        '开石售价与概率', odds.slice(0, 2).join('　'), odds.slice(2).join('　'),
        '玉款跟车，到站收车才入账。'
      ],
      actions: [
        { label: '整块卖 · ' + rules.jadeOffer + ' 币', run: () => settleJade('sell') },
        { label: '自己开石', primary: true, run: () => settleJade('cut') }
      ], onClose: () => host.close()
    });
  }

  function discoveries(state) {
    const r = state.result;
    const lines = [];
    if (r.jade === 'cut') {
      const change = r.jadeValue - rules.jadeOffer;
      const comparison = change ? '，比整卖' + (change > 0 ? '多' : '少') + Math.abs(change) + ' 币' : '';
      lines.push('玉料切开值 ' + r.jadeValue + ' 币' + comparison + '。');
    } else if (r.jade === 'sold') lines.push('玉石整块卖出，' + r.jadeValue + ' 币已装车。');
    if (r.jadeValue && rules.albumProgress(state.album).jade === 1) lines.push('穿山甲钻车已入库。');
    if (r.met && state.album.deliveries === 5) lines.push('蒸汽邮车已入库。');
    if (r.jade === 'cut' && rules.albumProgress(state.album).grades === 4 && state.album.cuts[r.jadeValue] === 1) {
      lines.push('四种翡翠成色已集齐，金龙巡游车已入库。');
    }
    if (r.ticketEarned) lines.push('累计交货奖励 · 勘探券 +1');
    return lines;
  }

  function offerSheet(state) {
    const result = state.result, next = engine.nextStop();
    const lines = ['本站交付 ' + cargoText(result) + '，矿款 ' + result.fare + ' 币。'];
    lines.push(...discoveries(state));
    if (result.foundRebar) lines.push('带回一截螺纹钢，续运时额外 +1 轨。');
    lines.push('随车共 ' + state.pot + ' 币。下一站缺货，这笔货款会损失。',
      '下一站 · ' + next.name + '　' + cargoText(next.order) + ' / ' + next.budget + ' 轨 / ' + next.seconds + ' 秒');
    host.sheet({
      title: '收车，还是再跑一站？', lines,
      actions: [
        { label: '收车落袋 · ' + state.pot + ' 币', primary: true, run: bank },
        { label: '看下一站矿图', run: () => host.scout(1, outcome, advance) },
        { label: '带加价券续运', detail: '下一站铜矿和蓝晶售价翻倍', run: () => advance('double') },
        { label: '带备用轨续运', detail: result.foundRebar ? '备用轨加上螺纹钢，共多 2 轨' : '下一站多带 1 轨', run: () => advance('rail') }
      ], onClose: () => host.close()
    });
  }

  function outcome() {
    const state = engine.state, r = state.result;
    if (!active || !r || tripAnimation) return;
    seenResult = r;
    if (state.phase === 'offer') {
      if (r.jade === 'pending') jadeSheet();
      else offerSheet(state);
      return;
    }
    if (state.phase !== 'lost' && state.phase !== 'banked') return;
    const win = state.phase === 'banked';
    const lines = win ? ['这趟存下 ' + state.settled + ' 币。', '账上 ' + state.coins + ' 币 · 单趟最高 ' + state.best + ' 币。'] :
      [(r.timeout ? '发车铃响时，' : '发车时，') + '还差 ' + missingCargo(state) + '。',
        '本趟损失 ' + state.lostFare + ' 币，账上还有 ' + state.coins + ' 币。'];
    if (!win) {
      const hint = host.MineFeedback.lastStepHint(state);
      if (hint) lines.push(hint);
    }
    lines.push(...discoveries(state));
    host.sheet({
      title: win ? (state.station === 3 ? '三站全收！' : '货款已落袋') : '这趟断单了',
      lines, visual: host.ending(win ? 'win' : 'loss'),
      actions: [{ label: '再开一趟', primary: true, run: restart }, { label: '回看线路', run: () => host.close() }],
      onClose: () => host.close()
    });
  }

  function rulesSheet() {
    if (tripAnimation) return;
    const state = engine.state;
    host.sheet({
      title: '快运账本',
      lines: [
        '账上 ' + state.coins + ' 币 · 本趟随车 ' + state.pot + ' 币 · 单趟最高 ' + state.best + ' 币。',
        '三站分别限时 ' + rules.durations.join('、') + ' 秒。铺下第一格轨道开始计时，铃响会按当前线路发车。',
        '满单可卖出整车矿。铜矿每份 2 币、蓝晶每份 4 币。前两站可以落袋，也可带着货款继续。第三站交货后自动落袋。',
        '缺货会损失本趟随车货款。勘探或切到后台会暂停倒计时。'
      ], actions: [{label:'回矿区', primary:true, run:() => host.close()}], onClose:() => host.close()
    });
  }

  function draw(now) {
    if (!active) return;
    if (engine.state.phase === 'plan' && !host.sheetOpen()) {
      const event = engine.tick();
      if (event.expired) startReturn(event);
      else if (!event.ok) handle(event);
    }
    const state = engine.state, data = route(), preview = data.preview;
    const view = { ...data.board, express: true, oddity: state.oddity, jade: state.jade };
    if (tripAnimation) {
      const steps = tripAnimation.result.steps, elapsed = Math.max(0, (now - tripAnimation.start) / stepMs);
      host.returnFrame(view, steps, elapsed);
      if (elapsed >= steps.length + 0.45) tripAnimation = null;
    } else if (state.phase !== 'plan' && state.result) {
      view.collected = state.result.steps.reduce((all, step) => all.concat(step.ores), []);
      view.moves = []; view.targets = []; view.cart = state.path[0];
    }
    const plan = state.phase === 'plan', started = state.started;
    const counts = state.result || preview;
    const met = orderFilled(state, counts), hasRoute = state.path.length > 1;
    const goTitle = tripAnimation ? '正在返程…' : !plan ? '查看结算' : !hasRoute ? '发车交货' :
      met ? '发车 · ' + fareFor(state, counts) + ' 币' : '缺货发车';
    const seconds = Math.ceil(engine.remaining() / 1000);
    const clock = plan ? (started ? '铃响 ' : '首步起计 ') + seconds + '秒' : '已发车';
    const note = tripAnimation ? (state.result.timeout ? '发车铃响，矿车正在返程。' : '矿车沿原路收矿。') : routeNote(state, preview);
    host.play({
      title: state.stage.name,
      kicker: '三站快运 · 第 ' + state.station + ' / 3 站',
      order: state.order, counts, rails: state.budget - engine.used(), badge: clock,
      note, view, onCell: move, now,
      undo: { label: '撤一轨', run: undo, disabled: !plan || !hasRoute || Boolean(tripAnimation) },
      go: { label: goTitle, run: launch, disabled: Boolean(tripAnimation) || (plan && !hasRoute) },
      tools: [{ label: '随车 ' + state.pot + ' 币 · 账本', run: rulesSheet }]
    });
    if (!tripAnimation && state.result && seenResult !== state.result && !host.sheetOpen()) outcome();
  }

  function show() {
    active = true;
    if (engine.state.phase === 'plan' && engine.state.paused && !host.sheetOpen()) handle(engine.resume());
  }

  function hide() {
    active = false;
    tripAnimation = null;
    const state = engine.state;
    if (state.phase === 'plan' && !state.paused) engine.pause();
  }

  return { draw, show, hide };
};
