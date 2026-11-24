/* 三站快运 · 独立的限时运单与货款 */
(() => {
  'use strict';
  const rules = window.MineGame.rules;
  const key = 'huicheng-minecart.express.v1';
  const durations = [24, 21, 18];
  const jadeOffer = 48;
  const jadeCuts = [
    { value: 20, weight: 40 }, { value: 40, weight: 25 },
    { value: 80, weight: 25 }, { value: 100, weight: 10 }
  ];
  const paints = [
    { id: 'standard', name: '原装矿车', price: 0, color: '#b6885e' },
    { id: 'celadon', name: '圆舱探矿车', price: 36, color: '#78c7aa' },
    { id: 'cinnabar', name: '吊臂工程车', price: 80, color: '#ce6553' },
    { id: 'inkjade', name: '穿山甲钻车', price: null, color: '#368e79',
      milestone: 'jade', target: 1, requirement: '出售或切开第一块玉石' },
    { id: 'nightmail', name: '蒸汽邮车', price: null, color: '#7189d6',
      milestone: 'delivery', target: 5, requirement: '累计完成 5 站快运交货' },
    { id: 'gilt', name: '金龙巡游车', price: null, color: '#d9aa4f',
      milestone: 'grades', target: 4, requirement: '亲自切出全部四种成色' }
  ];
  const fail = reason => ({ ok: false, reason });
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const paintById = id => paints.find(item => item.id === id);
  const tiers = () => window.ExpressMaps.tiers;

  function emptyAlbum() {
    return { deliveries: 0, sold: 0, cuts: { 20: 0, 40: 0, 80: 0, 100: 0 } };
  }

  function validateAlbum(album) {
    return album && integer(album.deliveries) && integer(album.sold) && album.cuts &&
      jadeCuts.every(({value}) => integer(album.cuts[value]));
  }

  function albumProgress(album) {
    const cutCounts = jadeCuts.map(({value}) => album.cuts[value]);
    return {
      delivery: album.deliveries,
      jade: album.sold + cutCounts.reduce((sum, count) => sum + count, 0),
      grades: cutCounts.filter(count => count > 0).length
    };
  }

  function unlockModels(state) {
    const progress = albumProgress(state.album);
    for (const model of paints) {
      if (model.milestone && progress[model.milestone] >= model.target && !state.paints.includes(model.id)) {
        state.paints.push(model.id);
      }
    }
  }

  function rebarStop(run, seed) {
    return run === 1 ? 1 : 1 + Math.floor(rules.randomFor(seed ^ 0x1d68b15f)() * 2);
  }

  function jadeStop(run, seed) {
    if (run === 1) return 1;
    const roll = rules.randomFor(seed ^ 0x0ae4d249)();
    if (roll < 2 / 3) return 0;
    return roll < 5 / 6 ? 1 : 2;
  }

  // The sealed value is determined by the run seed, independently of the route
  // and the player's choice. Reopening the game therefore reveals the same stone.
  function cutValue(seed) {
    let roll = Math.floor(rules.randomFor(seed ^ 0x7e36d0a1)() * 100);
    for (const grade of jadeCuts) {
      if (roll < grade.weight) return grade.value;
      roll -= grade.weight;
    }
  }

  function freshRun(seed, run, previous, profile) {
    const random = rules.randomFor(seed ^ Math.imul(run, 0x9e3779b1));
    let runSeed = Math.floor(random() * 4294967296);
    if (previous && previous.runSeed === runSeed) runSeed = (runSeed + 1) >>> 0;
    const count = tiers()[0].length;
    let firstIndex;
    if (previous && count > 1) {
      firstIndex = Math.floor(random() * (count - 1));
      if (firstIndex >= previous.firstIndex) firstIndex++;
    } else {
      firstIndex = Math.floor(random() * count);
    }
    return loadStop({ seed, run, runSeed, lastRunSeed: previous ? previous.runSeed : null,
      firstIndex, rebarStation: rebarStop(run, runSeed), jadeStation: jadeStop(run, runSeed),
      ...profile, surveyTargets: [], pot: 0, settled: 0, lostFare: 0 }, 1, null);
  }

  function stopTemplate(trip, station) {
    const tier = tiers()[station - 1];
    const random = rules.randomFor(trip.runSeed ^ Math.imul(station, 0x85ebca6b));
    const index = station === 1 ? trip.firstIndex : Math.floor(random() * tier.length);
    return { source: tier[index], flip: random() < 0.5 };
  }

  // Only veins accessible on a fulfilled order within the standard rail budget
  // can hold a discovery. Count their frequency to select an easy first find.
  function surveyVeins(stop) {
    const cart = { ...stop, path: [{ x: 0, y: 3 }], budget: stop.stage.budget };
    const eligible = new Map();
    let fullOrders = 0;
    const dirs = [[1,0],[0,-1],[-1,0],[0,1]];
    function search() {
      const goods = rules.computeReturn(cart);
      if (cart.path.length > 1 && goods.copper >= cart.order.copper && goods.crystal >= cart.order.crystal) {
        fullOrders++;
        for (const step of goods.steps) {
          for (const vein of step.ores) {
            const id = vein.y * 8 + vein.x;
            if (!eligible.has(id)) eligible.set(id, { x: vein.x, y: vein.y, type: vein.type, count: 0 });
            eligible.get(id).count++;
          }
        }
      }
      if (rules.usedRails(cart) >= cart.budget) return;
      const head = cart.path[cart.path.length - 1];
      for (const [dx,dy] of dirs) {
        const x = head.x + dx, y = head.y + dy;
        if (cart.path.some(p => p.x === x && p.y === y)) continue;
        if (rules.placeRail(cart, x, y).ok) {
          search();
          rules.removeRail(cart);
        }
      }
    }
    search();
    return { veins: [...eligible.values()], fullOrders };
  }

  function chooseSeam(stop, survey, kind) {
    const steel = kind === 'rebar';
    const veins = steel ? survey.veins.filter(v => v.type === 'copper') : survey.veins;
    if (!veins.length) return null;
    const optional = veins.filter(v => v.count < survey.fullOrders);
    let choices = optional.length ? optional : veins;
    if (!steel && stop.run === 1) {
      const peak = Math.max(...veins.map(v => v.count));
      choices = veins.filter(v => v.count === peak);
    }
    const salt = steel ? 0x1859aa71 : 0x3b6a1a57;
    const random = rules.randomFor(stop.runSeed ^ Math.imul(stop.station, salt));
    const { x,y } = choices[Math.floor(random() * choices.length)];
    return { x,y,kind };
  }

  function loadStop(trip, station, bonus, rebarRail = false) {
    const { source, flip } = stopTemplate(trip, station);
    const rows = flip ? source.rows.slice().reverse() : source.rows;
    const map = rules.decodeStage(source, rows, false);
    map.rubble = (source.rubble || []).map(p => ({ x: p.x, y: flip ? rows.length - 1 - p.y : p.y }));
    const stop = {
      ...trip, ...map, station, bonus, rebarRail, oddity: null, jade: null,
      budget: source.budget + (bonus === 'rail' ? 1 : 0) + (rebarRail ? 1 : 0),
      equipped: null, collection: [], phase: 'plan', path: [{ x: 0, y: 3 }], result: null,
      started: false, paused: false, leftMs: durations[station - 1] * 1000, deadline: null
    };
    if (trip.rebarStation === station || trip.jadeStation === station) {
      const survey = surveyVeins(stop);
      if (trip.rebarStation === station) stop.oddity = chooseSeam(stop, survey, 'rebar');
      if (trip.jadeStation === station) stop.jade = chooseSeam(stop, survey, 'jade');
    }
    return stop;
  }

  function preview(state) {
    const goods = rules.computeReturn(state);
    const found = seam => Boolean(seam && state.path.length > 1 && goods.steps.some(step =>
      step.ores.some(vein => vein.x === seam.x && vein.y === seam.y)));
    return { ...goods, foundRebar: found(state.oddity), foundJade: found(state.jade) };
  }

  function delivery(state, timeout) {
    const goods = preview(state);
    const met = state.path.length > 1 && goods.copper >= state.order.copper && goods.crystal >= state.order.crystal;
    const fare = met ? (goods.copper * 2 + goods.crystal * 4) * (state.bonus === 'double' ? 2 : 1) : 0;
    const jade = met && goods.foundJade ? 'pending' : 'none';
    return { ...goods, met, fare, timeout, jade, jadeValue: 0, ticketEarned: false };
  }

  function restore(raw) {
    let d;
    try { d = JSON.parse(raw); } catch { return null; }
    if (!d || ![1,2,3,4].includes(d.version) || !integer(d.seed) || !integer(d.run) || !integer(d.runSeed) ||
        !integer(d.firstIndex) || d.firstIndex >= tiers()[0].length ||
        ![1,2,3].includes(d.station) || !['plan','offer','lost','banked'].includes(d.phase) ||
        ![null,'double','rail'].includes(d.bonus) || !Array.isArray(d.path) ||
        ![d.coins,d.best,d.pot,d.settled,d.lostFare].every(integer) ||
        !Array.isArray(d.paints) || !d.paints.every(paintById) || !d.paints.includes(d.paint) ||
        !Number.isFinite(d.leftMs) || d.leftMs < 0 || d.leftMs > durations[d.station - 1] * 1000) return null;
    // Old settled trips keep their original rewards. An untouched first stop can
    // reveal a seam, since the player has not planned or collected anything yet.
    const untouched = d.station === 1 && d.phase === 'plan' && !d.started && d.path.length === 1;
    const rebarStation = d.version >= 2 ? d.rebarStation : (untouched ? rebarStop(d.run, d.runSeed) : 0);
    const jadeStation = d.version >= 3 ? d.jadeStation : (untouched ? jadeStop(d.run, d.runSeed) : 0);
    if (![0,1,2].includes(rebarStation) || ![0,1,2].includes(jadeStation)) return null;
    const rebarRail = d.version >= 2 && d.rebarRail === true;
    if (rebarRail && (!rebarStation || d.station !== rebarStation + 1)) return null;
    if (d.version >= 4 && !validateAlbum(d.album)) return null;
    const album = d.version >= 4 ? d.album : emptyAlbum();
    const survey = rules.surveyFrom(d);
    if (!survey) return null;
    const trip = {
      ...survey, album, rebarStation, jadeStation, seed: d.seed, run: d.run, runSeed: d.runSeed, lastRunSeed: d.lastRunSeed, firstIndex: d.firstIndex,
      coins: d.coins, best: d.best, pot: d.pot, settled: d.settled, lostFare: d.lostFare,
      paints: [...new Set(d.paints)], paint: d.paint
    };
    const state = loadStop(trip, d.station, d.bonus, rebarRail);
    if (d.version >= 2 && d.station === rebarStation) {
      const seam = d.oddity;
      if (!seam || seam.kind !== 'rebar' || !Number.isInteger(seam.x) || !Number.isInteger(seam.y) ||
          state.board[seam.y]?.[seam.x] !== 'copper') return null;
      state.oddity = { x: seam.x, y: seam.y, kind: 'rebar' };
    }
    if (d.version >= 3 && d.station === jadeStation) {
      const seam = d.jade;
      if (!seam || seam.kind !== 'jade' || !Number.isInteger(seam.x) || !Number.isInteger(seam.y) ||
          !['copper','crystal'].includes(state.board[seam.y]?.[seam.x])) return null;
      state.jade = { x: seam.x, y: seam.y, kind: 'jade' };
    }
    if (!d.path.length || d.path[0]?.x !== 0 || d.path[0]?.y !== 3 || d.path.length > state.budget + 1) return null;
    for (const p of d.path.slice(1)) {
      const before = state.path.length;
      if (!p || !rules.placeRail(state,p.x,p.y).ok || state.path.length !== before + 1) return null;
    }
    state.started = d.started === true;
    state.paused = d.paused === true;
    state.leftMs = d.leftMs;
    state.deadline = d.deadline;
    if (state.started && !state.paused && d.phase === 'plan' && !Number.isFinite(state.deadline)) return null;
    state.phase = d.phase;
    if (state.phase !== 'plan') {
      state.result = delivery(state, d.timeout === true);
      state.result.ticketEarned = d.ticketEarned === true;
      if (d.version >= 3) {
        if (state.result.jade === 'pending') {
          if (!['pending','sold','cut'].includes(d.jadeStatus) || (state.phase === 'banked' && d.jadeStatus === 'pending')) return null;
          const value = d.jadeStatus === 'cut' ? cutValue(state.runSeed) : d.jadeStatus === 'sold' ? jadeOffer : 0;
          if (d.jadeValue !== value) return null;
          state.result.jade = d.jadeStatus;
          state.result.jadeValue = value;
        } else if (d.jadeStatus !== 'none' || d.jadeValue !== 0) return null;
      }
    }
    if (d.version < 4) {
      // The surviving manifest proves each earlier stop in this run was delivered.
      // Older trips have no detailed history, so import only verifiable events.
      album.deliveries = state.station - 1 + (state.result?.met ? 1 : 0);
      if (state.result?.jade === 'sold') album.sold = 1;
      if (state.result?.jade === 'cut') album.cuts[state.result.jadeValue] = 1;
    }
    unlockModels(state);
    return state;
  }

  function create(options = {}) {
    const now = typeof options.now === 'function' ? options.now : Date.now;
    let storage = null, snapshot = null;
    try {
      storage = 'storage' in options ? options.storage : window.localStorage;
      snapshot = storage ? storage.getItem(key) : null;
    } catch { storage = null; }
    let state = restore(snapshot);
    const isNew = !state;
    if (!state) {
      const seed = Number.isInteger(options.seed) ? options.seed >>> 0 : rules.newSeed();
      state = freshRun(seed, 1, null, { coins: 0, best: 0, paints: ['standard'], paint: 'standard', album: emptyAlbum(), surveyTickets: 1 });
    }

    function remaining() {
      if (!state.started || state.paused || state.phase !== 'plan') return state.leftMs;
      return Math.max(0, Math.min(state.leftMs, state.deadline - now()));
    }

    function save() {
      if (!storage) return;
      const { seed, run, runSeed, lastRunSeed, firstIndex, station, phase, path, coins, best,
        pot, settled, lostFare, paint, paints: ownedPaints, bonus, started, paused, deadline, result } = state;
      const { rebarStation, rebarRail, oddity, jadeStation, jade } = state;
      const raw = JSON.stringify({ version: 4, album: state.album, surveyTickets: state.surveyTickets,
        surveyTargets: state.surveyTargets, ticketEarned: result?.ticketEarned,
        jadeStation,jade,jadeStatus: result?.jade,jadeValue: result?.jadeValue,
        rebarStation,rebarRail,oddity,seed,run,runSeed,lastRunSeed,firstIndex,station,phase,path,
        coins,best,pot,settled,lostFare,paint,paints:ownedPaints,bonus,started,paused,deadline,
        leftMs: remaining(), timeout: Boolean(result && result.timeout) });
      try {
        storage.setItem(key, raw);
        snapshot = raw;
      } catch { storage = null; }
    }

    function sync() {
      if (!storage) return false;
      try {
        const raw = storage.getItem(key);
        if (raw === snapshot || !raw) return false;
        const updated = restore(raw);
        if (!updated) return false;
        state = updated;
        snapshot = raw;
        return true;
      } catch { storage = null; return false; }
    }

    function bankPot() {
      state.settled = state.pot;
      state.coins += state.pot;
      state.best = Math.max(state.best, state.pot);
      state.pot = 0;
      state.phase = 'banked';
    }

    function dispatch(timeout) {
      if (state.phase !== 'plan') return fail('本站已结算');
      if (!timeout && state.paused) return fail('请先继续快运');
      if (!timeout && state.path.length === 1) return fail('至少铺一节轨道再发车');
      state.leftMs = remaining();
      state.deadline = null;
      state.paused = false;
      state.result = delivery(state, timeout);
      if (!state.result.met) {
        state.lostFare = state.pot;
        state.pot = 0;
        state.phase = 'lost';
      } else {
        state.album.deliveries++;
        state.result.ticketEarned = state.album.deliveries % 3 === 0;
        if (state.result.ticketEarned) state.surveyTickets++;
        unlockModels(state);
        state.pot += state.result.fare;
        if (state.station === 3) bankPot();
        else state.phase = 'offer';
      }
      return { ok: true, result: state.result, expired: timeout };
    }

    function due() {
      return state.phase === 'plan' && state.started && !state.paused && remaining() <= 0;
    }

    function act(operation, acceptExpiry = false) {
      if (sync()) return fail('另一窗口更新了快运进度，请重试');
      // Expiration wins ties with a last-second placement, pause or manual dispatch.
      if (due()) {
        const settled = dispatch(true);
        save();
        return acceptExpiry ? settled : { ...settled, ok: false, reason: '本站时间已到，矿车已发车' };
      }
      const answer = operation();
      if (answer.ok) save();
      return answer;
    }

    function move(x,y) {
      if (state.paused) return fail('请先继续快运');
      const res = rules.placeRail(state,x,y);
      if (res.ok && !state.started) {
        state.started = true;
        state.deadline = now() + state.leftMs;
      }
      return res;
    }

    function pause() {
      if (state.phase === 'plan' && !state.paused) {
        state.leftMs = remaining();
        state.paused = true;
        state.deadline = null;
      }
      return { ok: true };
    }

    function resume() {
      if (state.phase === 'plan' && state.paused) {
        state.paused = false;
        if (state.started) state.deadline = now() + state.leftMs;
      }
      return { ok: true };
    }

    function scout(offset) {
      if (offset !== 1 && offset !== 2) return { ...fail('只可预看接下来的两站'), locked: false };
      const number = state.station + offset;
      if (number > 3 || state.phase === 'banked' || state.phase === 'lost') {
        return { ...fail('本趟没有这座后续站点'), locked: false, number };
      }
      if (offset === 2 && !state.surveyTargets.includes(number)) {
        return { ...fail('需要一张勘探券'), locked: true, number };
      }
      return { ok: true, locked: false, number, map: rules.surveyMap(loadStop(state, number, null)) };
    }

    function revealScout() {
      const target = scout(2);
      if (!target.locked) return target;
      if (state.surveyTickets <= 0) return { ...target, reason: '勘探券不足' };
      state.surveyTickets--;
      state.surveyTargets.push(target.number);
      return scout(2);
    }

    function nextStop() {
      if (state.station === 3) return null;
      const station = state.station + 1;
      const { source } = stopTemplate(state, station);
      return { name: source.name, order: { ...source.order }, budget: source.budget, seconds: durations[station - 1] };
    }

    function resolveJade(choice) {
      if (!['sell','cut'].includes(choice)) return fail('请选择卖给商家或切开');
      const result = state.result;
      if (!result || state.phase !== 'offer') return fail('这里没有待处理的原石');
      const outcome = choice === 'sell' ? 'sold' : 'cut';
      if (result.jade === outcome) return { ok: true, result, amount: result.jadeValue };
      if (result.jade !== 'pending') return fail('这里没有待处理的原石');
      const amount = choice === 'sell' ? jadeOffer : cutValue(state.runSeed);
      result.jade = outcome;
      result.jadeValue = amount;
      state.pot += amount;
      if (choice === 'sell') state.album.sold++;
      else state.album.cuts[amount]++;
      unlockModels(state);
      return { ok: true, result, amount };
    }

    function advance(bonus) {
      if (state.phase !== 'offer') return fail('先完成本站订单');
      if (state.result.jade === 'pending') return fail('先决定怎样处理原石');
      if (!['double','rail'].includes(bonus)) return fail('请选择加价券或备用轨');
      state = loadStop(state, state.station + 1, bonus, state.result.foundRebar);
      return { ok: true };
    }

    function bank() {
      if (state.phase !== 'offer') return fail('这趟货款已处理');
      if (state.result.jade === 'pending') return fail('先决定怎样处理原石');
      bankPot();
      return { ok: true, amount: state.settled };
    }

    function restart() {
      if (!['lost','banked'].includes(state.phase)) return fail('先结算这趟快运');
      const { coins, best, paints: ownedPaints, paint, album, surveyTickets } = state;
      state = freshRun(state.seed, state.run + 1, state, { coins, best, paints: ownedPaints, paint, album, surveyTickets });
      return { ok: true };
    }

    function equipPaint(id) {
      if (!state.paints.includes(id)) return fail('这款车型尚未入库');
      state.paint = id;
      return { ok: true };
    }

    function buyPaint(id) {
      const item = paintById(id);
      if (!item) return fail('未知车型');
      if (state.paints.includes(id)) return equipPaint(id);
      if (item.milestone) return fail('解锁车型需要' + item.requirement);
      if (state.coins < item.price) return fail('已存货款不足');
      state.coins -= item.price;
      state.paints.push(id);
      return equipPaint(id);
    }

    function tick() {
      if (!due()) return { ok: true, expired: false };
      return act(() => ({ ok: true, expired: false }), true);
    }

    if (isNew) save();
    return {
      get state() { return state; },
      get storageOK() { return Boolean(storage); },
      remaining, tick, nextStop, scout, revealScout: () => act(revealScout), preview: () => preview(state), par: () => rules.optimalLength(state),
      used: () => rules.usedRails(state), trackCost: (x,y) => rules.trackCost(state,{x,y}),
      move: (x,y) => act(() => move(x,y)),
      undo: () => act(() => state.paused ? fail('请先继续快运') : rules.removeRail(state)),
      dispatch: () => act(() => dispatch(false), true), pause: () => act(pause), resume: () => act(resume),
      resolveJade: choice => act(() => resolveJade(choice)),
      advance: bonus => act(() => advance(bonus)), bank: () => act(bank), restart: () => act(restart),
      buyPaint: id => act(() => buyPaint(id)), equipPaint: id => act(() => equipPaint(id))
    };
  }

  window.MineExpress = { create, paints, durations, jadeOffer, jadeCuts, albumProgress, storageKey: key };
})();
