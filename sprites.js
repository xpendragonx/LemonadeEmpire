/* ============================================================
   Lemonade Empire — pixel sprites
   All art is drawn in code (no external image files), so there
   are no asset-license concerns. Grid sprites use one character
   per pixel; '.' is transparent. Sprites are baked once into
   small offscreen canvases and drawn scaled with smoothing off.
   ============================================================ */

const PAL = {
  k: '#2b1d0e', // outline
  s: '#f2c29b', S: '#d69c74', // skin
  H: '#5a3418', // hair
  r: '#f4c430', R: '#c99a12', // shirt (recolored per character)
  b: '#3b5aa8', B: '#2a4078', // pants
  w: '#ffffff', W: '#e8e4d0',
  y: '#ffd93b', Y: '#e0a800', l: '#fff3a0', // lemon
  g: '#5aa832', G: '#3a7a22', h: '#8fd14f', // leaves
  t: '#7a4a24', T: '#5a3418', // trunk
};

const PERSON = [
  '..kkkk..',
  '.kHHHHk.',
  'kHHHHHHk',
  'kHsssssk',
  'kskssksk',
  '.ksssSk.',
  '..kkkk..',
  '.krrrrk.',
  'krrrrrRk',
  'ksrrrRsk',
  'kkbbbbkk',
  '.kbbbbk.',
];
const LEGS_A = ['.kbk.kbk', '.kk..kk.'];
const LEGS_B = ['..kbbk..', '..kkkk..'];

const LEMON = [
  '.kkk.',
  'kylyk',
  'kyyYk',
  '.kkk.',
];

const CUP = [
  'kkkk',
  'kyyk',
  'kwwk',
  '.kk.',
];

function bakeGrid(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i];
    if (ch === '.') continue;
    x.fillStyle = pal[ch] || PAL[ch] || '#f0f';
    x.fillRect(i, j, 1, 1);
  }
  return c;
}

/* Tree canopy: union of discs, shaded, then outlined. */
function bakeCanopy() {
  const w = 26, h = 21;
  const cells = [];
  for (let j = 0; j < h; j++) cells.push(new Array(w).fill(null));
  const discs = [[13, 10, 9.5], [7, 12, 6], [19, 12, 6], [13, 6, 7]];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (discs.some(([cx, cy, r]) => (i - cx) ** 2 + (j - cy) ** 2 <= r * r)) {
      const shade = (i - 13) * 0.6 + (j - 10);
      cells[j][i] = shade > 5 ? 'G' : (shade < -7 ? 'h' : 'g');
    }
  }
  // outline pass
  const out = cells.map(r => r.slice());
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (cells[j][i]) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => cells[j + dy] && cells[j + dy][i + dx]);
    if (n) out[j][i] = 'k';
  }
  return bakeGrid(out.map(r => r.map(c => c || '.').join('')), {});
}

const SHIRTS = [
  ['#e25b5b', '#a83b3b'], ['#5b9be2', '#3b6ea8'], ['#9b5be2', '#6e3ba8'],
  ['#e29b5b', '#a86e3b'], ['#5be2a8', '#3ba87a'], ['#e25bb4', '#a83b83'],
  ['#dddddd', '#aaaaaa'], ['#6b8e23', '#4a6318'],
];
const HAIRS = ['#5a3418', '#1e1a16', '#c9a04a', '#8a3a1a', '#aaaaaa'];

const SPR = {};

function bakePerson(shirt, hair) {
  const pal = { r: shirt[0], R: shirt[1], H: hair };
  return [
    bakeGrid(PERSON.concat(LEGS_A), pal),
    bakeGrid(PERSON.concat(LEGS_B), pal),
  ];
}

function bakeSprites() {
  SPR.player = bakePerson(['#f4c430', '#c99a12'], '#5a3418');
  SPR.helper = bakePerson(['#5aa832', '#3a7a22'], '#1e1a16');
  SPR.customers = [];
  SHIRTS.forEach((s, i) => SPR.customers.push(bakePerson(s, HAIRS[i % HAIRS.length])));
  SPR.lemon = bakeGrid(LEMON, {});
  SPR.cup = bakeGrid(CUP, {});
  SPR.canopy = bakeCanopy();
}
