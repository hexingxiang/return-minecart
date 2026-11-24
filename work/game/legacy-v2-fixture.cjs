
/* 回程矿车 · 十班手工矿图
   . 空地 / # 岩壁 / c、C、O 为 1、2、3 铜 / k、K、Q 为 1、2、3 晶。
   每班从 (0, 3) 出发；par 是标准矿斗完成订单的最短轨数。 */
(() => {
  'use strict';

  const stages = [
    {
      name: '入口铜脉',
      tip: '车头向右铺一节轨，就能收到上方的铜矿。',
      order: { copper: 1, crystal: 0 },
      budget: 4,
      par: 1,
      rows: [
        '########',
        '##...###',
        '.c....##',
        '.......#',
        '...#...#',
        '##...###',
        '########',
      ]
    },
    {
      name: '双铜岔口',
      tip: '两块铜矿分居小径两边，从站台向右铺轨。',
      order: { copper: 2, crystal: 0 },
      budget: 5,
      par: 2,
      rows: [
        '####...#',
        '.#......',
        '.c..##.#',
        '......##',
        '..c...#.',
        '##..c...',
        '##....##',
      ]
    },
    {
      name: '初见蓝晶',
      tip: '先往右贴着铜矿铺，再转向北面的蓝晶。',
      order: { copper: 2, crystal: 1 },
      budget: 6,
      par: 3,
      rows: [
        '##....##',
        '..k...#.',
        '...c....',
        '.....##.',
        '.c..#..#',
        '..#...c.',
        '##....##',
      ]
    },
    {
      name: '铜簇拐角',
      tip: '北边的亮铜矿簇一次给两铜，沿它的西侧上行。',
      order: { copper: 3, crystal: 1 },
      budget: 7,
      par: 4,
      rows: [
        '.ck..###',
        '......#.',
        '.C..#...',
        '...##...',
        '...#...c',
        '.#..k...',
        '##....##',
      ]
    },
    {
      name: '绕柱矿巷',
      tip: '中央岩柱挡住近路，从下方绕过去贴上蓝晶。',
      order: { copper: 4, crystal: 1 },
      budget: 8,
      par: 5,
      rows: [
        '.#...#..',
        '...#...#',
        '.C.k...#',
        '..#.c...',
        '.....#..',
        '..c..#..',
        '#...###.',
      ]
    },
    {
      name: '蓝晶矿窝',
      tip: '下方小径绕过铜矿簇，尽头的蓝晶簇一次给两晶。',
      order: { copper: 4, crystal: 2 },
      budget: 9,
      par: 6,
      rows: [
        '#....#..',
        '..#...k.',
        '...c..##',
        '.##..#..',
        '.C..K...',
        '...C..#.',
        '#....#..',
      ]
    },
    {
      name: '悬壁双层',
      tip: '右方岩壁挡住直路，沿上层矿道靠近晶簇。',
      order: { copper: 5, crystal: 2 },
      budget: 9,
      par: 7,
      rows: [
        '..##....',
        '.#....K.',
        '..c.C...',
        '....#.#.',
        '.C......',
        '..#.#.c.',
        '##...#..',
      ]
    },
    {
      name: '赤铜穹顶',
      tip: '上层赤铜富矿一次给三铜，沿回折矿道把它和蓝晶连起来。',
      order: { copper: 6, crystal: 2 },
      budget: 10,
      par: 8,
      rows: [
        '.O..##..',
        '....c...',
        '..C...#.',
        '..#..K..',
        '..##..#.',
        '.c......',
        '#..#.##.',
      ]
    },
    {
      name: '深蓝裂隙',
      tip: '下层矿袋藏着铜，绕回右侧裂隙可收三晶富矿。',
      order: { copper: 6, crystal: 3 },
      budget: 10,
      par: 9,
      rows: [
        '.##....#',
        '...#..c.',
        '.O...###',
        '...#..Q.',
        '.#.....#',
        '.......#',
        '..C.c#..',
      ]
    },
    {
      name: '尽头车站',
      tip: '先沿上方铜脉铺轨，再向下转到蓝晶富矿旁。',
      order: { copper: 7, crystal: 3 },
      budget: 11,
      par: 10,
      rows: [
        '.O.C...#',
        '.....C.#',
        '..k.....',
        '..#.....',
        '.#.##.Q.',
        '..c....#',
        '#..#....',
      ]
    },
  ];

  window.MineLevels = { stages };
})();



/* 回程矿车 · 规则与存档 */
(() => {
  'use strict';

  const width = 8;
  const height = 7;
  const start = { x: 0, y: 3 };
  const steps4 = [[1, 0], [0, -1], [0, 1], [-1, 0]];
  const diagonals = [[1, 1], [-1, -1], [1, -1], [-1, 1]];
  const cards = [
    { id: 'long', name: '伸缩轨匣', description: '本趟多带 2 节轨道。' },
    { id: 'coil', name: '铜磁线圈', description: '回程还会拾取斜角的铜矿。' },
    { id: 'lens', name: '晶光透镜', description: '回程还会拾取斜角的水晶。' }
  ];
  const redeemCost = 3;
  const storageKey = 'huicheng-minecart.save.v2';
  const oldStorageKey = 'huicheng-minecart.save.v1';
  const upgradeCosts = [
    { copper: 4, crystal: 1 },
    { copper: 7, crystal: 2 },
    { copper: 10, crystal: 3 }
  ];
  const glyphs = {
    '.': 'ground', '#': 'rock', c: 'copper', C: 'copper', O: 'copper',
    k: 'crystal', K: 'crystal', Q: 'crystal'
  };
  const grades = { c: 1, C: 2, O: 3, k: 1, K: 2, Q: 3 };
  const swapOre = { c: 'k', C: 'K', O: 'Q', k: 'c', K: 'C', Q: 'O' };

  const key = (p) => p.y * width + p.x;
  const same = (a, b) => a.x === b.x && a.y === b.y;
  const inside = (p) => Number.isInteger(p.x) && Number.isInteger(p.y) &&
    p.x >= 0 && p.x < width && p.y >= 0 && p.y < height;
  const touching = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  const validCard = (id) => cards.some(card => card.id === id);
  const isOre = (cell) => cell === 'copper' || cell === 'crystal';
  const fail = reason => ({ ok: false, reason });
  const upgradeCost = state => upgradeCosts[state.upgrades] || null;

  function randomFor(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value + 0x6d2b79f5) >>> 0;
      let t = Math.imul(value ^ value >>> 15, 1 | value);
      t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function around(p, directions = steps4) {
    return directions.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).filter(inside);
  }

  function decodeStage(source, rows, endless) {
    return {
      board: rows.map(row => Array.from(row, mark => glyphs[mark])),
      amounts: rows.map(row => Array.from(row, mark => grades[mark] || 0)),
      order: { ...source.order },
      stage: { name: source.name, tip: source.tip, budget: source.budget, par: source.par, endless }
    };
  }

  function varyTerrain(rows, random) {
    const ground = [], minerals = [], rocks = [];
    const cells = rows.map(row => Array.from(row));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (same(start, { x, y })) continue;
        const mark = cells[y][x];
        if (mark === '.') ground.push({ x, y });
        else if (mark === '#') rocks.push({ x, y });
        else minerals.push({ x, y });
      }
    }
    function relocate(sites) {
      if (!sites.length || !ground.length) return;
      const [from] = sites.splice(Math.floor(random() * sites.length), 1);
      const [to] = ground.splice(Math.floor(random() * ground.length), 1);
      cells[to.y][to.x] = cells[from.y][from.x];
      cells[from.y][from.x] = '.';
    }
    relocate(minerals);
    relocate(rocks);
    if (random() < 0.5) relocate(minerals);
    return cells;
  }

  function makeMap(seed, round) {
    const stages = window.MineLevels.stages;
    if (round <= stages.length) {
      const source = stages[round - 1];
      return decodeStage(source, source.rows, false);
    }
    // Alternate late-game templates, then move their ore veins and rock walls.
    // Test each alternative against the base cart, so surplus upgrades stay optional.
    const random = randomFor(seed ^ Math.imul(round, 0x9e3779b1));
    const late = stages.slice(-3);
    const base = late[(round - stages.length - 1 + seed % late.length) % late.length];
    const source = { ...base, name: base.name + ' · 深层', tip: '矿脉的位置变了。先找高品位矿，再规划回程路线。' };
    let rows = base.rows.slice();
    if (random() < 0.5) rows.reverse();
    if (random() < 0.5) {
      rows = rows.map(row => Array.from(row, mark => swapOre[mark] || mark).join(''));
      source.order = { copper: base.order.crystal, crystal: base.order.copper };
    }
    for (let attempt = 0; attempt < 7; attempt++) {
      const map = decodeStage(source, varyTerrain(rows, random), true);
      const par = optimalLength({ ...map, equipped: null });
      if (par !== null && par >= Math.max(8, base.par)) {
        map.stage.par = par;
        return map;
      }
    }
    // Vertical reflection and mineral-type exchange preserve the original solution.
    return decodeStage(source, rows, true);
  }

  function pickupSites(state, p) {
    const sites = around(p).filter(q => isOre(state.board[q.y][q.x]));
    const diagonalType = { coil: 'copper', lens: 'crystal' }[state.equipped];
    if (diagonalType) {
      sites.push(...around(p, diagonals).filter(q => state.board[q.y][q.x] === diagonalType));
    }
    return sites;
  }

  function computeReturn(state) {
    const seen = new Set();
    const counts = { copper: 0, crystal: 0 };
    const steps = [];
    for (const p of state.path.slice().reverse()) {
      const ores = [];
      for (const q of pickupSites(state, p)) {
        const type = state.board[q.y][q.x];
        if (seen.has(key(q))) continue;
        seen.add(key(q));
        const amount = state.amounts[q.y][q.x];
        counts[type] += amount;
        ores.push({ ...q, type, amount });
      }
      steps.push({ ...p, ores });
    }
    return { ...counts, steps };
  }

  const parCache = new WeakMap();
  function optimalLength(state) {
    let cache = parCache.get(state.board);
    if (!cache) {
      cache = new Map();
      parCache.set(state.board, cache);
    }
    if (cache.has(state.equipped)) return cache.get(state.equipped);

    const size = width * height;
    const neighbours = Array.from({ length: size }, () => []);
    const pickups = Array.from({ length: size }, () => []);
    state.board.forEach((row, y) => row.forEach((type, x) => {
      if (type !== 'ground') return;
      const i = y * width + x;
      neighbours[i] = around({ x, y }).filter(p => state.board[p.y][p.x] === 'ground').map(key);
      pickups[i] = pickupSites(state, { x, y }).map(p => ({
        index: key(p), type: state.board[p.y][p.x], amount: state.amounts[p.y][p.x]
      }));
    }));
    const visited = new Uint8Array(size);
    const touches = new Uint8Array(size);
    const counts = { copper: 0, crystal: 0 };
    let best = state.stage.budget + 1;
    function walk(i, distance) {
      // Incremental reference counts handle rich seams adjacent to multiple tracks.
      for (const ore of pickups[i]) {
        if (touches[ore.index]++ === 0) counts[ore.type] += ore.amount;
      }
      if (distance && counts.copper >= state.order.copper && counts.crystal >= state.order.crystal) {
        best = Math.min(best, distance);
      } else if (distance + 1 < best) {
        visited[i] = 1;
        for (const j of neighbours[i]) {
          if (!visited[j]) walk(j, distance + 1);
        }
        visited[i] = 0;
      }
      for (const ore of pickups[i]) {
        if (--touches[ore.index] === 0) counts[ore.type] -= ore.amount;
      }
    }
    walk(key(start), 0);
    const length = best <= state.stage.budget ? best : null;
    cache.set(state.equipped, length);
    return length;
  }

  function freshRound(seed, round, inventory) {
    const map = makeMap(seed, round);
    return {
      seed, round, ...map, ...inventory,
      phase: 'plan', path: [{ ...start }], result: null,
      budget: map.stage.budget + inventory.upgrades + (inventory.equipped === 'long' ? 2 : 0)
    };
  }

  function newSeed() {
    if (window.crypto && window.crypto.getRandomValues) {
      return window.crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return Math.floor(Math.random() * 4294967296);
  }

  function inventoryFrom(d) {
    if (!d || !Number.isInteger(d.upgrades) || d.upgrades < 0 || d.upgrades > upgradeCosts.length ||
        !d.wallet || !['copper','crystal','plans'].every(k => Number.isSafeInteger(d.wallet[k]) && d.wallet[k] >= 0) ||
        !Array.isArray(d.owned) || !d.owned.every(validCard) ||
        !(d.equipped === null || d.owned.includes(d.equipped))) return null;
    return { wallet: { ...d.wallet }, owned: [...new Set(d.owned)], equipped: d.equipped, upgrades: d.upgrades };
  }

  function parseSave(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  function migrateLegacy(raw) {
    const d = parseSave(raw);
    if (!d || d.version !== 1 || !Number.isInteger(d.seed)) return null;
    const inventory = inventoryFrom(d);
    // Legacy dispatch already settled its wallet and card. Import balances once.
    return inventory ? freshRound(d.seed >>> 0, 1, inventory) : null;
  }

  function restore(raw) {
    const d = parseSave(raw);
    if (!d || d.version !== 2 || !Number.isInteger(d.seed) || !Number.isSafeInteger(d.round) ||
        d.round < 1 || !['plan','done'].includes(d.phase)) return null;
    const inventory = inventoryFrom(d);
    if (!inventory) return null;
    const state = freshRound(d.seed >>> 0, d.round, inventory);
    if (!Array.isArray(d.path) || !d.path.length || d.path.length > 1 + state.budget || !d.path[0] ||
        !same(d.path[0], start) || !d.path.every(p => p && inside(p) && state.board[p.y][p.x] === 'ground') ||
        new Set(d.path.map(key)).size !== d.path.length || !d.path.slice(1).every((p, i) => touching(p, d.path[i]))) return null;
    state.path = d.path.map(p => ({ x: p.x, y: p.y }));
    if (d.phase === 'done') {
      if (state.path.length < 2) return null;
      const goods = computeReturn(state);
      const met = goods.copper >= state.order.copper && goods.crystal >= state.order.crystal;
      if (met && (!d.reward || !validCard(d.reward.id) || typeof d.reward.isNew !== 'boolean')) return null;
      state.phase = 'done';
      state.result = { ...goods, met, card: met ? { id: d.reward.id, isNew: d.reward.isNew } : null };
    }
    return state;
  }

  function create(options = {}) {
    let storage = null;
    let snapshot = null;
    let legacy = null;
    try {
      storage = 'storage' in options ? options.storage : window.localStorage;
      if (storage) {
        snapshot = storage.getItem(storageKey);
        legacy = storage.getItem(oldStorageKey);
      }
    } catch { storage = null; }
    let state = restore(snapshot);
    const needsNewSave = !state;
    if (!state) {
      state = migrateLegacy(legacy);
      if (!state) {
        state = freshRound(Number.isInteger(options.seed) ? options.seed >>> 0 : newSeed(), 1, {
          wallet: { copper: 0, crystal: 0, plans: 0 }, owned: [], equipped: null, upgrades: 0
        });
      }
    }

    function save() {
      if (!storage) return;
      const { seed, round, phase, path, wallet, owned, equipped, upgrades, result } = state;
      const raw = JSON.stringify({ version: 2, seed, round, phase, path, wallet, owned, equipped, upgrades,
        reward: result && result.card });
      try {
        storage.setItem(storageKey, raw);
        snapshot = raw;
      } catch { storage = null; }
    }

    function mutate(operation) {
      if (storage) {
        try {
          const raw = storage.getItem(storageKey);
          if (raw && raw !== snapshot) {
            const newer = restore(raw);
            if (newer) {
              state = newer;
              snapshot = raw;
              return fail('另一窗口更新了存档，请重新操作');
            }
          }
        } catch { storage = null; }
      }
      const res = operation();
      if (res.ok) save();
      return res;
    }

    function move(x, y) {
      if (state.phase !== 'plan') return fail('这趟已经回营');
      const p = { x,y };
      const prev = state.path[state.path.length - 2];
      if (prev && same(prev, p)) return undo();
      if (!inside(p) || !touching(state.path[state.path.length - 1], p)) return fail('只可铺在车头相邻的格子');
      const type = state.board[y][x];
      if (type === 'rock') return fail('这块是硬岩');
      if (isOre(type)) return fail('矿脉旁铺轨即可采矿');
      if (state.path.some(q => same(q, p))) return fail('轨道不能交叉');
      if (state.path.length - 1 >= state.budget) return fail('轨道已经用完');
      state.path.push(p);
      return { ok: true };
    }

    function undo() {
      if (state.phase !== 'plan') return fail('这趟已经回营');
      if (state.path.length <= 1) return fail('已经回到起点');
      state.path.pop();
      return { ok: true };
    }

    function dispatch() {
      if (state.phase !== 'plan') return fail('这趟已经结算');
      if (state.path.length <= 1) return fail('至少铺一节轨道再发车');
      const goods = computeReturn(state);
      const met = goods.copper >= state.order.copper && goods.crystal >= state.order.crystal;
      state.wallet.copper += goods.copper;
      state.wallet.crystal += goods.crystal;
      let card = null;
      if (met) {
        const draw = randomFor(state.seed ^ Math.imul(state.round, 0x85ebca6b) ^ 0xc2b2ae35);
        const id = cards[Math.floor(draw() * cards.length)].id;
        const isNew = !state.owned.includes(id);
        if (isNew) state.owned.push(id);
        else state.wallet.plans++;
        card = { id, isNew };
      }
      state.phase = 'done';
      state.result = { ...goods, met, card };
      return { ok: true, result: state.result };
    }

    function next() {
      if (state.phase !== 'done') return fail('先发车回营');
      const { wallet, owned, equipped, upgrades } = state;
      const nextRound = state.round + (state.result.met ? 1 : 0);
      state = freshRound(state.seed, nextRound, { wallet, owned, equipped, upgrades });
      return { ok: true };
    }

    function equip(id) {
      if (state.phase !== 'plan' || state.path.length !== 1) return fail('请在铺轨前更换装备');
      if (id !== null && !state.owned.includes(id)) return fail('尚未获得这件装备');
      state.equipped = id;
      state.budget = state.stage.budget + state.upgrades + (id === 'long' ? 2 : 0);
      return { ok: true };
    }

    function upgrade() {
      if (state.phase !== 'plan' || state.path.length !== 1) return fail('请在铺轨前升级');
      const cost = upgradeCost(state);
      if (!cost) return fail('永久轨道已经升满');
      if (state.wallet.copper < cost.copper || state.wallet.crystal < cost.crystal) return fail('仓库材料不足');
      state.wallet.copper -= cost.copper;
      state.wallet.crystal -= cost.crystal;
      state.upgrades++;
      state.budget++;
      return { ok: true };
    }

    function redeem(id) {
      if (!validCard(id)) return fail('未知装备');
      if (state.owned.includes(id)) return fail('已经收藏这件装备');
      if (state.wallet.plans < redeemCost) return fail('兑换需要 3 张图纸');
      state.wallet.plans -= redeemCost;
      state.owned.push(id);
      return { ok: true };
    }

    if (needsNewSave) save();
    return {
      get state() { return state; },
      get storageOK() { return Boolean(storage); },
      preview: () => computeReturn(state), par: () => optimalLength(state),
      move: (x,y) => mutate(() => move(x,y)), undo: () => mutate(undo), dispatch: () => mutate(dispatch),
      next: () => mutate(next), equip: id => mutate(() => equip(id)), upgrade: () => mutate(upgrade),
      redeem: id => mutate(() => redeem(id))
    };
  }

  window.MineGame = { create, cards, redeemCost, upgradeCost, width, height };
})();

