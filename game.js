/* ============================================================
   Lemonade Empire — engine
   ============================================================ */

const $ = id => document.getElementById(id);

const BUILD_DEFS = {
  juicer:     { countField: 'juicers',     base: 5,      growth: 1.10, currency: 'cash', displayId: 'juicerCost' },
  bottling:   { countField: 'bottlingPlants', base: 250000, growth: 1.15, currency: 'cash', displayId: 'bottlingCost' },
  acres:      { countField: 'acres',       base: 10000,  growth: 1.12, currency: 'cash', displayId: 'acresCost' },
  refining:   { countField: 'refining',    base: 10000,  growth: 1.12, currency: 'cash', displayId: 'refiningCost' },
  factory:    { countField: 'factories',   base: 5000,   growth: 1.15, currency: 'cups', displayId: 'factoryCost' },
  oilField:   { countField: 'oilFields',   base: 5000,   growth: 1.15, currency: 'cups', displayId: 'oilFieldCost' },
  oilReserve: { countField: 'oilReserves', base: 5000,   growth: 1.15, currency: 'cups', displayId: 'oilReserveCost' },
  division:   { countField: 'divisions',   base: 100000, growth: 1.20, currency: 'cups', displayId: 'divisionCost' },
};

const TACTIC_BONUS = {
  RANDOM: 1, A100: 1.05, B100: 1.1, GREEDY: 0.9, GENEROUS: 1.15,
  MINIMAX: 1.05, 'TIT FOR TAT': 1.25, 'BEAT LAST': 1.1
};

const SAVE_KEY = 'lemonadeEmpireSave_v2';
const TICK_MS = 100;
// ?speed=N in the URL fast-forwards everything (handy for testing)
const GAME_SPEED = Math.max(1, Number(new URLSearchParams(location.search).get('speed')) || 1);
let slowTickCounter = 0;

/* ---------------- currency helpers ---------------- */
function currencyField(name) {
  if (name === 'cups') return 'cupsSold';
  if (name === 'trust') return 'trust';
  if (name === 'ideas') return 'ideas';
  if (name === 'honor') return 'honor';
  if (name === 'army') return 'armyDiscipline';
  return 'cash';
}

function currentBuildingCost(key) {
  const d = BUILD_DEFS[key];
  let cost = d.base * Math.pow(d.growth, state[d.countField]);
  cost *= state.buildCostMult;
  return cost;
}

function buyBuilding(key) {
  const d = BUILD_DEFS[key];
  const cost = currentBuildingCost(key);
  const field = currencyField(d.currency);
  if (state[field] < cost) return false;
  state[field] -= cost;
  state[d.countField] += 1;
  return true;
}

/* ---------------- narrative overlay ---------------- */
let narrativeQueue = [];
let narrativeDone = null;

function showNarrativeQueue(lines, onDone) {
  narrativeQueue = lines.slice();
  narrativeDone = onDone || null;
  $('narrativeOverlay').classList.remove('hidden');
  advanceNarrative();
}

function advanceNarrative() {
  if (narrativeQueue.length === 0) {
    $('narrativeOverlay').classList.add('hidden');
    if (narrativeDone) { const fn = narrativeDone; narrativeDone = null; fn(); }
    return;
  }
  $('narrativeText').textContent = narrativeQueue.shift();
}

/* ---------------- projects ---------------- */
function projectCurrentCost(p) {
  return p.cost;
}

function canAffordProject(p) {
  const field = currencyField(p.costRes);
  return p.costRes === 'none' || state[field] >= p.cost;
}

function projectVisible(p) {
  if (isOwned(p.id)) return false;
  if (p.exclusiveWith && isOwned(p.exclusiveWith)) return false;
  if (p.era > state.era) return false;
  try { return !!p.requires(state); } catch (e) { return false; }
}

function purchaseProject(p) {
  if (!projectVisible(p) || !canAffordProject(p)) return;
  if (p.costRes !== 'none') {
    const field = currencyField(p.costRes);
    state[field] -= p.cost;
  }
  const finish = () => {
    p.effect(state);
    own(p.id);
    slowRender();
    fastRender();
    save();
  };
  if (p.narrative && p.narrative.length) {
    showNarrativeQueue(p.narrative, finish);
  } else {
    finish();
  }
}

let lastVisibleProjectIds = [];

function renderProjectList(force) {
  const container = $('projectList');
  const visible = PROJECTS.filter(projectVisible);
  const ids = visible.map(p => p.id);
  const sameSet = !force && ids.length === lastVisibleProjectIds.length &&
    ids.every((id, i) => id === lastVisibleProjectIds[i]);

  if (sameSet) {
    // nothing entered/left the list — just refresh affordability, no DOM rebuild
    const buttons = container.querySelectorAll('.project button');
    visible.forEach((p, i) => { if (buttons[i]) buttons[i].disabled = !canAffordProject(p); });
    return;
  }

  lastVisibleProjectIds = ids;
  container.innerHTML = '';
  if (visible.length === 0) {
    container.innerHTML = '<p class="cost">Nothing new to fund right now.</p>';
    return;
  }
  visible.forEach(p => {
    const div = document.createElement('div');
    div.className = 'project';
    const affordable = canAffordProject(p);
    const costLabel = p.costRes === 'none' ? 'Free' :
      `${fmt(p.cost)} ${({cash:'$', cups:'cups', trust:'trust', ideas:'ideas', honor:'honor', army:'army disc.'})[p.costRes]}`;
    div.innerHTML = `
      <button class="button2" ${affordable ? '' : 'disabled'}>${p.title}</button>
      <span class="pCost">${costLabel}</span>
      <span class="pFlavor">${p.flavor}</span>
    `;
    div.querySelector('button').addEventListener('click', () => purchaseProject(p));
    container.appendChild(div);
  });
}

/* ---------------- trust ---------------- */
function checkTrustMilestone() {
  if (state.cupsSold >= state.nextTrustAt) {
    state.trust += 1;
    state.trustMilestoneIndex += 1;
    state.nextTrustAt = Math.round(1000 * Math.pow(1.55, state.trustMilestoneIndex));
  }
}

/* ---------------- negotiation ---------------- */
function runNegotiation() {
  if (!state.negotiationUnlocked) return;
  const cost = 5000 * Math.pow(1.05, state.negotiationRounds);
  if (state.cash < cost) return;
  state.cash -= cost;
  state.negotiationRounds += 1;
  const bonus = TACTIC_BONUS[state.selectedTactic] || 1;
  const gain = Math.round(20 * state.armyGainMult * bonus * (1 + state.trust * 0.05));
  state.armyDiscipline += gain;
  logLine('negotiation', `Round ${state.negotiationRounds} (${state.selectedTactic}): +${fmt(gain)} army discipline`);
  fastRender();
}

function logLine(kind, text) {
  state.logs[kind].unshift(text);
  if (state.logs[kind].length > 20) state.logs[kind].length = 20;
  const el = $(kind === 'negotiation' ? 'negotiationLog' : 'battleLog');
  if (el) el.innerHTML = state.logs[kind].map(l => `<div>${l}</div>`).join('');
}

/* ---------------- combat ---------------- */
function engageRebellion() {
  if (!state.conflictUnlocked || state.rebellionEnding) return;
  state.battlesTotal += 1;
  const strength = state.armyDiscipline * 0.1 + state.divisions * 0.05 +
    (state.botNetworkActive ? state.botInfluence * 0.2 : 0);
  const rebellionStrength = 10 + state.battlesTotal * 3;
  const win = strength >= rebellionStrength * (0.5 + Math.random() * 0.5);
  const name = state.namedBattles ? randomBattleName(state.battlesTotal) : `Skirmish ${state.battlesTotal}`;
  if (win) {
    state.battlesWon += 1;
    const honorGain = Math.round(50 * state.honorGainMult * (1 + state.battlesTotal * 0.1));
    state.honor += honorGain;
    state.marketPct = Math.min(100, state.marketPct + 0.5);
    logLine('battle', `${name}: VICTORY (+${fmt(honorGain)} honor)`);
  } else {
    state.armyDiscipline = Math.max(0, state.armyDiscipline - 50);
    logLine('battle', `${name}: setback (&minus;50 army discipline)`);
  }
  fastRender();
  slowRender();
}

/* ---------------- bot network ---------------- */
function botCost(base, level) { return Math.round(base * Math.pow(1.4, level)); }

function botFeed() {
  const cost = botCost(1000, state.botCapacity / 500);
  if (state.cash < cost) return;
  state.cash -= cost;
  state.botCapacity += 500 * state.botCapMult;
  fastRender();
}
function botTeach() {
  const cost = botCost(200, state.botTrainedLevel);
  if (state.ideas < cost) return;
  state.ideas -= cost;
  state.botTrainedLevel += 1;
  fastRender();
}
function botEntertain() {
  const cost = botCost(150, state.botContentLevel);
  if (state.ideas < cost) return;
  state.ideas -= cost;
  state.botContentLevel += 1;
  fastRender();
}
function botBrand() {
  const cost = botCost(5000, state.botBrandLevel);
  if (state.cash < cost) return;
  state.cash -= cost;
  state.botBrandLevel += 1;
  fastRender();
}
function botSync() {
  const cost = botCost(300, state.botSyncLevel);
  if (state.armyDiscipline < cost) return;
  state.armyDiscipline -= cost;
  state.botSyncLevel += 1;
  fastRender();
}

/* ---------------- investment ---------------- */
function invest() {
  if (state.cash < 1000) return;
  state.cash -= 1000;
  state.investCash += 1000;
  state.investStocks += 1000;
  fastRender();
}
function withdraw() {
  state.cash += state.investStocks;
  state.investCash = 0;
  state.investStocks = 0;
  fastRender();
}

/* ---------------- tick ---------------- */
/* Public demand. The exponent (>1) makes demand elastic: past a point,
   raising the price loses more customers than it earns, so there's a real
   sweet spot instead of "always max the price". */
function updateDemand() {
  const demandRaw = 100 * state.marketingLevel * state.marketingEffMult * state.demandMult /
    Math.pow(1 + (state.price * 20) / state.priceToleranceMult, 1.5);
  state.demand = Math.max(1, Math.min(100, demandRaw));
  const traffic = state.phase === 'computer' ? 50 : FARM_TRAFFIC;
  state.customerRate = state.marketingLevel * 2 * (state.demand / 100) * traffic * state.salesRateMult;
}

function renderCadence() {
  fastRender();
  slowTickCounter += 1;
  if (slowTickCounter >= 5) { // ~every 500ms
    slowTickCounter = 0;
    slowRender();
  }
}

function tick() {
  const dt = TICK_MS / 1000 * GAME_SPEED;
  updateDemand();

  // By hand (farm / ending): customers in the pixel world do the buying.
  if (state.phase !== 'computer') {
    state.lastProduced = 0;
    renderCadence();
    return;
  }

  // --- production ---
  const juicerRate = 1 * state.juicerRateMult;
  const bottlingRate = 5 * state.bottlingRateMult;
  let capacity = state.juicers * juicerRate;
  if (state.bottlingUnlocked) capacity += state.bottlingPlants * bottlingRate;
  if (state.era >= 2) {
    const factoryRate = 10 * state.factoryRateMult;
    capacity += state.factories * factoryRate * (state.performance / 100);
  }

  const lemonsNeeded = (capacity * dt) / state.lemonYieldMult;
  let produced;
  if (lemonsNeeded <= state.lemons) {
    produced = capacity * dt;
    state.lemons -= lemonsNeeded;
  } else {
    produced = state.lemons * state.lemonYieldMult;
    state.lemons = 0;
  }
  state.cupsMade += produced;
  state.cupsUnsold += produced;
  state.lastProduced = produced / dt;

  // --- standing lemon order ---
  if (state.standingOrder && state.standingOrderUnlocked) {
    const cost = state.lemonCost * state.lemonCostMult;
    if (state.cash >= cost && state.lemons < state.lemonBatch * 2) {
      state.cash -= cost;
      state.lemons += state.lemonBatch;
    }
  }

  // --- acres + refining feed the lemon pool (era 2+) ---
  if (state.era >= 2) {
    const acreOutput = state.acres * 2 * state.acreRateMult;
    const refiningCap = state.refining * 2 * state.refiningRateMult;
    state.lemons += Math.min(acreOutput, refiningCap) * dt;

    // --- oil / power throttling ---
    const oilProd = state.oilFields * 5;
    const maxOil = 1000 + state.oilReserves * 2000;
    state.storedOil = Math.min(maxOil, state.storedOil + oilProd * dt);
    const oilNeeded = state.factories * 2 * dt;
    if (state.storedOil >= oilNeeded) {
      state.storedOil -= oilNeeded;
      state.performance = 100;
    } else {
      state.performance = state.storedOil > 0 ? 50 : (state.factories > 0 ? 10 : 100);
      state.storedOil = 0;
    }
  }

  // --- sales ---
  const maxSaleRate = state.customerRate * competitionShare();
  const sold = Math.min(state.cupsUnsold, maxSaleRate * dt);
  state.cupsUnsold -= sold;
  state.cupsSold += sold;
  state.cash += sold * state.price;
  state.avgRev = sold * state.price / dt;
  state.lastSold = sold / dt;

  checkTrustMilestone();

  // --- supercomputer ---
  if (isOwned('ideas')) {
    const opsRate = (1 + state.computeUnits) * state.computeMult * 5;
    state.maxOps = 1000 * Math.pow(1.6, state.memoryUnits);
    state.operations += opsRate * dt;
    if (state.operations >= state.maxOps) {
      state.operations = 0;
      state.ideas += Math.round((1 + state.memoryUnits) * state.computeMult * state.ideaGainMult * 5);
    }
  }

  // --- bot network ---
  if (state.botNetworkUnlocked && state.botCount < state.botCapacity) {
    state.botCount += Math.min(state.botCapacity - state.botCount, state.botCapacity * 0.05 * dt);
  }
  if (state.botNetworkActive) {
    state.botInfluence = Math.min(100,
      (state.botCount / 1000) *
      (1 + state.botTrainedLevel * 0.1) *
      (1 + state.botContentLevel * 0.1) *
      (1 + state.botSyncLevel * 0.1) *
      state.botInfluenceMult);
  }

  // --- auto negotiate ---
  if (state.autoNegotiate) {
    state.autoNegotiateTimer += dt;
    if (state.autoNegotiateTimer >= 3) {
      state.autoNegotiateTimer = 0;
      runNegotiation();
    }
  }

  // --- division / market growth (era 3+) ---
  if (state.era >= 3 && !state.rebellionEnding) {
    const growth = state.divisions * 0.01 * state.divisionGrowthMult * state.marketGainMult;
    state.marketPct = Math.min(100, state.marketPct + growth * dt);
  }

  // --- stock market ---
  if (state.investStocks > 0) {
    state.stockIndex *= 1 + (Math.random() - 0.499) * 0.003;
    state.investStocks *= 1 + (Math.random() - 0.499) * 0.003;
  }

  state.globalInfluence = Math.round(state.trust * 100 + state.marketPct * 1000 + state.honor * 2);

  renderCadence();
}

/* ---------------- rendering ---------------- */
function setVisible(id, visible) {
  const el = $(id);
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

function fastRender() {
  $('cupsSold').textContent = fmt(Math.floor(state.cupsSold));
  $('cupsPerSecond').textContent = fmt(state.lastProduced || 0);
  $('cupsUnsold').textContent = fmt(Math.floor(state.cupsUnsold));
  $('eraName').textContent = ['', 'The Stand', 'The Takeover', 'Global Conflict', 'Endgame'][state.era];

  $('lemons').textContent = fmt(state.lemons);
  $('lemonCost').textContent = fmt(state.lemonCost * state.lemonCostMult);
  $('lemonBatch').textContent = fmt(state.lemonBatch);

  $('juicerLevel').textContent = fmt(state.juicers);
  $('juicerCost').textContent = fmt(currentBuildingCost('juicer'));
  $('juicerRateDisplay').textContent = fmt(1 * state.juicerRateMult);

  setVisible('bottlingBlock', state.bottlingUnlocked);
  if (state.bottlingUnlocked) {
    $('bottlingLevel').textContent = fmt(state.bottlingPlants);
    $('bottlingCost').textContent = fmt(currentBuildingCost('bottling'));
    $('bottlingRateDisplay').textContent = fmt(5 * state.bottlingRateMult);
  }

  $('price').textContent = state.price.toFixed(2);
  const slider = $('priceSlider');
  if (document.activeElement !== slider) slider.value = Math.round(state.price * 100);
  $('demand').textContent = state.demand.toFixed(1);
  $('marketingLvl').textContent = fmt(state.marketingLevel);
  $('adCost').textContent = fmt(state.adCost);
  $('funds').textContent = fmt(state.cash);
  $('avgRev').textContent = fmt(state.avgRev);

  setVisible('empirePanel', state.era >= 2);
  setVisible('powerPanel', state.era >= 2);
  if (state.era >= 2) {
    $('objectiveLabel').textContent = 'Global Influence';
    $('globalInfluence').textContent = fmt(state.globalInfluence);
    $('acresLevel').textContent = fmt(state.acres);
    $('acresOwned').textContent = fmt(state.acres);
    $('acresCost').textContent = fmt(currentBuildingCost('acres'));
    $('acresRate').textContent = fmt(2 * state.acreRateMult * state.acres);
    $('refiningLevel').textContent = fmt(state.refining);
    $('refiningCost').textContent = fmt(currentBuildingCost('refining'));
    $('refiningRate').textContent = fmt(2 * state.refiningRateMult * state.refining);
    $('factoryLevel').textContent = fmt(state.factories);
    $('factoryCost').textContent = fmt(currentBuildingCost('factory'));
    $('factoryRate').textContent = fmt(10 * state.factoryRateMult * state.factories);

    $('performance').textContent = Math.round(state.performance);
    $('oilProdRate').textContent = fmt(state.oilFields * 5);
    $('oilConsRate').textContent = fmt(state.factories * 2);
    $('oilFieldLevel').textContent = fmt(state.oilFields);
    $('oilFieldCost').textContent = fmt(currentBuildingCost('oilField'));
    $('storedOil').textContent = fmt(state.storedOil);
    $('maxOil').textContent = fmt(1000 + state.oilReserves * 2000);
    $('oilReserveLevel').textContent = fmt(state.oilReserves);
    $('oilReserveCost').textContent = fmt(currentBuildingCost('oilReserve'));
  }

  $('trust').textContent = fmt(state.trust);
  $('nextTrust').textContent = fmt(state.nextTrustAt);
  $('computeUnits').textContent = fmt(state.computeUnits);
  $('memoryUnits').textContent = fmt(state.memoryUnits);
  $('operations').textContent = fmt(state.operations);
  $('maxOps').textContent = fmt(state.maxOps || 1000);
  $('ideas').textContent = fmt(state.ideas);

  setVisible('botNetworkPanel', state.botNetworkUnlocked);
  if (state.botNetworkUnlocked) {
    $('botCount').textContent = fmt(state.botCount);
    $('botInfluence').textContent = state.botInfluence.toFixed(1);
    $('botFeedCost').textContent = fmt(botCost(1000, state.botCapacity / 500));
    $('botTeachCost').textContent = fmt(botCost(200, state.botTrainedLevel));
    $('botEntertainCost').textContent = fmt(botCost(150, state.botContentLevel));
    $('botBrandCost').textContent = fmt(botCost(5000, state.botBrandLevel));
    $('botSyncCost').textContent = fmt(botCost(300, state.botSyncLevel));
  }

  setVisible('investmentPanel', isOwned('algorithmicTrading'));
  if (isOwned('algorithmicTrading')) {
    $('investCash').textContent = fmt(state.investCash);
    $('investStocks').textContent = fmt(state.investStocks);
  }

  setVisible('negotiationPanel', state.negotiationUnlocked);
  if (state.negotiationUnlocked) {
    $('armyDiscipline').textContent = fmt(state.armyDiscipline);
    $('negotiationCost').textContent = fmt(5000 * Math.pow(1.05, state.negotiationRounds));
  }

  setVisible('divisionPanel', state.divisionUnlocked);
  if (state.divisionUnlocked) {
    $('marketPct').textContent = state.marketPct.toFixed(3);
    $('divisionLevel').textContent = fmt(state.divisions);
    $('divisionCost').textContent = fmt(currentBuildingCost('division'));
  }

  setVisible('conflictPanel', state.conflictUnlocked);
  if (state.conflictUnlocked) {
    $('honor').textContent = fmt(state.honor);
  }

  setVisible('endgamePanel', state.era >= 4 || !!state.rebellionEnding);
  Farm.renderHud();
}

function slowRender() {
  renderProjectList();
  renderEndgamePanel();
  // tactic select options
  const sel = $('tacticSelect');
  if (sel) {
    const existing = Array.from(sel.options).map(o => o.value);
    state.tactics.forEach(t => {
      if (!existing.includes(t)) {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        sel.appendChild(opt);
      }
    });
    sel.value = state.selectedTactic;
  }
}

function renderEndgamePanel() {
  const el = $('endgameContent');
  if (!el) return;
  if (state.rebellionEnding === 'accept') {
    el.innerHTML = `
      <p>You put the folding table back out. It has a wobble you never bothered to fix.</p>
      <p>Somewhere, a company that used to be yours keeps running without you. It doesn't slow down.</p>
      <p>Simulations run: ${fmt(state.simulationsRun)}</p>
      <button class="button2" id="btnRunAgain">Run the Simulation Again</button>
    `;
    $('btnRunAgain').addEventListener('click', resetForNewGame);
  } else if (state.era >= 4) {
    const chain = ['disassembleBotNetwork','disassembleDivisions','disassembleFactories','disassembleNegotiation','disassembleSupercomputer','serverDecommission','marketNextDoor','marketWithin','temporalRecalc'];
    const nextStep = chain.find(id => !isOwned(id));
    if (nextStep) {
      el.innerHTML = `<p>Liquidation in progress. Find and fund the next step in the Projects list.</p>`;
    } else {
      el.innerHTML = `
        <p>It was a simulation. All of it.</p>
        <p>Simulations run: ${fmt(state.simulationsRun)}</p>
        <button class="button2" id="btnRunAgain">Run the Simulation Again</button>
      `;
      $('btnRunAgain').addEventListener('click', resetForNewGame);
    }
  } else {
    el.innerHTML = '';
  }
}

/* ---------------- save / load ---------------- */
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    state = Object.assign(freshState(), parsed);
    state.owned = Object.assign({}, parsed.owned || {});
    state.tactics = parsed.tactics && parsed.tactics.length ? parsed.tactics : ['RANDOM'];
    state.logs = parsed.logs || { negotiation: [], battle: [] };
    state.trees = parsed.trees && parsed.trees.length ? parsed.trees : freshState().trees;
    state.groundLemons = (parsed.groundLemons || []).map(l => ({ x: l.x, y: l.y, fall: 1, fromY: l.y }));
    state.farmFlags = parsed.farmFlags || {};
    return true;
  } catch (e) { return false; }
}

function resetForNewGame() {
  const carry = state.simulationsRun + 1;
  state = freshState();
  state.simulationsRun = carry;
  lastVisibleProjectIds = [];
  Farm.reset();
  Farm.syncPhase(true);
  save();
  slowRender();
  fastRender();
}

/* ---------------- wiring ---------------- */
function wireEvents() {
  $('btnBuyLemons').addEventListener('click', () => {
    const cost = state.lemonCost * state.lemonCostMult;
    if (state.cash >= cost) { state.cash -= cost; state.lemons += state.lemonBatch; fastRender(); }
  });
  $('chkStandingOrder').addEventListener('change', e => { state.standingOrder = e.target.checked; });

  $('btnBuyJuicer').addEventListener('click', () => { buyBuilding('juicer'); fastRender(); });
  $('btnBuyBottling').addEventListener('click', () => { buyBuilding('bottling'); fastRender(); });

  $('priceSlider').addEventListener('input', e => { state.price = Number(e.target.value) / 100; fastRender(); });
  $('btnBuyAds').addEventListener('click', () => {
    if (state.cash >= state.adCost) {
      state.cash -= state.adCost;
      state.marketingLevel += 1;
      state.adCost = Math.round(state.adCost * 2);
      fastRender();
    }
  });

  $('btnBuyAcres').addEventListener('click', () => { buyBuilding('acres'); fastRender(); });
  $('btnBuyRefining').addEventListener('click', () => { buyBuilding('refining'); fastRender(); });
  $('btnBuyFactory').addEventListener('click', () => { buyBuilding('factory'); fastRender(); });
  $('btnBuyOilField').addEventListener('click', () => { buyBuilding('oilField'); fastRender(); });
  $('btnBuyOilReserve').addEventListener('click', () => { buyBuilding('oilReserve'); fastRender(); });

  $('btnAddCompute').addEventListener('click', () => {
    if (!isOwned('ideas')) return;
    if (state.trust >= 1) { state.trust -= 1; state.computeUnits += 1; fastRender(); }
  });
  $('btnAddMemory').addEventListener('click', () => {
    if (!isOwned('ideas')) return;
    if (state.trust >= 1) { state.trust -= 1; state.memoryUnits += 1; fastRender(); }
  });

  $('btnInvest').addEventListener('click', invest);
  $('btnWithdraw').addEventListener('click', withdraw);

  $('tacticSelect').addEventListener('change', e => { state.selectedTactic = e.target.value; });
  $('btnRunNegotiation').addEventListener('click', runNegotiation);

  $('btnLaunchDivision').addEventListener('click', () => { buyBuilding('division'); fastRender(); });

  $('btnEngage').addEventListener('click', engageRebellion);

  $('btnBotFeed').addEventListener('click', botFeed);
  $('btnBotTeach').addEventListener('click', botTeach);
  $('btnBotEntertain').addEventListener('click', botEntertain);
  $('btnBotBrand').addEventListener('click', botBrand);
  $('btnBotSync').addEventListener('click', botSync);

  $('narrativeNext').addEventListener('click', advanceNarrative);
}

/* ---------------- boot ---------------- */
function startGame() {
  $('creditScreen').style.display = 'none';
  $('app').style.display = '';

  const loaded = load();
  if (!loaded) state = freshState();

  Farm.init();
  wireEvents();
  slowRender();
  fastRender();

  setInterval(tick, TICK_MS);
  setInterval(save, 5000);
  window.addEventListener('beforeunload', save);
}

document.addEventListener('DOMContentLoaded', () => {
  $('startGameBtn').addEventListener('click', startGame);
});
