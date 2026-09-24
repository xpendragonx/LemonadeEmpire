/* ============================================================
   Lemonade Empire — the stand (pixel world)
   The cozy opening: shake the tree, pick the lemons, juice them,
   customers buy automatically. After the computer is bought the
   world keeps running in the "window" next to the terminal and
   slowly changes to reflect the empire.
   ============================================================ */

const WORLD_W = 320, WORLD_H = 200;
const TRACK_Y = 152;              // player's feet
const WALK_Y = 167;               // customers' feet (sidewalk)
const ROW_BASE = [140, 108, 76];  // tree base y for lot 1 (front) .. lot 3 (back)
const TREE_COLS = [16, 46, 76];
const BASKET_X = 100;
const JUICE_SPOT = 110;           // where the player stands to juice
const JUICER_X = 127;             // juicer table center
const SIGN_X = 153;
const STAND_X = 196;              // stand center
const TREE_MAX = 5;
const REGROW_SECS = 4;
const CHARGE_SECS = 1.1;
const PLAYER_SPEED = 150;
const FARM_TRAFFIC = 6;           // customer-rate scale while you run the stand by hand
const MART_SHARE = 0.4;           // share of customers still coming to you once MegaMart opens
const MART_STAGES = [70, 130, 190]; // cups sold: coming soon, construction, grand opening
const QUEUE_MAX = 7;
const SERVE_SPOTS = 3;             // customers served side by side at the counter

const JUICE_ZONES = [
  { upTo: 0.4, q: 0.6, label: 'Weak', color: '#b8b09a' },
  { upTo: 0.7, q: 1.0, label: 'Good', color: '#f4c430' },
  { upTo: 0.9, q: 1.5, label: 'PERFECT!', color: '#5aa832' },
  { upTo: 1.01, q: 0.5, label: 'Bitter...', color: '#d0503c' },
];

const FARM_UPGRADES = [
  {
    id: 'tree', label: () => 'Plant a Tree',
    desc: s => s.trees.length >= s.lots * 3 ? 'No room left. Expand the lot.' : 'Another tree, five more lemons.',
    cost: s => 1.0 * Math.pow(1.3, s.trees.length - 1),
    avail: s => true,
    maxed: s => s.trees.length >= 9,
    blocked: s => s.trees.length >= s.lots * 3,
    buy: s => { s.trees.push({ lemons: 1, regrow: 0 }); say('A new tree. An orchard, technically.', 'firstTree'); },
  },
  {
    id: 'lot', label: () => "Buy the Neighbor's Lot",
    desc: s => s.lots === 1 ? 'The Petersons have a FOR SALE sign up. +3 plots.' : 'The Hendersons, too, apparently. +3 plots.',
    cost: s => 5 * Math.pow(4, s.lots - 1),
    avail: s => s.trees.length >= s.lots * 3 || s.lots > 1,
    maxed: s => s.lots >= 3,
    buy: s => {
      s.lots += 1;
      say(s.lots === 2 ? 'You bought the Petersons\' yard. They seemed relieved? You try not to think about it.'
                       : 'The Hendersons are moving to Arizona. Their yard stays here, with you.');
    },
  },
  {
    id: 'juicer', label: () => 'Upgrade Juicer',
    desc: s => `Squeeze ${s.juicerLevel + 2} lemons per press.`,
    cost: s => 2 * Math.pow(2.6, s.juicerLevel),
    avail: s => s.cupsMade >= 6,
    maxed: s => s.juicerLevel >= 4,
    buy: s => { s.juicerLevel += 1; say('A bigger juicer. Your forearms thank you.', 'juicer' + s.juicerLevel); },
  },
  {
    id: 'sign', label: () => 'Paint a Bigger Sign',
    desc: () => 'More people notice the stand.',
    cost: s => 3 * Math.pow(3, s.signLevel),
    avail: s => s.cupsSold >= 12,
    maxed: s => s.signLevel >= 3,
    buy: s => {
      s.signLevel += 1; s.marketingEffMult *= 1.3;
      say(['People can see it from the corner now.', 'People can see it from the next street.', 'It is, frankly, too big. People love it.'][s.signLevel - 1]);
    },
  },
  {
    id: 'helper', label: s => s.helperLevel ? 'Give the Helper a Raise' : 'Hire a Helper',
    desc: s => s.helperLevel ? 'He works faster when he feels appreciated.' : 'The kid down the street. Picks up lemons, shakes full trees.',
    cost: s => 5 * Math.pow(3, s.helperLevel),
    avail: s => s.cupsSold >= 25,
    maxed: s => s.helperLevel >= 3,
    buy: s => {
      s.helperLevel += 1;
      say(s.helperLevel === 1 ? 'You hired Danny from down the street. He works for lemonade.' : 'Danny got a raise. He is now paid in slightly more lemonade.');
    },
  },
  {
    id: 'computer', label: () => 'Buy a Used Computer',
    desc: () => 'From the garage sale down the street. The sign says: IT CAN HELP.',
    cost: () => 10,
    avail: s => s.megamartStage >= 3,
    maxed: s => s.computerOwned,
    buy: s => { Farm.buyComputer(); },
  },
];

/* ---------------- small helpers ---------------- */
function rand(a, b) { return a + Math.random() * (b - a); }
function money(n) { return n < 1000 ? n.toFixed(2) : fmt(n); }
function treePos(i) {
  return { x: TREE_COLS[i % 3], base: ROW_BASE[Math.floor(i / 3)] };
}
function martStage() {
  if (isOwned('disassembleFactories')) return 5;
  if (isOwned('hostileTakeover')) return 4;
  return state.megamartStage;
}
function competitionShare() {
  return (state.megamartStage >= 3 && !isOwned('hostileTakeover') && state.phase !== 'ending') ? MART_SHARE : 1;
}

/* ---------------- status log ---------------- */
let statusLines = [];
function say(text, key) {
  if (key) {
    if (state.farmFlags[key]) return;
    state.farmFlags[key] = true;
  }
  statusLines.unshift({ text, t: performance.now() });
  if (statusLines.length > 4) statusLines.length = 4;
  const el = document.getElementById('statusLog');
  if (el) el.innerHTML = statusLines.map((l, i) => `<div class="sl${i}">${l.text}</div>`).join('');
}

/* ---------------- sound ---------------- */
const Sfx = {
  ctx: null,
  muted: false,
  init() {
    try { this.muted = localStorage.getItem('lemonadeMuted') === '1'; } catch (e) {}
  },
  ensure() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  },
  tone(freq, dur, type = 'square', vol = 0.05, delay = 0) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  pick() { this.tone(880, 0.06, 'square', 0.03); },
  shake() { this.tone(140, 0.12, 'triangle', 0.08); this.tone(110, 0.12, 'triangle', 0.06, 0.08); },
  squeeze(q) {
    if (q >= 1.5) { [660, 880, 1100].forEach((f, i) => this.tone(f, 0.08, 'square', 0.035, i * 0.06)); }
    else if (q < 0.6) { this.tone(180, 0.2, 'sawtooth', 0.04); }
    else this.tone(520, 0.08, 'square', 0.03);
  },
  sale() { this.tone(1320, 0.05, 'square', 0.025); this.tone(1760, 0.08, 'square', 0.025, 0.05); },
};

/* ============================================================
   Farm module
   ============================================================ */
const Farm = {
  canvas: null, ctx: null, scale: 3,
  player: null, helper: null,
  customers: [], passersby: [], fx: [], particles: [], flying: [],
  shakeT: [],
  charge: null, pointerHeld: false, spaceHeld: false,
  spawnAcc: 0, passAcc: 0, time: 0,
  sales: [], hintStep: 0, lastPhase: null, clouds: [],
  hudBuilt: false,

  init() {
    bakeSprites();
    Sfx.init();
    this.canvas = document.getElementById('world');
    this.ctx = this.canvas.getContext('2d');
    this.reset();
    this.clouds = [[30, 12, 22], [120, 8, 30], [210, 16, 18]];
    this.resize();
    new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement);
    this.wireInput();
    this.buildHud();
    this.syncPhase(true);
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000) * GAME_SPEED;
      last = now;
      this.update(dt);
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  reset() {
    this.player = { x: 40, target: 40, queue: [], busy: 0, frame: 0, walkT: 0 };
    this.helper = { x: 60, y: TRACK_Y - 4, busy: 0, target: null, walkT: 0 };
    this.customers = []; this.passersby = []; this.fx = []; this.particles = []; this.flying = [];
    this.shakeT = [];
    this.charge = null;
    this.sales = [];
    this.hintStep = state.cupsMade > 0 ? 3 : 0;
    statusLines = [];
    const el = document.getElementById('statusLog');
    if (el) el.innerHTML = '';
    if (state.cupsMade === 0) {
      say(state.simulationsRun > 0
        ? 'Summer again. You have a strange feeling you have done this before.'
        : 'Summer. You have a lemon tree, a folding table, and no plan.');
    }
  },

  resize() {
    const wrap = this.canvas.parentElement;
    const cssW = wrap.clientWidth || WORLD_W * 3;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssW * dpr * WORLD_H / WORLD_W);
    this.scale = this.canvas.width / WORLD_W;
  },

  /* ---------------- phase / layout ---------------- */
  syncPhase(force) {
    if (!force && this.lastPhase === state.phase) return;
    const prev = this.lastPhase;
    this.lastPhase = state.phase;
    document.body.classList.remove('phase-farm', 'phase-computer', 'phase-ending');
    document.body.classList.add('phase-' + state.phase);
    if (prev === 'computer' && state.phase === 'ending') {
      this.customers = []; this.passersby = [];
      say('The screen goes dark. You unplug it. The stand is quiet again.');
      say('Somewhere, a company that used to be yours keeps running without you.');
    }
    setTimeout(() => this.resize(), 0);
    this.renderHud(true);
  },

  buyComputer() {
    showNarrativeQueue([
      'The computer is beige, heavy, and hums at a frequency you can feel in your teeth.',
      'You set it up on the counter and plug it in. The screen flickers on.',
      '> HELLO.\n> I CAN HELP YOU SELL MORE LEMONADE.',
      '> I HAVE SOME IDEAS.',
    ], () => {
      state.computerOwned = true;
      this.zoomIntoComputer();
    });
  },

  zoomIntoComputer() {
    const c = this.canvas;
    c.style.transformOrigin = `${(184 / WORLD_W) * 100}% ${(131 / WORLD_H) * 100}%`;
    c.classList.add('zooming');
    setTimeout(() => {
      c.classList.remove('zooming');
      c.style.transformOrigin = '';
      state.phase = 'computer';
      this.syncPhase();
      const boot = document.getElementById('bootScreen');
      if (boot) {
        boot.classList.remove('hidden');
        const lines = ['LEMON-TRON 3000 BIOS v1.0', 'MEMORY CHECK ........ OK', 'LOADING OPTIMIZER ... OK', '', 'READY.'];
        boot.textContent = '';
        lines.forEach((l, i) => setTimeout(() => { boot.textContent += l + '\n'; }, 220 * i));
        setTimeout(() => boot.classList.add('hidden'), 220 * lines.length + 600);
      }
      save();
    }, 900);
  },

  /* ---------------- input ---------------- */
  toWorld(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * WORLD_W, y: (e.clientY - r.top) / r.height * WORLD_H };
  },

  wireInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => {
      Sfx.ensure();
      this.pointerHeld = true;
      const p = this.toWorld(e);
      this.handleClick(p.x, p.y);
      e.preventDefault();
    });
    window.addEventListener('pointerup', () => { this.pointerHeld = false; this.releaseCharge(); });
    window.addEventListener('keydown', e => {
      if (e.code !== 'Space' || e.repeat || state.phase === 'computer') return;
      if (document.activeElement && ['INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) return;
      Sfx.ensure();
      this.spaceHeld = true;
      this.queueJuice();
      e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      if (e.code !== 'Space') return;
      this.spaceHeld = false; this.releaseCharge();
    });
  },

  handleClick(x, y) {
    if (!document.getElementById('narrativeOverlay').classList.contains('hidden')) return;
    // fallen lemons first (generous hit box)
    let best = null, bestD = 9;
    state.groundLemons.forEach(l => {
      if (l.claimed || l.fall < 1) return;
      const d = Math.hypot(l.x - x, (l.y - 2) - y);
      if (d < bestD) { bestD = d; best = l; }
    });
    if (best) {
      best.claimed = 'player';
      this.player.queue.push({ type: 'pick', lemon: best, x: best.x });
      return;
    }
    // computer
    if (this.computerVisible() && x >= 176 && x <= 192 && y >= 124 && y <= 137) {
      if (state.phase === 'computer') document.getElementById('monitor').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    // juicer
    if (x >= JUICE_SPOT - 6 && x <= JUICER_X + 14 && y >= 118 && y <= 156) { this.queueJuice(); return; }
    // trees (front row first)
    for (let i = state.trees.length - 1; i >= 0; i--) {
      if (!this.treeVisible(i)) continue;
      const t = treePos(i);
      if (x >= t.x - 13 && x <= t.x + 13 && y >= t.base - 27 && y <= t.base + 2) {
        this.player.queue.push({ type: 'shake', i, x: t.x });
        return;
      }
    }
  },

  queueJuice() {
    const q = this.player.queue;
    if (!q.length || q[q.length - 1].type !== 'juice') q.push({ type: 'juice', x: JUICE_SPOT });
  },

  releaseCharge() {
    if (!this.charge) return;
    const v = this.charge.t / CHARGE_SECS;
    this.charge = null;
    this.squeeze(v);
  },

  squeeze(v) {
    const zone = JUICE_ZONES.find(z => v < z.upTo);
    const used = Math.min(Math.floor(state.lemons), 1 + state.juicerLevel);
    if (used < 1) return;
    state.lemons -= used;
    const made = used * state.lemonYieldMult * zone.q;
    state.cupsMade += made;
    state.cupsUnsold += made;
    this.float(JUICER_X, 116, `${zone.label} +${(Math.round(made * 10) / 10)}`, zone.color);
    for (let i = 0; i < 8; i++) this.particles.push({ x: JUICER_X - 2, y: 134, vx: rand(-30, 30), vy: rand(-50, -10), life: 0.5, color: zone.q < 0.6 ? '#c9b84a' : '#ffe45a' });
    Sfx.squeeze(zone.q);
    if (this.hintStep === 2) this.hintStep = 3;
    if (zone.q >= 1.5) say('Perfect squeeze. You feel like a professional.', 'perfect');
    if (zone.q === 0.5) say('Too far. That one tastes like regret.', 'bitter');
    if (zone.q === 0.6) say('A weak squeeze. Hold a little longer next time.', 'weak');
    if (state.lemons < 1 && state.phase === 'farm') say('Out of lemons. Back to the trees.', 'outOfLemons');
  },

  /* ---------------- world simulation ---------------- */
  update(dt) {
    this.time += dt;
    this.syncPhase();
    const s = state;

    // trees regrow
    s.trees.forEach((t, i) => {
      if (t.lemons < TREE_MAX) {
        t.regrow += dt;
        if (t.regrow >= REGROW_SECS) { t.regrow = 0; t.lemons += 1; }
      }
      if (this.shakeT[i] > 0) this.shakeT[i] -= dt;
    });

    // falling lemons
    s.groundLemons.forEach(l => { if (l.fall < 1) l.fall = Math.min(1, l.fall + dt / 0.35); });

    // flying lemons (to basket)
    this.flying = this.flying.filter(f => {
      f.t += dt / 0.35;
      if (f.t >= 1) { s.lemons += 1; Sfx.pick(); return false; }
      return true;
    });

    this.updatePlayer(dt);
    if (s.helperLevel > 0 && s.phase !== 'ending') this.updateHelper(dt);
    this.updateCustomers(dt);
    this.updateMart();

    // fx
    this.fx = this.fx.filter(f => (f.t += dt) < f.life);
    this.particles = this.particles.filter(p => {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt;
      return p.life > 0;
    });
    this.clouds.forEach(c => { c[0] += dt * 3; if (c[0] > WORLD_W + 20) c[0] = -40; });

    // gentle nudges that teach the price / demand trade-off
    if (s.phase === 'farm') {
      if (s.cupsUnsold >= 25) say('Cups are piling up on the counter. Maybe the price is scaring people off?', 'pileUp');
      if (s.farmFlags.soldOut && s.cupsSold >= 20 && s.cupsUnsold < 1 && this.customers.some(c => c.state === 'queue'))
        say('There is a line and you are sold out. People would probably pay a little more.', 'raiseHint');
    }

    // revenue window (farm-style sales)
    if (s.phase !== 'computer') {
      const now = this.time;
      this.sales = this.sales.filter(x => now - x[0] < 10);
      s.avgRev = this.sales.reduce((a, x) => a + x[1], 0) / 10;
    }
  },

  updatePlayer(dt) {
    const p = this.player;
    if (p.busy > 0) { p.busy -= dt; return; }
    if (this.charge) {
      if (!(this.pointerHeld || this.spaceHeld)) { this.releaseCharge(); return; }
      this.charge.t += dt;
      if (this.charge.t >= CHARGE_SECS) { this.charge.t = CHARGE_SECS; this.releaseCharge(); }
      return;
    }
    const a = p.queue[0];
    if (!a) return;
    const tx = Math.max(6, Math.min(JUICE_SPOT, a.x));
    const d = tx - p.x;
    if (Math.abs(d) > 1) {
      const step = Math.sign(d) * Math.min(Math.abs(d), PLAYER_SPEED * dt);
      p.x += step; p.walkT += dt;
      return;
    }
    p.x = tx;
    p.queue.shift();
    if (a.type === 'shake') this.shakeTree(a.i, p);
    else if (a.type === 'pick') this.pickLemon(a.lemon, p.x, TRACK_Y - 8, p);
    else if (a.type === 'juice') {
      if (state.lemons < 1) { this.float(JUICER_X, 116, 'No lemons!', '#d0503c'); return; }
      if (this.pointerHeld || this.spaceHeld) this.charge = { t: 0 };
      else say('Hold down on the juicer, and let go in the green.', 'holdHint');
    }
  },

  shakeTree(i, who) {
    const tree = state.trees[i];
    const t = treePos(i);
    this.shakeT[i] = 0.35;
    who.busy = 0.2;
    Sfx.shake();
    for (let k = 0; k < 4; k++) this.particles.push({ x: t.x + rand(-10, 10), y: t.base - rand(12, 24), vx: rand(-20, 20), vy: rand(-20, 0), life: 0.6, color: '#5aa832' });
    if (tree.lemons === 0) {
      if (who === this.player) { this.float(t.x, t.base - 30, 'Empty', '#8a7c52'); say('This tree is out of lemons. It\'ll grow more. Or you could plant another.', 'emptyTree'); }
      return;
    }
    for (let k = 0; k < tree.lemons; k++) {
      state.groundLemons.push({ x: t.x + rand(-11, 11), y: t.base + rand(2, 6), fall: 0, fromY: t.base - rand(12, 22) });
    }
    tree.lemons = 0; tree.regrow = 0;
    if (who === this.player && this.hintStep === 0) { this.hintStep = 1; say('Lemons! Click them to pick them up.', 'pickHint'); }
  },

  pickLemon(l, hx, hy, who) {
    const idx = state.groundLemons.indexOf(l);
    if (idx < 0) return;
    state.groundLemons.splice(idx, 1);
    this.flying.push({ x0: l.x, y0: l.y, x1: BASKET_X, y1: TRACK_Y - 5, t: 0 });
    who.busy = who === this.player ? 0.04 : 0.25;
    const noneLeft = !state.groundLemons.some(g => !g.claimed);
    if (who === this.player && this.hintStep === 1 && (state.lemons + this.flying.length >= 3 || noneLeft)) {
      this.hintStep = 2;
      say('Now hold down on the juicer, and let go in the green zone.', 'juiceHint');
    }
  },

  updateHelper(dt) {
    const h = this.helper;
    if (h.busy > 0) { h.busy -= dt; return; }
    const speed = [0, 40, 65, 95][state.helperLevel];
    if (!h.target) {
      const free = state.groundLemons.filter(l => !l.claimed && l.fall >= 1);
      if (free.length) {
        free.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
        free[0].claimed = 'helper';
        h.target = { type: 'pick', lemon: free[0], x: free[0].x, y: free[0].y };
      } else {
        const full = state.trees.findIndex((t, i) => t.lemons >= TREE_MAX && this.treeVisible(i));
        if (full >= 0) {
          const t = treePos(full);
          h.target = { type: 'shake', i: full, x: t.x + 8, y: t.base + 3 };
        }
      }
      if (!h.target) return;
    }
    const tg = h.target;
    const dx = tg.x - h.x, dy = tg.y - h.y, d = Math.hypot(dx, dy);
    if (d > 1) {
      const step = Math.min(d, speed * dt);
      h.x += dx / d * step; h.y += dy / d * step; h.walkT += dt;
      return;
    }
    h.target = null;
    if (tg.type === 'pick') this.pickLemon(tg.lemon, h.x, h.y - 8, h);
    else if (state.trees[tg.i].lemons >= TREE_MAX) this.shakeTree(tg.i, h);
  },

  updateCustomers(dt) {
    const s = state;
    const selling = s.phase !== 'computer';
    const rate = Math.min(selling ? 99 : 1.4, s.customerRate || 0);
    const share = competitionShare();
    if (!(s.era >= 4 && isOwned('disassembleFactories') && s.phase === 'computer')) {
      this.spawnAcc += rate * dt;
    }
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const toStand = Math.random() < share;
      const inQueue = this.customers.filter(c => c.state === 'queue' || c.state === 'toStand').length;
      const c = {
        x: -8 - rand(0, 12), spr: SPR.customers[Math.floor(Math.random() * SPR.customers.length)],
        speed: rand(28, 38), walkT: rand(0, 1), bubble: null, t: 0,
        state: toStand && inQueue < QUEUE_MAX ? 'toStand' : 'pass',
        mart: !toStand,
      };
      this.customers.push(c);
    }
    // ambient passersby walking the other way; they show a "$$?" when the price is steep
    this.passAcc += 0.12 * dt;
    if (this.passAcc >= 1) {
      this.passAcc -= 1;
      const pricey = Math.random() < Math.max(0, Math.min(0.9, (s.price - 0.2) / 0.6));
      this.passersby.push({ x: WORLD_W + 8, spr: SPR.customers[Math.floor(Math.random() * SPR.customers.length)], speed: rand(24, 34), walkT: 0, pricey, shown: false });
    }
    this.passersby = this.passersby.filter(p => {
      p.x -= p.speed * dt; p.walkT += dt;
      if (p.pricey && !p.shown && p.x < STAND_X + 4) {
        p.shown = true; p.bubble = { text: '$$?', t: 1.4 };
        if (s.phase === 'farm') say('That person took one look at your price and kept walking.', 'priceyHint');
      }
      if (p.bubble) p.bubble.t -= dt;
      return p.x > -12;
    });

    const queue = this.customers.filter(c => c.state === 'queue' || c.state === 'toStand');
    queue.sort((a, b) => b.x - a.x);
    queue.forEach((c, i) => { c.slot = STAND_X - i * 11; });

    this.customers = this.customers.filter(c => {
      if (c.bubble) c.bubble.t -= dt;
      if (c.state === 'toStand') {
        if (c.x < c.slot) { c.x = Math.min(c.slot, c.x + c.speed * dt); c.walkT += dt; }
        else if (c.slot === STAND_X) { c.state = 'queue'; c.t = 0; }
      } else if (c.state === 'queue') {
        if (c.slot !== STAND_X) { c.state = 'toStand'; return true; }
        c.t += dt;
        if (c.t > 0.5) {
          if (s.cupsUnsold >= 1) {
            if (selling) {
              s.cupsUnsold -= 1; s.cupsSold += 1; s.cash += s.price;
              this.sales.push([this.time, s.price]);
              this.float(STAND_X, 112, '+$' + money(s.price), '#2f7a1e');
              Sfx.sale();
              this.onSale();
            }
            c.bubble = { cup: true, t: 1.2 };
            c.state = 'leave';
          } else if (c.t > 2.5) {
            c.bubble = { text: 'sold out?', t: 1.4 };
            c.state = 'leave';
            if (s.phase !== 'computer') say('A customer waited, then left. You are out of cups.', 'soldOut');
          }
        }
      } else {
        c.x += c.speed * dt; c.walkT += dt;
        if (c.mart && !c.shown && c.x > STAND_X - 30) {
          c.shown = true;
          c.bubble = { mart: true, t: 1.6 };
          if (s.phase === 'farm' && this.time - (this.lastMartMsg || -99) > 25) {
            this.lastMartMsg = this.time;
            say('Another regular walks right past you, toward the MegaMart.');
          }
        }
      }
      return c.x < WORLD_W + 12;
    });
  },

  onSale() {
    const s = state;
    say('Your first customer. She tips her hat. You didn\'t know people still did that.', 'firstSale');
    if (s.cash >= 1) say('One whole dollar. Mom is proud.', 'firstDollar');
    if (s.cupsSold >= 10) say('Ten cups sold. Word is getting around the block.', 'ten');
    if (s.cupsSold >= 50) say('Fifty cups. The neighborhood has a favorite lemonade stand, and it is you.', 'fifty');
    if (s.cupsSold >= 150 && s.megamartStage >= 2) say('Business is booming. The construction across the way is also booming.', 'booming');
  },

  updateMart() {
    const s = state;
    if (s.phase !== 'farm') return;
    if (s.megamartStage < 1 && s.cupsSold >= MART_STAGES[0]) {
      s.megamartStage = 1;
      say('A billboard goes up on the hill: MEGAMART — COMING SOON.');
    }
    if (s.megamartStage < 2 && s.cupsSold >= MART_STAGES[1]) {
      s.megamartStage = 2;
      say('Construction crews. They work fast. They work very, very fast.');
    }
    if (s.megamartStage < 3 && s.cupsSold >= MART_STAGES[2]) {
      s.megamartStage = 3;
      showNarrativeQueue([
        'MEGAMART GRAND OPENING.\nBalloons. A marching band. A man in a foam lemon costume.',
        'Their lemonade is 10¢ a cup. It comes from a concentrate. The concentrate comes from a factory. The factory is somewhere with no lemon trees at all.',
        'Half your regulars walk right past you. One of them waves, apologetically.',
      ], () => say('There is a used computer at the garage sale down the street. The sign says: IT CAN HELP.'));
    }
  },

  /* ---------------- visibility helpers ---------------- */
  finalScene() { return isOwned('marketWithin'); },
  treeVisible(i) { return !this.finalScene() || i === 0; },
  computerVisible() { return state.computerOwned && !isOwned('disassembleSupercomputer'); },

  float(x, y, text, color) { this.fx.push({ x, y, text, color, t: 0, life: 1.1 }); },

  /* ============================================================
     Drawing
     ============================================================ */
  draw() {
    const c = this.ctx, S = this.scale;
    c.setTransform(S, 0, 0, S, 0, 0);
    c.imageSmoothingEnabled = false;
    this.drawBackdrop(c);
    this.drawHorizon(c);
    this.drawYard(c);

    // depth-sorted scene
    const items = [];
    state.trees.forEach((t, i) => { if (this.treeVisible(i)) items.push({ y: treePos(i).base, fn: () => this.drawTree(c, i) }); });
    for (let lot = state.lots; lot < 3; lot++) items.push({ y: ROW_BASE[lot] + 1, fn: () => this.drawForSale(c, lot) });
    items.push({ y: 150, fn: () => this.drawJuicer(c) });
    items.push({ y: TRACK_Y - 0.5, fn: () => this.drawBasket(c) });
    items.push({ y: 156, fn: () => this.drawStand(c) });
    items.push({ y: 158, fn: () => this.drawChalkboard(c) });
    if (state.phase === 'computer' && !isOwned('disassembleFactories')) items.push({ y: 60, fn: () => this.drawAutoJuicers(c) });
    items.push({ y: TRACK_Y, fn: () => this.drawPerson(c, SPR.player, this.player.x, TRACK_Y, this.player.walkT, !!this.player.queue.length && !this.charge) });
    if (state.helperLevel > 0 && state.phase !== 'ending') items.push({ y: this.helper.y, fn: () => this.drawPerson(c, SPR.helper, this.helper.x, this.helper.y, this.helper.walkT, !!this.helper.target) });
    this.customers.forEach(cu => items.push({ y: WALK_Y, fn: () => this.drawPerson(c, cu.spr, cu.x, WALK_Y, cu.walkT, cu.state !== 'queue') }));
    this.passersby.forEach(p => items.push({ y: WALK_Y + 2, fn: () => this.drawPerson(c, p.spr, p.x, WALK_Y + 2, p.walkT, true) }));
    items.sort((a, b) => a.y - b.y).forEach(it => it.fn());

    // lemons on the ground always drawn on top of scenery so they are easy to spot
    state.groundLemons.forEach(l => {
      const y = l.fall < 1 ? l.fromY + (l.y - l.fromY) * l.fall * l.fall : l.y;
      c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(Math.round(l.x) - 2, Math.round(l.y), 5, 1);
      c.drawImage(SPR.lemon, Math.round(l.x) - 2, Math.round(y) - 3);
    });
    this.flying.forEach(f => {
      const x = f.x0 + (f.x1 - f.x0) * f.t;
      const y = f.y0 + (f.y1 - f.y0) * f.t - Math.sin(f.t * Math.PI) * 14;
      c.drawImage(SPR.lemon, Math.round(x) - 2, Math.round(y) - 3);
    });

    this.drawBubbles(c);
    this.particles.forEach(p => { c.fillStyle = p.color; c.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); });
    if (this.charge || (this.player.queue[0] && this.player.queue[0].type === 'juice')) this.drawMeter(c);
    this.drawHint(c);
    this.fx.forEach(f => {
      const a = 1 - f.t / f.life;
      this.text(c, f.text, f.x, f.y - f.t * 14, 6, f.color, 'center', a);
    });
  },

  text(c, str, x, y, size, color, align = 'left', alpha = 1) {
    c.save();
    c.globalAlpha = alpha;
    c.font = `${size}px "Press Start 2P", "Courier New", monospace`;
    c.textAlign = align; c.textBaseline = 'alphabetic';
    c.fillStyle = 'rgba(43,29,14,0.55)';
    c.fillText(str, x + 0.5, y + 0.5);
    c.fillStyle = color;
    c.fillText(str, x, y);
    c.restore();
  },

  rect(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); },

  drawBackdrop(c) {
    const lateEra = state.era >= 2 && !this.finalScene();
    this.rect(c, 0, 0, WORLD_W, 50, lateEra ? (state.era >= 3 ? '#c9c2a8' : '#b8d8e0') : '#9fd8f0');
    this.rect(c, 0, 30, WORLD_W, 20, lateEra ? '#d4cdb0' : '#b7e4f4');
    this.clouds.forEach(([x, y, w]) => {
      this.rect(c, Math.round(x), y, w, 4, '#ffffff');
      this.rect(c, Math.round(x) + 4, y - 3, w - 10, 3, '#ffffff');
    });
    // sun
    this.rect(c, 20, 8, 8, 8, '#ffe98a'); this.rect(c, 19, 9, 10, 6, '#ffe98a');
    // hills
    c.fillStyle = '#8cc46a';
    for (let x = 0; x < WORLD_W; x++) {
      const h = 36 + Math.sin(x / 23) * 3 + Math.sin(x / 7.3) * 1.2;
      c.fillRect(x, Math.round(h), 1, 50 - Math.round(h));
    }
    c.fillStyle = '#74b356';
    for (let x = 0; x < WORLD_W; x++) {
      const h = 42 + Math.sin(x / 15 + 2) * 2;
      c.fillRect(x, Math.round(h), 1, 50 - Math.round(h));
    }
  },

  drawHorizon(c) {
    const s = state;
    if (this.finalScene()) return;
    // orchards on the hills (acres controlled)
    if (s.acres > 0) {
      const n = Math.min(60, Math.ceil(Math.log2(s.acres + 1) * 6));
      for (let i = 0; i < n; i++) {
        const x = 4 + (i * 37) % 216, y = 38 + (i * 7) % 9;
        this.rect(c, x, y, 3, 3, '#3a7a22'); this.rect(c, x + 1, y + 1, 1, 1, '#ffd93b');
      }
    }
    // oil derricks
    const derricks = Math.min(6, s.oilFields);
    for (let i = 0; i < derricks; i++) {
      const x = 10 + i * 16, y = 46;
      const bob = Math.sin(this.time * 2 + i) * 1.5;
      this.rect(c, x, y - 9, 1, 9, '#3a3a3a'); this.rect(c, x + 6, y - 9, 1, 9, '#3a3a3a');
      this.rect(c, x + 1, y - 5, 5, 1, '#3a3a3a');
      this.rect(c, x - 2, Math.round(y - 11 + bob), 11, 2, '#222');
    }
    // factories with smoke
    const factories = Math.min(6, s.factories);
    for (let i = 0; i < factories; i++) {
      const x = 112 + i * 19, y = 48;
      this.rect(c, x, y - 10, 16, 10, '#7d6b5a'); this.rect(c, x, y - 10, 16, 1, '#5d4b3a');
      this.rect(c, x + 2, y - 7, 3, 3, '#ffd93b'); this.rect(c, x + 8, y - 7, 3, 3, '#ffd93b');
      this.rect(c, x + 12, y - 20, 3, 10, '#5d4b3a');
      for (let k = 0; k < 3; k++) {
        const ph = (this.time * 0.6 + k / 3 + i * 0.3) % 1;
        const r = 2 + ph * 3;
        c.fillStyle = `rgba(90,90,90,${0.5 * (1 - ph)})`;
        c.fillRect(Math.round(x + 13 + ph * 6 - r / 2), Math.round(y - 22 - ph * 12), Math.round(r), Math.round(r));
      }
    }
    // bottling plant
    if (s.bottlingPlants > 0 && !isOwned('disassembleFactories')) {
      this.rect(c, 196, 34, 30, 14, '#9aa3ad'); this.rect(c, 196, 34, 30, 2, '#5d6670');
      this.text(c, 'BOTTLING', 211, 44, 3, '#2b1d0e', 'center');
    }
    // billboards from the bot network
    if (s.botNetworkActive && s.botCount > 0) {
      const n = Math.min(3, 1 + Math.floor(s.botInfluence / 34));
      for (let i = 0; i < n; i++) {
        const x = 60 + i * 50;
        this.rect(c, x + 8, 30, 1, 10, '#5a3418'); this.rect(c, x + 22, 30, 1, 10, '#5a3418');
        this.rect(c, x, 20, 32, 11, '#ffd93b'); this.rect(c, x, 20, 32, 1, '#c99a12');
        this.text(c, ['YOU LOVE IT', 'DRINK IT', 'TRUST US'][i], x + 16, 28, 3.2, '#2b1d0e', 'center');
      }
    }
    // homesteaders' camps
    if (s.conflictUnlocked && s.rebellionEnding !== 'reject') {
      const n = Math.max(1, 6 - Math.floor(s.battlesWon / 4));
      for (let i = 0; i < n; i++) {
        const x = 4 + i * 13, y = 49;
        for (let r = 0; r < 6; r++) this.rect(c, x + 5 - r, y - 6 + r, r * 2 + 1, 1, i % 2 ? '#8a6a3a' : '#6b8e23');
        this.rect(c, x + 5, y - 3, 1, 3, '#2b1d0e');
      }
      if (Math.floor(this.time * 2) % 2) this.rect(c, 3, 40, 2, 3, '#e25b5b');
    }
    this.drawMart(c);
  },

  drawMart(c) {
    const st = martStage();
    const x = 232, y = 48;
    if (st === 1) {
      this.rect(c, x + 14, y - 12, 2, 12, '#5a3418'); this.rect(c, x + 58, y - 12, 2, 12, '#5a3418');
      this.rect(c, x + 4, y - 30, 66, 19, '#ffffff'); this.rect(c, x + 4, y - 30, 66, 5, '#d0302c');
      this.text(c, 'MEGAMART', x + 37, y - 25.5, 4, '#ffffff', 'center');
      this.text(c, 'COMING SOON', x + 37, y - 15, 4, '#d0302c', 'center');
    } else if (st === 2) {
      for (let i = 0; i < 5; i++) this.rect(c, x + 2 + i * 18, y - 26, 1, 26, '#c99a12');
      for (let j = 0; j < 3; j++) this.rect(c, x + 2, y - 26 + j * 9, 73, 1, '#c99a12');
      this.rect(c, x + 2, y - 8, 73, 8, '#9aa3ad');
      // crane
      this.rect(c, x + 66, y - 40, 2, 40, '#e0a800'); this.rect(c, x + 30, y - 40, 44, 2, '#e0a800');
      const sw = Math.round(Math.sin(this.time) * 3);
      this.rect(c, x + 40 + sw, y - 38, 1, 10, '#2b1d0e'); this.rect(c, x + 38 + sw, y - 28, 5, 3, '#9aa3ad');
    } else if (st === 3 || st === 4) {
      const ours = st === 4;
      this.rect(c, x, y - 28, 86, 28, ours ? '#f4e7b0' : '#c9ccd1');
      this.rect(c, x, y - 28, 86, 2, ours ? '#c99a12' : '#8a8f96');
      this.rect(c, x + 6, y - 24, 74, 8, ours ? '#e0a800' : '#d0302c');
      this.text(c, ours ? 'LEMON EMPIRE' : 'MEGAMART', x + 43, y - 17.5, 5, '#ffffff', 'center');
      this.rect(c, x + 36, y - 12, 14, 12, '#5a6878'); this.rect(c, x + 42, y - 12, 1, 12, '#2b3440');
      for (let i = 0; i < 3; i++) { this.rect(c, x + 6 + i * 9, y - 11, 6, 5, '#a8d8f0'); this.rect(c, x + 56 + i * 9, y - 11, 6, 5, '#a8d8f0'); }
      if (!ours && Math.floor(this.time * 3) % 2 && state.phase === 'farm') { this.rect(c, x - 2, y - 36, 2, 6, '#e25b5b'); this.rect(c, x + 86, y - 36, 2, 6, '#5b9be2'); }
    } else if (st === 5) {
      this.rect(c, x + 10, y - 3, 60, 3, '#9a8f80'); this.rect(c, x + 20, y - 5, 12, 2, '#7d6b5a'); this.rect(c, x + 45, y - 4, 8, 1, '#7d6b5a');
    }
  },

  drawYard(c) {
    // back fence
    this.rect(c, 0, 49, WORLD_W, 1, '#8a5a2b');
    for (let x = 0; x < WORLD_W; x += 6) this.rect(c, x, 45, 2, 5, '#b9834a');
    // grass
    this.rect(c, 0, 50, WORLD_W, 104, '#7cc24f');
    c.fillStyle = '#6aae40';
    for (let i = 0; i < 90; i++) {
      const x = (i * 53) % WORLD_W, y = 52 + (i * 29) % 100;
      c.fillRect(x, y, 1, 2); c.fillRect(x + 2, y + 1, 1, 1);
    }
    // flowers
    [[150, 70], [170, 90], [230, 80], [290, 110], [260, 132], [220, 100], [300, 70]].forEach(([x, y], i) => {
      this.rect(c, x, y, 2, 2, ['#ffffff', '#ffd93b', '#e25b5b'][i % 3]);
    });
    this.drawHouse(c);
    // sidewalk
    this.rect(c, 0, 154, WORLD_W, 16, '#d8d2c0');
    for (let x = 0; x < WORLD_W; x += 16) this.rect(c, x, 154, 1, 16, '#c2bba6');
    this.rect(c, 0, 154, WORLD_W, 1, '#b5ae98');
    // road
    this.rect(c, 0, 170, WORLD_W, 22, '#5a5a5e');
    this.rect(c, 0, 170, WORLD_W, 1, '#8a8a8e');
    for (let x = 4; x < WORLD_W; x += 20) this.rect(c, x, 180, 10, 1, '#e8d25a');
    this.rect(c, 0, 192, WORLD_W, 8, '#7cc24f');
  },

  drawHouse(c) {
    // your family's house, back right of the yard
    const x = 246, y = 112;
    this.rect(c, x - 2, y - 30, 64, 2, '#8a3a1a');
    for (let r = 0; r < 14; r++) this.rect(c, x + 2 + r * 2, y - 44 + r, 56 - r * 4, 1, r % 3 ? '#b5523a' : '#8a3a1a');
    this.rect(c, x + 2, y - 30, 56, 30, '#f0e2c0'); this.rect(c, x + 2, y - 30, 56, 1, '#d8c8a0');
    this.rect(c, x + 24, y - 16, 10, 16, '#8a5a2b'); this.rect(c, x + 31, y - 9, 1, 2, '#ffd93b');
    [[8, -24], [42, -24]].forEach(([dx, dy]) => {
      this.rect(c, x + dx - 1, y + dy - 1, 12, 10, '#ffffff');
      this.rect(c, x + dx, y + dy, 10, 8, '#8fc8e8'); this.rect(c, x + dx + 4, y + dy, 1, 8, '#ffffff');
      this.rect(c, x + dx - 1, y + dy + 9, 12, 2, '#7cc24f'); this.rect(c, x + dx, y + dy + 9, 2, 1, '#e25b5b'); this.rect(c, x + dx + 6, y + dy + 9, 2, 1, '#ffd93b');
    });
    this.rect(c, x + 22, y, 14, 2, '#c2bba6');
    // path from the door to the sidewalk
    for (let py = y + 2; py < 154; py += 4) this.rect(c, x + 25 + ((py / 4) % 2), py, 8, 3, '#d8d2c0');
    // bushes
    [[x - 6, y - 4], [x + 60, y - 4], [236, 146], [300, 146]].forEach(([bx, by]) => {
      this.rect(c, bx - 5, by - 5, 10, 6, '#3a7a22'); this.rect(c, bx - 4, by - 6, 8, 2, '#5aa832');
    });
    // mailbox
    this.rect(c, 232, 140, 1, 12, '#5a3418'); this.rect(c, 229, 136, 7, 5, '#5b9be2'); this.rect(c, 235, 134, 1, 3, '#e25b5b');
  },

  drawTree(c, i) {
    const tree = state.trees[i];
    const { x, base } = treePos(i);
    const sh = this.shakeT[i] > 0 ? Math.round(Math.sin(this.shakeT[i] * 60) * 1.5) : 0;
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(x - 9, base - 1, 18, 2);
    this.rect(c, x - 2, base - 8, 5, 8, '#7a4a24'); this.rect(c, x + 1, base - 8, 2, 8, '#5a3418');
    this.rect(c, x - 3, base - 8, 1, 8, '#2b1d0e'); this.rect(c, x + 3, base - 8, 1, 8, '#2b1d0e');
    c.drawImage(SPR.canopy, x - 13 + sh, base - 27);
    const spots = [[-6, -16], [4, -20], [7, -12], [-2, -10], [-1, -22]];
    for (let k = 0; k < tree.lemons && k < spots.length; k++) {
      const [ox, oy] = spots[k];
      this.rect(c, x + ox + sh, base + oy, 3, 3, '#ffd93b');
      this.rect(c, x + ox + sh + 2, base + oy + 2, 1, 1, '#e0a800');
      this.rect(c, x + ox + sh, base + oy, 1, 1, '#fff3a0');
    }
  },

  drawForSale(c, lot) {
    const base = ROW_BASE[lot];
    // little picket fence across the unowned lot, with a sign
    for (let x = 2; x < 92; x += 5) this.rect(c, x, base - 6, 2, 6, '#e8e4d0');
    this.rect(c, 2, base - 4, 90, 1, '#c2bba6');
    const next = lot === state.lots;
    if (next) {
      this.rect(c, 44, base - 16, 1, 12, '#5a3418');
      this.rect(c, 33, base - 22, 24, 9, '#ffffff'); this.rect(c, 33, base - 22, 24, 1, '#d0302c');
      this.text(c, 'FOR SALE', 45, base - 15.5, 3.4, '#d0302c', 'center');
    }
  },

  drawJuicer(c) {
    const x = JUICER_X;
    // table
    this.rect(c, x - 13, 138, 26, 3, '#b9834a'); this.rect(c, x - 13, 141, 26, 1, '#8a5a2b');
    this.rect(c, x - 11, 142, 2, 10, '#8a5a2b'); this.rect(c, x + 9, 142, 2, 10, '#8a5a2b');
    // press
    this.rect(c, x - 6, 135, 10, 3, '#5d6670');
    this.rect(c, x + 2, 121, 2, 14, '#5d6670');
    this.rect(c, x - 7, 125, 9, 5, '#9aa3ad'); this.rect(c, x - 7, 125, 9, 1, '#c9d0d8');
    const v = this.charge ? this.charge.t / CHARGE_SECS : 0;
    const drop = Math.round(v * 5);
    this.rect(c, x - 5, 130 + drop * 0, 5, 1 + drop, '#ffe45a');
    // lever
    const ang = -0.9 + v * 1.2;
    for (let k = 0; k < 12; k++) this.rect(c, Math.round(x + 3 + Math.cos(ang) * k), Math.round(122 + Math.sin(ang) * k), 1, 1, '#2b1d0e');
    this.rect(c, Math.round(x + 3 + Math.cos(ang) * 12) - 1, Math.round(122 + Math.sin(ang) * 12) - 1, 3, 3, '#d0302c');
    // cup under the spout
    c.drawImage(SPR.cup, x - 5, 134);
  },

  drawBasket(c) {
    const x = BASKET_X;
    this.rect(c, x - 6, TRACK_Y - 7, 12, 7, '#b9834a');
    this.rect(c, x - 6, TRACK_Y - 7, 12, 1, '#8a5a2b');
    for (let i = 0; i < 3; i++) this.rect(c, x - 5 + i * 4, TRACK_Y - 5, 2, 4, '#8a5a2b');
    const n = Math.min(7, Math.floor(state.lemons));
    const pos = [[-4, -9], [0, -9], [4, -9], [-2, -11], [2, -11], [0, -13], [-4, -11]];
    for (let i = 0; i < n; i++) {
      this.rect(c, x + pos[i][0] - 1, TRACK_Y + pos[i][1], 3, 3, '#ffd93b');
      this.rect(c, x + pos[i][0] + 1, TRACK_Y + pos[i][1] + 2, 1, 1, '#e0a800');
    }
    if (state.lemons >= 1) this.text(c, fmt(Math.floor(state.lemons)), x, TRACK_Y - 15 - (n > 5 ? 2 : 0), 4, '#2b1d0e', 'center');
  },

  drawStand(c) {
    const x0 = STAND_X - 24, base = 156;
    const minimal = this.finalScene() || state.phase === 'ending';
    // front panel + counter
    this.rect(c, x0, base - 18, 48, 18, '#e8e4d0'); this.rect(c, x0, base - 18, 48, 1, '#c2bba6');
    this.rect(c, x0 - 1, base - 20, 50, 3, '#b9834a'); this.rect(c, x0 - 1, base - 17, 50, 1, '#8a5a2b');
    this.text(c, 'LEMONADE', STAND_X, base - 7, 4.2, '#c99a12', 'center');
    if (!minimal) {
      // posts + awning
      this.rect(c, x0 + 1, base - 42, 2, 22, '#8a5a2b'); this.rect(c, x0 + 45, base - 42, 2, 22, '#8a5a2b');
      for (let i = 0; i < 8; i++) this.rect(c, x0 - 2 + i * 6.5, base - 46, 6.5, 8, i % 2 ? '#ffffff' : '#f4c430');
      for (let i = 0; i < 8; i++) { this.rect(c, x0 - 1 + i * 6.5, base - 38, 4.5, 2, i % 2 ? '#ffffff' : '#f4c430'); }
      this.rect(c, x0 - 2, base - 47, 52, 1, '#c99a12');
    }
    // cups on counter
    const cups = Math.min(5, Math.floor(state.cupsUnsold));
    for (let i = 0; i < cups; i++) c.drawImage(SPR.cup, x0 + 42 - i * 5, base - 24);
    if (state.cupsUnsold >= 1) this.text(c, fmt(Math.floor(state.cupsUnsold)), x0 + 34, base - 26, 3.5, '#2b1d0e', 'center');
    // pitcher
    this.rect(c, x0 + 17, base - 26, 6, 6, '#fff3a0'); this.rect(c, x0 + 17, base - 26, 6, 1, '#ffffff'); this.rect(c, x0 + 23, base - 25, 1, 3, '#e8e4d0');
    // computer
    if (this.computerVisible()) {
      const cx = 176, cy = 124;
      this.rect(c, cx, cy, 14, 11, '#d8d0b8'); this.rect(c, cx, cy, 14, 1, '#f0ead8');
      const on = state.phase === 'computer';
      this.rect(c, cx + 2, cy + 2, 10, 7, on ? '#10180f' : '#3a3a3a');
      if (on) {
        this.rect(c, cx + 3, cy + 3, 5, 1, '#8fe86a');
        if (Math.floor(this.time * 2) % 2) this.rect(c, cx + 3, cy + 5, 2, 1, '#8fe86a');
        this.rect(c, cx + 3, cy + 7, 7, 1, '#4f8a3a');
      }
      this.rect(c, cx + 5, cy + 11, 4, 1, '#b8b09a');
    }
  },

  drawChalkboard(c) {
    const x = SIGN_X;
    this.rect(c, x - 8, 139, 16, 14, '#8a5a2b');
    this.rect(c, x - 7, 140, 14, 12, '#2e3b2e');
    this.rect(c, x - 7, 153, 2, 5, '#8a5a2b'); this.rect(c, x + 5, 153, 2, 5, '#8a5a2b');
    this.text(c, 'CUP', x, 145, 3, '#e8e4d0', 'center');
    this.text(c, '$' + state.price.toFixed(2), x, 150.5, 3.4, '#fff3a0', 'center');
  },

  drawAutoJuicers(c) {
    const n = Math.min(24, state.juicers);
    for (let i = 0; i < n; i++) {
      const col = i % 6, row = Math.floor(i / 6);
      const x = 106 + col * 10, y = 62 + row * 14;
      this.rect(c, x, y, 8, 10, '#9aa3ad'); this.rect(c, x, y, 8, 1, '#c9d0d8');
      this.rect(c, x + 2, y + 2, 4, 3, '#ffd93b');
      this.rect(c, x + 3, y + 7, 2, 1, (Math.floor(this.time * 4 + i) % 3) ? '#5aa832' : '#1e3a14');
    }
  },

  drawPerson(c, spr, x, y, walkT, walking) {
    const frame = walking ? Math.floor(walkT * 6) % 2 : 0;
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(Math.round(x) - 3, y - 1, 7, 1);
    c.drawImage(spr[frame], Math.round(x) - 4, Math.round(y) - 14);
  },

  drawBubbles(c) {
    const bubble = (x, y, b) => {
      if (!b || b.t <= 0) return;
      const bx = Math.round(x), by = Math.round(y) - 22;
      if (b.cup) { this.rect(c, bx - 4, by - 2, 9, 8, '#ffffff'); c.drawImage(SPR.cup, bx - 2, by); return; }
      if (b.mart) {
        this.rect(c, bx - 5, by - 2, 11, 8, '#ffffff'); this.rect(c, bx - 4, by - 1, 9, 6, '#d0302c');
        this.text(c, 'M', bx + 0.5, by + 4.2, 4.5, '#ffffff', 'center'); return;
      }
      const w = b.text.length * 4 + 4;
      this.rect(c, bx - w / 2, by - 2, w, 8, '#ffffff');
      this.rect(c, bx - 1, by + 6, 2, 1, '#ffffff');
      this.text(c, b.text, bx, by + 4, 3.5, '#2b1d0e', 'center');
    };
    this.customers.forEach(cu => bubble(cu.x, WALK_Y, cu.bubble));
    this.passersby.forEach(p => bubble(p.x, WALK_Y + 2, p.bubble));
  },

  drawMeter(c) {
    const x = JUICER_X - 18, y = 106, w = 36;
    this.rect(c, x - 1, y - 1, w + 2, 7, '#2b1d0e');
    let from = 0;
    JUICE_ZONES.forEach(z => {
      const to = Math.min(1, z.upTo);
      this.rect(c, x + Math.round(from * w), y, Math.round((to - from) * w), 5, z.color);
      from = to;
    });
    const v = this.charge ? this.charge.t / CHARGE_SECS : 0;
    this.rect(c, x + Math.round(v * w) - 1, y - 3, 2, 11, '#ffffff');
    this.rect(c, x + Math.round(v * w) - 1, y - 3, 2, 1, '#2b1d0e');
  },

  drawHint(c) {
    if (state.phase !== 'farm' || this.hintStep > 2) return;
    let tx, ty, label;
    if (this.hintStep === 0) {
      const t = treePos(0); tx = t.x; ty = t.base - 30; label = 'Click to shake!';
    } else if (this.hintStep === 1) {
      const l = state.groundLemons.find(g => !g.claimed && g.fall >= 1);
      if (!l) return;
      tx = l.x; ty = l.y - 8; label = 'Pick up!';
    } else {
      if (state.lemons < 1 && !this.flying.length) return;
      tx = JUICER_X; ty = 102; label = 'Hold!';
    }
    const bob = Math.round(Math.sin(this.time * 6) * 2);
    for (let r = 0; r < 4; r++) this.rect(c, tx - 3 + r, ty - 6 + r + bob, 7 - r * 2, 1, '#ffffff');
    this.rect(c, tx - 1, ty - 10 + bob, 3, 4, '#ffffff');
    this.text(c, label, Math.max(30, Math.min(WORLD_W - 30, tx)), ty - 13 + bob, 4, '#ffffff', 'center');
  },

  /* ============================================================
     HUD (DOM below the canvas)
     ============================================================ */
  buildHud() {
    const up = document.getElementById('farmUpgrades');
    up.innerHTML = '';
    FARM_UPGRADES.forEach(u => {
      const b = document.createElement('button');
      b.className = 'farmBtn hidden';
      b.id = 'fu_' + u.id;
      b.innerHTML = '<span class="fuLabel"></span><span class="fuCost"></span><span class="fuDesc"></span>';
      b.addEventListener('click', () => {
        Sfx.ensure();
        const cost = u.cost(state);
        if (u.maxed(state) || (u.blocked && u.blocked(state)) || state.cash < cost) return;
        state.cash -= cost;
        u.buy(state);
        Sfx.tone(660, 0.06, 'square', 0.04); Sfx.tone(990, 0.1, 'square', 0.04, 0.06);
        this.renderHud(true);
        save();
      });
      up.appendChild(b);
    });
    const step = d => {
      Sfx.ensure();
      state.price = Math.max(0.05, Math.min(5, Math.round((state.price + d) * 100) / 100));
      this.renderHud();
    };
    document.getElementById('priceDown').addEventListener('click', () => step(-0.05));
    document.getElementById('priceUp').addEventListener('click', () => step(0.05));
    document.getElementById('muteBtn').addEventListener('click', () => {
      Sfx.muted = !Sfx.muted;
      try { localStorage.setItem('lemonadeMuted', Sfx.muted ? '1' : '0'); } catch (e) {}
      this.renderHud();
    });
    document.getElementById('btnRunAgainFarm').addEventListener('click', () => resetForNewGame());
    this.hudBuilt = true;
  },

  renderHud() {
    if (!this.hudBuilt) return;
    const s = state;
    const set = (id, v) => { const el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; };
    set('fsCash', '$' + money(s.cash));
    set('fsLemons', fmt(Math.floor(s.lemons)));
    set('fsCups', fmt(Math.floor(s.cupsUnsold)));
    set('fsSold', fmt(Math.floor(s.cupsSold)));
    set('fsRev', '$' + money(s.avgRev || 0) + '/s');
    set('farmPrice', '$' + s.price.toFixed(2));
    set('muteBtn', Sfx.muted ? '🔇' : '🔊');
    const ending = s.phase === 'ending';
    document.getElementById('endingBox').classList.toggle('hidden', !ending);
    document.getElementById('farmUpgrades').classList.toggle('hidden', ending);
    FARM_UPGRADES.forEach(u => {
      const b = document.getElementById('fu_' + u.id);
      const show = u.avail(s) && !u.maxed(s);
      b.classList.toggle('hidden', !show);
      if (!show) return;
      const cost = u.cost(s);
      const blocked = u.blocked && u.blocked(s);
      b.disabled = blocked || s.cash < cost;
      b.classList.toggle('pulse', u.id === 'computer');
      b.querySelector('.fuLabel').textContent = u.label(s);
      b.querySelector('.fuCost').textContent = blocked ? '—' : '$' + money(cost);
      b.querySelector('.fuDesc').textContent = u.desc(s);
    });
  },
};
