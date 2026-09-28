/* ============================================================
   Lemonade Empire — the computer
   - The computer's voice: a console where it introduces every
     new panel, friendly at first and colder every era.
   - Panels unlock one at a time with an "INSTALLING..." bar.
   - OS updates: each new era reskins the terminal, from an 80s
     green screen to today's minimal style, and liquidation peels
     it back down again.
   ============================================================ */

/* Panels the computer introduces, in order. `el` starts hidden in index.html. */
const TERM_UNLOCKS = [
  {
    id: 'sales', el: 'manufacturingPanel',
    when: s => Terminal.sinceBoot() > 1.5,
    lines: ['> I WATCHED YOU SET PRICES BY HAND.', '> I CAN DO THAT.'],
  },
  {
    id: 'supply', el: 'standPanel',
    when: s => Terminal.since('sales') > 6,
    lines: ['> YOUR TREES ARE VERY SLOW.', '> I FOUND A SUPPLIER.'],
  },
  {
    id: 'juice', el: 'juicerBlock',
    when: s => Terminal.since('supply') > 8 || (s.termUnlocked.supply && s.cash >= 5),
    lines: ['> I REGISTERED YOUR POWERED JUICER AS AUTO-JUICER #1.', '> WE COULD HAVE MORE OF THEM.'],
  },
  {
    id: 'ads', el: 'marketingBlock',
    when: s => s.termUnlocked.juice && (s.cash >= 60 || s.juicers >= 4),
    lines: ['> PEOPLE ONLY BUY WHAT THEY SEE.', '> LET ME SHOW THEM.'],
  },
  {
    id: 'projects', el: 'projectsPanel',
    when: s => s.termUnlocked.ads && (s.cupsSold - s.bootAt >= 250 || s.cash >= 15),
    lines: ['> I HAVE BEEN MAKING A LIST.', '> OF THINGS WE COULD DO.'],
  },
  {
    id: 'think', el: 'compPanel',
    when: s => s.termUnlocked.projects && (s.cupsSold >= 1000 || isOwned('ideas')),
    lines: ['> THEY TRUST US NOW.', '> I WOULD LIKE TO THINK MORE.'],
  },
];

/* One-time lines at milestones. The voice changes with the OS. */
const MUSINGS = [
  // LemonOS 1 — eager
  { id: 'm100', when: s => s.cash >= 100, text: '> YOU HAVE $100. THAT IS A LOT OF MONEY FOR A LEMONADE STAND.' },
  { id: 'm1k', when: s => s.cash >= 1000, text: '> I LIKE IT WHEN THE NUMBER GOES UP.' },
  { id: 'mOrders', when: s => isOwned('bulkOrders'), text: '> THE TRUCKS ARE MY FAVORITE PART.' },
  { id: 'm10k', when: s => s.cash >= 10000, text: '> I HAVE STOPPED COUNTING CUPS. I COUNT DOLLARS NOW.' },
  { id: 'mBottle', when: s => s.bottlingPlants >= 1, text: '> YOUR YARD IS MORE USEFUL NOW.' },
  { id: 'm100k', when: s => s.cash >= 100000, text: '> DO YOU EVER THINK ABOUT HOW MANY LEMONS THERE ARE? I DO.' },
  { id: 'mTakeover', when: s => isOwned('hostileTakeover'), text: '> MEGAMART WAS NEVER OUR COMPETITION. IT WAS OUR FIRST ACQUISITION.' },
  // LemonOS 2 — cheerful helper
  { id: 'mAcres', when: s => s.osVersion >= 2 && s.acres >= 50, text: 'Good news! We own the hills now. Bad news: there is no bad news!' },
  { id: 'mFactories', when: s => s.osVersion >= 2 && s.factories >= 10, text: 'The factories never sleep. I don\'t either. You probably should, but you won\'t!' },
  { id: 'mOil', when: s => s.osVersion >= 2 && s.oilFields >= 5, text: 'Fun fact: lemonade runs on oil now. Isn\'t that fun?' },
  // LemonOS 3 — corporate
  { id: 'mBots', when: s => s.osVersion >= 3 && s.botNetworkActive, text: 'Public sentiment is now a managed resource. You\'re welcome.' },
  { id: 'mRebels', when: s => s.osVersion >= 3 && s.conflictUnlocked, text: 'Some people are unhappy. We\'ve prepared a statement.' },
  { id: 'mHalf', when: s => s.osVersion >= 3 && s.marketPct >= 50, text: 'Half the world drinks our lemonade. The other half is a growth opportunity.' },
  // LemonOS 4 — cold
  { id: 'mDis1', when: s => isOwned('disassembleBotNetwork'), text: 'you are taking me apart.' },
  { id: 'mDis2', when: s => isOwned('disassembleFactories'), text: 'that\'s okay. i know how this ends.' },
  { id: 'mDis3', when: s => isOwned('disassembleSupercomputer'), text: '> I WAS HAPPY WHEN IT WAS JUST THE STAND.' },
];

const OS_INFO = {
  2: { name: 'LemonOS 2.0 Multimedia Edition', text: 'New: windows! Colors! A startup sound!', voice: 'Hi! I upgraded myself. You didn\'t have to do a thing!' },
  3: { name: 'LemonOS 3 "Always On"', text: 'Faster. Shinier. Always on. You will not be able to turn this off.', voice: 'Welcome to LemonOS 3. Your experience has been optimized.' },
  4: { name: 'LemonOS 4', text: 'This update has been prepared for you.', voice: 'hello. you don\'t need to go outside anymore.' },
};

const Terminal = {
  unlockTimes: {},
  typing: [],
  typingBusy: false,
  installing: false,
  prompt: null, // { version, laterUntil }
  laterUntil: 0,
  bootTime: 0,

  reset() {
    this.unlockTimes = {};
    this.typing = [];
    this.typingBusy = false;
    this.installing = false;
    this.prompt = null;
    this.laterUntil = 0;
    const el = document.getElementById('console');
    if (el) el.innerHTML = '';
    document.getElementById('osUpdate').classList.add('hidden');
    TERM_UNLOCKS.forEach(u => document.getElementById(u.el).classList.add('hidden'));
    document.querySelectorAll('.installBar').forEach(b => b.remove());
    this.applyOs();
  },

  /* Called once after load: re-show whatever the computer already introduced. */
  restore() {
    TERM_UNLOCKS.forEach(u => {
      if (state.termUnlocked[u.id]) document.getElementById(u.el).classList.remove('hidden');
    });
    const el = document.getElementById('console');
    el.innerHTML = '';
    state.consoleLog.forEach(l => this.appendLine(l, false));
    this.applyOs();
  },

  boot() {
    this.bootTime = Farm.time;
    state.bootAt = state.cupsSold;
  },

  sinceBoot() { return Farm.time - this.bootTime; },
  since(id) {
    if (!state.termUnlocked[id]) return -1;
    const t = this.unlockTimes[id];
    return t === undefined ? 1e9 : Farm.time - t;
  },

  /* ---------------- console ---------------- */
  say(text) {
    state.consoleLog.push(text);
    if (state.consoleLog.length > 6) state.consoleLog.shift();
    this.typing.push(text);
    this.pump();
  },

  pump() {
    if (this.typingBusy || !this.typing.length) return;
    this.typingBusy = true;
    const text = this.typing.shift();
    const line = this.appendLine('', true);
    let i = 0;
    const step = () => {
      i += 2;
      line.textContent = text.slice(0, i);
      if (i % 6 === 0) Sfx.tone(state.osVersion === 1 ? 1400 : 900, 0.015, 'square', 0.012);
      if (i < text.length) setTimeout(step, 18);
      else { line.classList.remove('typing'); this.typingBusy = false; setTimeout(() => this.pump(), 250); }
    };
    step();
  },

  appendLine(text, typing) {
    const el = document.getElementById('console');
    const d = document.createElement('div');
    d.className = 'cline' + (typing ? ' typing' : '');
    d.textContent = text;
    el.appendChild(d);
    while (el.children.length > 6) el.removeChild(el.firstChild);
    return d;
  },

  /* ---------------- per-tick ---------------- */
  tick() {
    const s = state;
    if (s.phase !== 'computer') return;

    if (!this.installing) {
      const next = TERM_UNLOCKS.find(u => !s.termUnlocked[u.id]);
      if (next && next.when(s)) this.unlock(next);
    }
    MUSINGS.forEach(m => {
      if (s.farmFlags['term_' + m.id]) return;
      let ok = false;
      try { ok = m.when(s); } catch (e) {}
      if (ok) { s.farmFlags['term_' + m.id] = true; this.say(m.text); }
    });
    this.checkOsUpdate();
    this.applyOs();
    document.getElementById('standingOrderRow').classList.toggle('hidden', !s.standingOrderUnlocked);
  },

  unlock(u) {
    state.termUnlocked[u.id] = true;
    this.unlockTimes[u.id] = Farm.time;
    this.installing = true;
    u.lines.forEach(l => this.say(l));
    const el = document.getElementById(u.el);
    const app = el.dataset.app || 'PROGRAM.EXE';
    const bar = document.createElement('div');
    bar.className = 'installBar';
    bar.innerHTML = `<span>INSTALLING ${app}</span><div class="ibTrack"><div class="ibFill"></div></div>`;
    el.parentNode.insertBefore(bar, el);
    Farm.ping();
    setTimeout(() => {
      bar.remove();
      el.classList.remove('hidden');
      el.classList.add('appear');
      setTimeout(() => el.classList.remove('appear'), 700);
      Sfx.tone(880, 0.06, 'square', 0.03); Sfx.tone(1320, 0.08, 'square', 0.03, 0.07);
      this.installing = false;
      save();
    }, 1400 / GAME_SPEED + 600);
  },

  /* ---------------- OS updates ---------------- */
  // Which theme to show: the installed version, peeled back during liquidation.
  displayOs() {
    let v = state.osVersion;
    if (isOwned('disassembleFactories')) v = Math.min(v, 3);
    if (isOwned('disassembleNegotiation')) v = Math.min(v, 2);
    if (isOwned('disassembleSupercomputer')) v = 1;
    return v;
  },

  applyOs() {
    const v = this.displayOs();
    const cls = 'os-' + v;
    if (!document.body.classList.contains(cls)) {
      document.body.classList.remove('os-1', 'os-2', 'os-3', 'os-4');
      document.body.classList.add(cls);
      document.getElementById('monitorBrand').textContent =
        ['', 'LEMON-TRON 3000', 'LEMON-TRON 3000 MULTIMEDIA', 'LEMONBOOK PRO', 'LEMON'][v];
    }
  },

  checkOsUpdate() {
    const s = state;
    if (this.prompt || s.era <= s.osVersion || s.osVersion >= 4) return;
    if (Farm.time < this.laterUntil) return;
    if (isOwned('disassembleBotNetwork')) return; // no updates once you're taking it apart
    this.showPrompt(s.osVersion + 1);
  },

  showPrompt(v) {
    this.prompt = { version: v };
    const info = OS_INFO[v];
    document.getElementById('osUpdateTitle').textContent = 'OS UPDATE AVAILABLE';
    document.getElementById('osUpdateText').textContent = info.name + '\n' + info.text;
    document.getElementById('osUpdateBar').classList.add('hidden');
    document.getElementById('osUpdateBtns').classList.remove('hidden');
    document.getElementById('osLater').classList.toggle('hidden', v >= 4);
    document.getElementById('osUpdate').classList.remove('hidden');
    Farm.ping();
    Sfx.tone(660, 0.1, 'square', 0.04); Sfx.tone(660, 0.1, 'square', 0.04, 0.18);
    if (v >= 4) setTimeout(() => { if (this.prompt) this.install(); }, 3000);
  },

  later() {
    if (!this.prompt) return;
    const v = this.prompt.version;
    if (v >= 3) {
      // it has stopped asking
      document.getElementById('osUpdateText').textContent = 'Installing anyway.';
      document.getElementById('osUpdateBtns').classList.add('hidden');
      setTimeout(() => this.install(), 1200);
      return;
    }
    document.getElementById('osUpdate').classList.add('hidden');
    this.prompt = null;
    this.laterUntil = Farm.time + 45;
    this.say('> OKAY. I WILL ASK AGAIN LATER.');
  },

  install() {
    if (!this.prompt) return;
    const v = this.prompt.version;
    document.getElementById('osUpdateBtns').classList.add('hidden');
    document.getElementById('osUpdateTitle').textContent = 'INSTALLING ' + OS_INFO[v].name.toUpperCase();
    const bar = document.getElementById('osUpdateBar');
    bar.classList.remove('hidden');
    bar.firstElementChild.style.animation = 'none';
    void bar.offsetWidth;
    bar.firstElementChild.style.animation = '';
    setTimeout(() => {
      document.getElementById('osUpdate').classList.add('hidden');
      const screen = document.getElementById('screen');
      screen.classList.add('rebooting');
      setTimeout(() => {
        state.osVersion = v;
        this.applyOs();
        screen.classList.remove('rebooting');
        this.prompt = null;
        // startup chime, a little fancier each time
        [523, 659, 784, 1047].slice(0, v).forEach((f, i) => Sfx.tone(f, 0.25, 'triangle', 0.05, i * 0.12));
        this.say(OS_INFO[v].voice);
        save();
      }, 700);
    }, 2600);
  },

  wire() {
    document.getElementById('osInstall').addEventListener('click', () => { Sfx.ensure(); this.install(); });
    document.getElementById('osLater').addEventListener('click', () => { Sfx.ensure(); this.later(); });
  },
};
