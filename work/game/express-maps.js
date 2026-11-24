/* 三站快运 · 各站的候选班线；每条线路都可用标准矿斗交单。 */
(() => {
  'use strict';

  const tiers = [
    [
      {
        name: '摆渡口',
        order: { copper: 2, crystal: 0 },
        budget: 4, par: 2, rubble: [],
        rows: [
          '##k...##',
          '#c..K.##',
          '..c.#..#',
          '......c#',
          '..kc...#',
          '....#..#',
          '##...c##',
        ]
      },
      {
        name: '弯月湾',
        order: { copper: 1, crystal: 1 },
        budget: 4, par: 3, rubble: [],
        rows: [
          '#.##....',
          'K.ck.#.C',
          '.....k.#',
          '....c#..',
          '..c.#...',
          '.##kc.##',
          '...#....',
        ]
      },
      {
        name: '南坡线',
        order: { copper: 2, crystal: 1 },
        budget: 4, par: 3, rubble: [{ x: 2, y: 1 }],
        rows: [
          'K.C...##',
          '...k#..#',
          '.cc..#..',
          '..k....c',
          '.....#..',
          'c.#....#',
          '....k###',
        ]
      },
    ],
    [
      {
        name: '石门岔',
        order: { copper: 2, crystal: 1 },
        budget: 6, par: 4, rubble: [{ x: 3, y: 3 }],
        rows: [
          '..##.k##',
          '.....#..',
          '..#kcC..',
          '.......K',
          '.kc#.#Q.',
          '........',
          '##Cc.##.',
        ]
      },
      {
        name: '双灯台',
        order: { copper: 3, crystal: 1 },
        budget: 6, par: 5, rubble: [{ x: 5, y: 4 }],
        rows: [
          '....#c..',
          'C#.c...#',
          '.....#.C',
          '....K...',
          '.k#.k...',
          'k...c.#.',
          '..##....',
        ]
      },
      {
        name: '碎石坪',
        order: { copper: 2, crystal: 2 },
        budget: 6, par: 5, rubble: [{ x: 5, y: 1 }, { x: 5, y: 2 }],
        rows: [
          '..##..c.',
          '#.kk..#.',
          '....#...',
          '.......#',
          '.k...c..',
          '.#K.C#..',
          '.cC.#...',
        ]
      },
    ],
    [
      {
        name: '折返谷',
        order: { copper: 3, crystal: 2 },
        budget: 8, par: 6, rubble: [{ x: 1, y: 5 }, { x: 5, y: 4 }],
        rows: [
          'C.#.k#..',
          'c....#.c',
          '..kC.#..',
          '...#O...',
          '...#....',
          'K.......',
          '..#.Q.##',
        ]
      },
      {
        name: '蓝脊湾',
        order: { copper: 4, crystal: 2 },
        budget: 8, par: 7, rubble: [{ x: 2, y: 5 }, { x: 4, y: 1 }],
        rows: [
          'C..#.C.Q',
          'c....#.Q',
          '...#.K..',
          '........',
          '#O#.k#..',
          '#.....#.',
          '###c.k..',
        ]
      },
      {
        name: '星屑站',
        order: { copper: 3, crystal: 3 },
        budget: 8, par: 7, rubble: [{ x: 2, y: 6 }, { x: 5, y: 5 }],
        rows: [
          'c##.k..#',
          '.......#',
          '..##.O..',
          '..K..#..',
          '#.kCCQ..',
          '..#.#...',
          '......c#',
        ]
      },
    ],
  ];

  window.ExpressMaps = { tiers };
})();
