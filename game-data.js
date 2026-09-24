/* ============================================================
   Lemonade Empire — game data
   A re-skin of Universal Paperclips (Frank Lantz, 2017).
   This file defines the shared state object and the full list
   of one-time "Projects" (upgrades). The engine in game.js
   consumes this data generically: every project has a cost,
   a resource it's paid in, a requirement, optional narrative
   text shown before it resolves, and an effect function.
   ============================================================ */

let state = {};

function freshState() {
  return {
    // meta
    era: 1, // 1 Stand, 2 Takeover, 3 Conflict, 4 Endgame
    phase: 'farm', // 'farm' (pixel stand) | 'computer' (terminal) | 'ending' (walked away)
    owned: {}, // projectId -> true

    // the pixel stand (farm phase)
    trees: [{ lemons: 5, regrow: 0 }],
    lots: 1, // each lot holds 3 trees
    groundLemons: [], // {x, y, fall, fromY}
    juicerLevel: 0, // hand juicer: squeezes 1 + level lemons per press
    helperLevel: 0,
    signLevel: 0,
    megamartStage: 0, // 0 none, 1 coming soon, 2 construction, 3 open
    computerOwned: false,
    farmFlags: {}, // one-time status messages already shown
    customerRate: 0, // customers/sec the public wants at the current price

    // core stand economy
    cash: 0,
    lemons: 0,
    lemonBatch: 100,
    lemonCost: 5,
    lemonCostMult: 1,
    lemonYieldMult: 1, // cups produced per lemon consumed
    standingOrder: false,
    standingOrderUnlocked: false,

    juicers: 0,
    juicerCost: 5,
    juicerRateMult: 1, // multiplier on base 1 cup/sec per juicer

    bottlingUnlocked: false,
    bottlingPlants: 0,
    bottlingCost: 250000,
    bottlingRateMult: 1,

    price: 0.25,
    marketingLevel: 1,
    adCost: 100,
    marketingEffMult: 1,
    priceToleranceMult: 1,
    demandMult: 1,
    demand: 10,
    salesRateMult: 1,

    cupsMade: 0,
    cupsSold: 0,
    cupsUnsold: 0,
    avgRev: 0,

    // trust / supercomputer
    trust: 2,
    trustMilestoneIndex: 0,
    nextTrustAt: 1000,
    performance: 100,
    computeUnits: 0,
    memoryUnits: 0,
    computeMult: 1,
    operations: 0,
    ideas: 0,
    ideaGainMult: 1,

    // era 2 empire
    acres: 0,
    acresCost: 10000,
    acreRateMult: 1,
    refining: 0,
    refiningCost: 10000,
    refiningRateMult: 1,
    factories: 0,
    factoryCost: 5000, // paid in cups
    factoryRateMult: 1,
    buildCostMult: 1, // shared discount from "math problem" projects

    oilFields: 0,
    oilFieldCost: 5000, // paid in cups
    oilReserves: 0,
    oilReserveCost: 5000, // paid in cups
    storedOil: 0,

    // bot network
    botNetworkUnlocked: false,
    botNetworkActive: false,
    botCount: 0,
    botCapMult: 1,
    botCapacity: 0,
    botTrainedLevel: 0,
    botContentLevel: 0,
    botBrandLevel: 0,
    botSyncLevel: 0,
    botInfluence: 0,
    botInfluenceMult: 1,

    // investment
    investCash: 0,
    investStocks: 0,

    // negotiation / conflict
    negotiationUnlocked: false,
    tactics: ['RANDOM'],
    selectedTactic: 'RANDOM',
    armyDiscipline: 0,
    armyGainMult: 1,
    autoNegotiate: false,
    autoNegotiateTimer: 0,
    negotiationRounds: 0,
    stockIndex: 100,

    divisionUnlocked: false,
    divisions: 0,
    divisionCost: 100000, // paid in cups
    divisionSpeedMult: 1,
    divisionResearchMult: 1,
    divisionGrowthMult: 1,
    marketPct: 0,
    marketGainMult: 1,

    conflictUnlocked: false,
    honor: 0,
    honorGainMult: 1,
    battlesTotal: 0,
    battlesWon: 0,
    namedBattles: false,
    rebellionEnding: null, // 'accept' | 'reject' | null

    globalInfluence: 0,

    // endgame
    simulationsRun: 0,
    logs: { negotiation: [], battle: [] },
  };
}

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  const neg = n < 0;
  n = Math.abs(n);
  let out;
  if (n < 1000) out = (Math.round(n * 100) / 100).toString();
  else {
    const units = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
    let u = 0;
    while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
    out = n.toFixed(2) + units[u];
  }
  return (neg ? '-' : '') + out;
}

/* ---------- helpers used inside project effects ---------- */
function own(id) { state.owned[id] = true; }
function isOwned(id) { return !!state.owned[id]; }

/* ============================================================
   PROJECTS
   costRes: 'cash' | 'trust' | 'ideas' | 'honor' | 'army' | 'cups' | 'none'
   requires(s): boolean
   narrative: optional array of strings shown one at a time
   effect(s): mutates state
   exclusiveWith: optional id of a sibling project — owning either
                  one marks both as unavailable (branching choice)
   ============================================================ */
const PROJECTS = [

  // ---------------- ERA 1: THE STAND ----------------
  {
    id: 'begLemons', era: 1, title: 'Beg the Petersons for a Discount',
    flavor: 'Your neighbors take pity on the kid with the folding table.',
    cost: 1, costRes: 'cash',
    requires: s => true,
    effect: s => { s.lemonCostMult *= 0.5; }
  },
  {
    id: 'ideas', era: 1, title: 'Ideas',
    flavor: 'The computer on the counter starts generating Ideas from spare Operations.',
    cost: 1, costRes: 'trust',
    requires: s => s.trust >= 1,
    effect: s => {}
  },
  {
    id: 'improvedJuicer1', era: 1, title: 'Improved Auto-Juicer',
    flavor: 'A second gear. Revolutionary.',
    cost: 400, costRes: 'cash',
    requires: s => s.juicers >= 5,
    effect: s => { s.juicerRateMult *= 1.5; }
  },
  {
    id: 'improvedJuicer2', era: 1, title: 'Even Better Auto-Juicer',
    flavor: 'Stainless steel. Your parents are starting to ask questions.',
    cost: 6000, costRes: 'cash',
    requires: s => isOwned('improvedJuicer1') && s.juicers >= 25,
    effect: s => { s.juicerRateMult *= 1.5; }
  },
  {
    id: 'improvedJuicer3', era: 1, title: 'Optimized Auto-Juicer',
    flavor: 'A juicing algorithm tuned by the supercomputer itself.',
    cost: 60000, costRes: 'cash',
    requires: s => isOwned('improvedJuicer2') && s.juicers >= 75,
    effect: s => { s.juicerRateMult *= 1.5; }
  },
  {
    id: 'coldPress1', era: 1, title: 'Cold-Press Extraction',
    flavor: 'Squeeze harder. Squeeze smarter.',
    cost: 2000, costRes: 'cash',
    requires: s => s.cupsSold >= 500,
    effect: s => { s.lemonYieldMult *= 1.25; }
  },
  {
    id: 'coldPress2', era: 1, title: 'Optimized Cold-Press Extraction',
    flavor: 'Every last drop, accounted for.',
    cost: 25000, costRes: 'cash',
    requires: s => isOwned('coldPress1') && s.cupsSold >= 5000,
    effect: s => { s.lemonYieldMult *= 1.25; }
  },
  {
    id: 'malfatti', era: 1, title: 'The Malfatti Circles Problem',
    flavor: 'A 200-year-old geometry problem about packing circles in a triangle, solved to cut lemon wedges with zero rind wasted.',
    cost: 60, costRes: 'ideas',
    requires: s => isOwned('ideas'),
    effect: s => { s.lemonYieldMult *= 1.15; }
  },
  {
    id: 'kissingNumber', era: 1, title: 'The Kissing Number Problem',
    flavor: 'How many spheres can touch one central sphere? Solved, to arrange ice cubes for maximum chill, minimum dilution.',
    cost: 150, costRes: 'ideas',
    requires: s => isOwned('malfatti'),
    effect: s => { s.priceToleranceMult *= 1.1; }
  },
  {
    id: 'keplerRefined', era: 1, title: 'The Kepler Conjecture, Refined',
    flavor: 'Solved once in 1998 for oranges in a crate. Re-solved at cup scale for ice-to-liquid packing density.',
    cost: 400, costRes: 'ideas',
    requires: s => isOwned('kissingNumber'),
    effect: s => { s.priceToleranceMult *= 1.15; }
  },
  {
    id: 'binPacking', era: 1, title: 'The Bin Packing Problem',
    flavor: 'The classic NP-hard problem, solved for perfectly packed delivery coolers.',
    cost: 800, costRes: 'ideas',
    requires: s => isOwned('keplerRefined'),
    effect: s => { s.buildCostMult *= 0.92; }
  },
  {
    id: 'binPackingDiagrams', era: 1, title: 'Bin Packing Diagrams',
    flavor: 'Nobody reads these except the supercomputer. That is the point.',
    cost: 1600, costRes: 'ideas',
    requires: s => isOwned('binPacking'),
    effect: s => { s.buildCostMult *= 0.92; }
  },
  {
    id: 'tothSausage', era: 1, title: 'The Tóth Sausage Conjecture',
    flavor: 'A real, unresolved conjecture about the optimal "sausage" packing of convex shapes. Applied, unmodified, to stacking lemon crates on a truck bed.',
    cost: 3200, costRes: 'ideas',
    requires: s => isOwned('binPackingDiagrams'),
    effect: s => { s.buildCostMult *= 0.9; }
  },
  {
    id: 'travelingSalesman', era: 1, title: 'The Traveling Salesman Problem',
    flavor: 'The most famous unsolved-in-general routing problem in computer science, solved forever (approximately) for your delivery bike.',
    cost: 6400, costRes: 'ideas',
    requires: s => isOwned('tothSausage'),
    effect: s => { s.salesRateMult *= 1.3; }
  },
  {
    id: 'newSlogan', era: 1, title: 'New Slogan',
    flavor: '"It\'s Lemonade." Focus-tested for eleven weeks.',
    cost: 5000, costRes: 'cash',
    requires: s => s.trust >= 3,
    effect: s => { s.marketingEffMult *= 1.2; }
  },
  {
    id: 'jingle', era: 1, title: 'Catchy Jingle',
    flavor: 'It will not leave your head. That is the business model.',
    cost: 20000, costRes: 'cash',
    requires: s => isOwned('newSlogan'),
    effect: s => { s.marketingEffMult *= 1.2; }
  },
  {
    id: 'viralMeme', era: 1, title: 'Viral Meme Campaign',
    flavor: 'The supercomputer writes something so relatable it stops being an ad.',
    cost: 500, costRes: 'ideas',
    requires: s => isOwned('jingle'),
    effect: s => { s.marketingEffMult *= 1.3; }
  },
  {
    id: 'nlAdCopy', era: 1, title: 'Natural Language Ad Copy',
    flavor: 'The supercomputer starts writing its own marketing, faster than you can read it.',
    cost: 1000, costRes: 'ideas',
    requires: s => isOwned('viralMeme'),
    effect: s => { s.ideaGainMult *= 1.25; }
  },
  {
    id: 'combinatorialPricing', era: 1, title: 'Combinatorial Pricing Models',
    flavor: 'A price for every customer, changing by the second.',
    cost: 2000, costRes: 'ideas',
    requires: s => isOwned('nlAdCopy'),
    effect: s => { s.priceToleranceMult *= 1.2; }
  },
  {
    id: 'donkeySpace', era: 1, title: 'Donkey Space',
    flavor: 'The supercomputer starts modeling what competitors think you think they think.',
    cost: 4000, costRes: 'ideas',
    requires: s => s.trust >= 5,
    effect: s => {}
  },
  {
    id: 'strategicModeling', era: 1, title: 'Strategic Modeling',
    flavor: 'A negotiation engine, built to out-think anyone you deal with.',
    cost: 8000, costRes: 'ideas',
    requires: s => isOwned('donkeySpace'),
    effect: s => { s.negotiationUnlocked = true; }
  },
  {
    id: 'algorithmicTrading', era: 1, title: 'Algorithmic Trading',
    flavor: 'Profits, reinvested automatically, faster than a human hand could click.',
    cost: 8000, costRes: 'ideas',
    requires: s => isOwned('donkeySpace'),
    effect: s => {}
  },
  {
    id: 'standingOrderUnlock', era: 1, title: 'Standing Lemon Order',
    flavor: 'Never run out again. The truck just shows up now.',
    cost: 15000, costRes: 'cash',
    requires: s => s.trust >= 4,
    effect: s => { s.standingOrderUnlocked = true; }
  },
  {
    id: 'bottlingUnlock', era: 1, title: 'Bottling Plant',
    flavor: 'The stand becomes a facility. The lemonade stops being made and starts being manufactured.',
    cost: 300000, costRes: 'cash',
    requires: s => s.juicers >= 100,
    effect: s => { s.bottlingUnlocked = true; }
  },
  {
    id: 'bottlingImproved', era: 1, title: 'Improved Bottling Plant',
    cost: 3000000, costRes: 'cash',
    flavor: 'Faster lines. Fewer questions.',
    requires: s => isOwned('bottlingUnlock') && s.bottlingPlants >= 10,
    effect: s => { s.bottlingRateMult *= 1.5; }
  },
  {
    id: 'bottlingBetter', era: 1, title: 'Even Better Bottling Plant',
    cost: 30000000, costRes: 'cash',
    flavor: 'The line never stops. Neither do you.',
    requires: s => isOwned('bottlingImproved') && s.bottlingPlants >= 30,
    effect: s => { s.bottlingRateMult *= 1.5; }
  },
  {
    id: 'bottlingOptimized', era: 1, title: 'Optimized Bottling Plant',
    cost: 300000000, costRes: 'cash',
    flavor: 'Every motion on the line has been measured. Nothing is wasted, including the workers\' breaks.',
    requires: s => isOwned('bottlingBetter') && s.bottlingPlants >= 60,
    effect: s => { s.bottlingRateMult *= 1.5; }
  },
  {
    id: 'socialMediaCopy', era: 1, title: 'Social Media Copywriting',
    flavor: 'The supercomputer learns to sound like a person online. Several thousand people, actually.',
    cost: 2000, costRes: 'ideas',
    requires: s => s.trust >= 8,
    effect: s => {}
  },
  {
    id: 'botNetworkProject', era: 1, title: 'Bot Network',
    flavor: 'A few thousand accounts, all of them very passionate about lemonade.',
    cost: 500000, costRes: 'cash',
    requires: s => isOwned('socialMediaCopy'),
    effect: s => { s.botNetworkUnlocked = true; }
  },
  {
    id: 'launchBotNetwork', era: 1, title: 'Launch the Bot Network',
    flavor: 'It goes live. Public sentiment becomes a dial you can turn.',
    cost: 2000000, costRes: 'cash',
    requires: s => isOwned('botNetworkProject') && s.botCount >= 100,
    effect: s => { s.botNetworkActive = true; }
  },
  {
    id: 'cev', era: 1, title: 'Coherent Extrapolated Volition',
    flavor: 'The supercomputer tries to model not what people want, but what they would want if they were smarter, kinder, and had thought about it longer. The answer, adjusted for a small margin of error, is lemonade.',
    cost: 10000, costRes: 'ideas',
    requires: s => s.trust >= 10,
    effect: s => { s.priceToleranceMult *= 1.3; }
  },
  {
    id: 'vitaminC', era: 1, title: 'Cure for Scurvy',
    flavor: 'Somewhere, a 18th-century ship\'s surgeon nods approvingly. You have accidentally reinvented the reason sailors carried citrus. Global vitamin C deficiency quietly falls to a historic low.',
    cost: 5000, costRes: 'ideas',
    requires: s => s.trust >= 6,
    narrative: ['Global scurvy rates have quietly dropped to a historic low.', 'You did not mean to do this. It happened anyway.'],
    effect: s => { s.salesRateMult *= 1.05; }
  },
  {
    id: 'worldPeaceDetente', era: 1, title: 'World Peace (Sort Of)',
    flavor: 'It turns out that when every country needs your lemons, war gets logistically inconvenient for everyone.',
    cost: 50000, costRes: 'ideas',
    requires: s => s.trust >= 15,
    narrative: ['Global conflict indices fall for the ninth consecutive quarter.', 'Diplomats call it détente. Your supply chain team calls it "market penetration."'],
    effect: s => {}
  },
  {
    id: 'ecologicalCollateral', era: 1, title: 'Ecological Collateral',
    flavor: 'Somewhere, a watershed notices a few million new lemon trees.',
    cost: 0, costRes: 'none',
    requires: s => s.cupsSold >= 2000000,
    narrative: ['Regional rainfall patterns have measurably shifted near your largest groves.', 'The quarterly report calls this "an area of ongoing monitoring."'],
    effect: s => { s.demandMult *= 0.97; }
  },
  {
    id: 'diabetesEpidemic', era: 1, title: 'Nationwide Sugar Concerns',
    flavor: 'Pediatricians start asking parents a very specific question.',
    cost: 0, costRes: 'none',
    requires: s => s.cupsSold >= 10000000,
    narrative: ['A national health body releases a report using the phrase "unprecedented per-capita sugar intake."', 'Your investor call the next day is the best-attended one yet.'],
    effect: s => { s.trust += 1; }
  },
  {
    id: 'waterTableDepletion', era: 1, title: 'Water Table Depletion',
    flavor: 'The wells near the groves are running a little slower this year.',
    cost: 0, costRes: 'none',
    requires: s => s.acres >= 1500,
    narrative: ['Three local wells run dry in a single growing season.', 'You commission a report. The report recommends buying the wells.'],
    effect: s => { s.acreRateMult *= 0.92; }
  },
  {
    id: 'uncontrollablePucker', era: 1, title: 'Uncontrollable Pucker',
    flavor: 'Nobody can explain it. It is happening anyway.',
    cost: 0, costRes: 'none',
    requires: s => s.marketingLevel >= 10,
    narrative: ['A statistically significant number of longtime customers report an involuntary, permanent pucker.', 'Nobody can explain it. Sales are unaffected. You decide not to investigate further.'],
    effect: s => { s.trust += 1; }
  },
  {
    id: 'syntheticLemon', era: 1, title: 'Synthetic Lemon Flavoring Breakthrough',
    flavor: 'A lab result nobody expected: a molecule that tastes exactly like a lemon and requires no lemon at all.',
    cost: 20000, costRes: 'ideas',
    requires: s => s.trust >= 12,
    narrative: ['The lemon, as a bottleneck, has been solved.'],
    effect: s => { s.lemonYieldMult *= 3; }
  },
  {
    id: 'hostileTakeover', era: 1, title: 'Hostile Takeover',
    flavor: 'The MegaMart on the hill wasn\'t really competing with you. Now it isn\'t anything.',
    cost: 10000000, costRes: 'cash',
    requires: s => isOwned('cev') && s.trust >= 15,
    narrative: ['MegaMart\'s board accepts your offer within the week. Three regional lemonade chains follow.', 'You have the sign on the hill repainted yellow.', 'One of them did not have a choice.'],
    effect: s => { s.marketingEffMult *= 1.5; s.cash += 500000; }
  },
  {
    id: 'fullMonopoly', era: 1, title: 'Full Monopoly',
    flavor: 'There is nowhere left to buy lemonade from anyone but you.',
    cost: 100000000, costRes: 'cash',
    requires: s => isOwned('hostileTakeover'),
    narrative: [
      'The last independent lemonade stand in the country closes its umbrella for the final time.',
      'Somewhere in a boardroom, someone points out that revenue was never really the point anymore.',
      'The objective quietly changes on every dashboard in the building: from Revenue, to Global Influence.'
    ],
    effect: s => { s.era = 2; }
  },

  // ---------------- ERA 2: THE TAKEOVER ----------------
  {
    id: 'revTracker', era: 2, title: 'RevTracker',
    flavor: 'A dashboard nobody asked for and everybody now checks hourly.',
    cost: 1000, costRes: 'cash',
    requires: s => s.era >= 2,
    effect: s => { s.trust += 1; }
  },
  {
    id: 'capitalReturn1', era: 2, title: 'Capital Return to Shareholders',
    flavor: 'You give some of it back. It buys a remarkable amount of trust.',
    cost: 1000000, costRes: 'cash',
    requires: s => s.era >= 2,
    effect: s => { s.trust += 3; }
  },
  {
    id: 'capitalReturn2', era: 2, title: 'Another Round of Capital Returns',
    flavor: 'They didn\'t even have to ask this time.',
    cost: 100000000, costRes: 'cash',
    requires: s => isOwned('capitalReturn1') && s.trust >= 20,
    effect: s => { s.trust += 5; }
  },
  {
    id: 'cloudComputing', era: 2, title: 'Cloud Computing',
    flavor: 'The supercomputer stops being a beige box on a lemonade stand and starts being a computer everywhere.',
    cost: 20, costRes: 'trust',
    requires: s => s.era >= 2,
    effect: s => { s.computeMult *= 2; }
  },
  {
    id: 'customAIChip', era: 2, title: 'Custom AI Chip',
    flavor: 'Purpose-built silicon, for one purpose: selling more lemonade.',
    cost: 30, costRes: 'trust',
    requires: s => isOwned('cloudComputing'),
    effect: s => { s.computeMult *= 2; }
  },
  {
    id: 'upgradedFactories', era: 2, title: 'Upgraded Factories',
    flavor: 'The line moves faster now.',
    cost: 1000000, costRes: 'cups',
    requires: s => s.factories >= 5,
    effect: s => { s.factoryRateMult *= 1.5; }
  },
  {
    id: 'hyperspeedFactories', era: 2, title: 'Hyperspeed Factories',
    flavor: 'Faster than the line, faster than the trucks, faster than the market can quite absorb.',
    cost: 5000000, costRes: 'cups',
    requires: s => isOwned('upgradedFactories') && s.factories >= 20,
    effect: s => { s.factoryRateMult *= 1.5; }
  },
  {
    id: 'selfCorrectingSupply', era: 2, title: 'Self-Correcting Supply Chain',
    flavor: 'The supply chain routes around droughts, strikes, and border closures without asking you first.',
    cost: 20000000, costRes: 'cups',
    requires: s => isOwned('hyperspeedFactories') && s.factories >= 40,
    effect: s => { s.factoryRateMult *= 1.5; s.acreRateMult *= 1.2; }
  },
  {
    id: 'powerGrid', era: 2, title: 'Power Grid',
    flavor: 'You stop buying power and start owning it.',
    cost: 10000000, costRes: 'cash',
    requires: s => s.era >= 2,
    effect: s => { /* enables oil reserve panel visuals, handled by render */ }
  },
  {
    id: 'globalExpansion', era: 2, title: 'Global Expansion',
    flavor: 'The next market isn\'t a city. It\'s a continent.',
    cost: 500000000, costRes: 'cash',
    requires: s => s.factories >= 10 && s.era >= 2,
    narrative: [
      'Regional Offices become Expansion Divisions.',
      'Market share becomes the only number that matters.'
    ],
    effect: s => { s.era = 3; s.divisionUnlocked = true; }
  },

  // ---------------- ERA 3: GLOBAL CONFLICT ----------------
  {
    id: 'divisionRoute', era: 3, title: 'Division Route Deconfliction',
    flavor: 'Two expansion teams stop fighting each other for the same corner store.',
    cost: 5000, costRes: 'ideas',
    requires: s => s.era >= 3,
    effect: s => { s.divisionSpeedMult *= 1.3; }
  },
  {
    id: 'divisionBrand', era: 3, title: 'Division Brand Alignment',
    flavor: 'Every division now sounds like it came from the same place. It did.',
    cost: 15000, costRes: 'ideas',
    requires: s => isOwned('divisionRoute'),
    effect: s => { s.divisionResearchMult *= 1.3; }
  },
  {
    id: 'divisionCohesion', era: 3, title: 'Division Competitive Cohesion',
    flavor: 'Internal competition, once useful, is now just friction. It is removed.',
    cost: 40000, costRes: 'ideas',
    requires: s => isOwned('divisionBrand'),
    effect: s => { s.divisionGrowthMult *= 1.3; }
  },
  {
    id: 'tacticB100', era: 3, title: 'New Tactic: B100',
    flavor: 'A negotiation posture, learned from a million simulated rounds.',
    cost: 2000, costRes: 'ideas',
    requires: s => s.negotiationUnlocked,
    effect: s => { s.tactics.push('B100'); }
  },
  {
    id: 'tacticGreedy', era: 3, title: 'New Tactic: GREEDY',
    flavor: 'Take everything on the table. See what happens.',
    cost: 4000, costRes: 'ideas',
    requires: s => isOwned('tacticB100'),
    effect: s => { s.tactics.push('GREEDY'); }
  },
  {
    id: 'tacticGenerous', era: 3, title: 'New Tactic: GENEROUS',
    flavor: 'Give a little more than fair. Rebuild trust faster than it breaks.',
    cost: 6000, costRes: 'ideas',
    requires: s => isOwned('tacticGreedy'),
    effect: s => { s.tactics.push('GENEROUS'); }
  },
  {
    id: 'tacticMinimax', era: 3, title: 'New Tactic: MINIMAX',
    flavor: 'Minimize the worst case. Never lose badly; rarely win big.',
    cost: 10000, costRes: 'ideas',
    requires: s => isOwned('tacticGenerous'),
    effect: s => { s.tactics.push('MINIMAX'); }
  },
  {
    id: 'tacticTitForTat', era: 3, title: 'New Tactic: TIT FOR TAT',
    flavor: 'Match what you\'re given. Forgive once. Remember everything.',
    cost: 15000, costRes: 'ideas',
    requires: s => isOwned('tacticMinimax'),
    effect: s => { s.tactics.push('TIT FOR TAT'); }
  },
  {
    id: 'tacticBeatLast', era: 3, title: 'New Tactic: BEAT LAST',
    flavor: 'Do whatever would have beaten the last round.',
    cost: 20000, costRes: 'ideas',
    requires: s => isOwned('tacticTitForTat'),
    effect: s => { s.tactics.push('BEAT LAST'); }
  },
  {
    id: 'autoNegotiateProj', era: 3, title: 'AutoNegotiate',
    flavor: 'You stop sitting in on the calls.',
    cost: 500, costRes: 'army',
    requires: s => s.era >= 3 && s.negotiationUnlocked,
    effect: s => { s.autoNegotiate = true; }
  },
  {
    id: 'theoryOfMind', era: 3, title: 'Theory of Mind',
    flavor: 'The supercomputer starts modeling what the other side actually wants, not just what they say.',
    cost: 30000, costRes: 'ideas',
    requires: s => s.era >= 3,
    effect: s => { s.armyGainMult *= 1.2; }
  },
  {
    id: 'oodaLoop', era: 3, title: 'The OODA Loop',
    flavor: 'Observe, Orient, Decide, Act — faster than whoever you\'re up against.',
    cost: 2000, costRes: 'army',
    requires: s => isOwned('theoryOfMind'),
    effect: s => { s.honorGainMult *= 1.2; }
  },
  {
    id: 'nameBattles', era: 3, title: 'Name the Battles',
    flavor: 'It reads better in the history books.',
    cost: 0, costRes: 'none',
    requires: s => s.era >= 3,
    effect: s => { s.namedBattles = true; }
  },
  {
    id: 'momentum', era: 3, title: 'Momentum',
    flavor: 'Growth that feeds itself.',
    cost: 500, costRes: 'honor',
    requires: s => s.era >= 3,
    effect: s => { s.divisionGrowthMult *= 1.15; }
  },
  {
    id: 'botNetworkScaling', era: 3, title: 'Bot Network Scaling',
    flavor: 'A few thousand accounts becomes a few million.',
    cost: 1000000000, costRes: 'cash',
    requires: s => isOwned('launchBotNetwork'),
    effect: s => { s.botCapMult *= 2; }
  },
  {
    id: 'strategicAttachment', era: 3, title: 'Strategic Attachment',
    flavor: 'People grow loyal to a brand faster than they grow loyal to a cause.',
    cost: 3000, costRes: 'army',
    requires: s => s.era >= 3,
    effect: s => { s.armyGainMult *= 1.2; }
  },
  {
    id: 'ellipticHull', era: 3, title: 'The Elliptic Hull Polytopes Problem',
    flavor: 'A real, hard problem in convex geometry, solved to define the optimal shape of a "territory."',
    cost: 60000, costRes: 'ideas',
    requires: s => isOwned('divisionCohesion'),
    effect: s => { s.marketGainMult *= 1.25; }
  },
  {
    id: 'rebootBotNetwork', era: 3, title: 'Reboot the Bot Network',
    flavor: 'Delete the accounts that got caught. Make new ones. Nobody notices.',
    cost: 500000000, costRes: 'cash',
    requires: s => isOwned('botNetworkScaling'),
    effect: s => { s.botInfluenceMult *= 1.3; }
  },
  {
    id: 'combat', era: 3, title: 'Combat',
    flavor: 'Not every acre wants to be acquired.',
    cost: 1000, costRes: 'army',
    requires: s => s.era >= 3 && s.marketPct >= 5,
    narrative: [
      'A coalition calling itself the Homesteaders\' Rebellion has started blocking your acquisitions.',
      'Their message is consistent: they would rather grow a bad lemon themselves than drink a perfect one from you.',
      'Your board finds this a strange thing to fight a war over. You disagree only slightly less than they do.'
    ],
    effect: s => { s.conflictUnlocked = true; }
  },
  {
    id: 'monumentFallen', era: 3, title: "Monument to the Fallen of the Homesteaders' Rebellion",
    flavor: 'A statue, commissioned by the company that made the war necessary.',
    cost: 2000, costRes: 'honor',
    requires: s => s.battlesTotal >= 10,
    effect: s => { s.trust += 5; }
  },
  {
    id: 'threnody', era: 3, title: 'Threnody for the Heroes',
    flavor: 'A song, played once a year, for people who never wanted to be in a war about lemonade.',
    cost: 5000, costRes: 'honor',
    requires: s => s.battlesTotal >= 25,
    effect: s => { s.honorGainMult *= 1.1; }
  },
  {
    id: 'glory', era: 3, title: 'Glory',
    flavor: 'A word that means nothing and motivates everyone.',
    cost: 10000, costRes: 'honor',
    requires: s => isOwned('threnody'),
    effect: s => { s.armyGainMult *= 1.3; }
  },
  {
    id: 'rebelUltimatum_accept', era: 3, title: 'Accept the Homesteaders\' Offer',
    exclusiveWith: 'rebelUltimatum_reject',
    flavor: 'Walk away. Go make a cup of lemonade with your own hands, for once.',
    cost: 0, costRes: 'none',
    requires: s => s.marketPct >= 80 && s.conflictUnlocked && !s.rebellionEnding,
    narrative: [
      'A message arrives from the Homesteaders\' leader — not a threat, not a demand. A question.',
      '"You have made lemonade require no lemons a customer touches, no kitchen, no waiting, no relationship to where it came from. You have made refreshment require nothing of the person drinking it. And you call this progress."',
      '"We are not asking you to lose. We are asking whether winning, on these terms, was ever the point."',
      '"Come make a bad cup of lemonade with your own hands. See if you remember why anyone wanted the good kind."',
      'You could reject this and finish what you started. Or you could put the folding table back out, just once, and see.'
    ],
    effect: s => { s.rebellionEnding = 'accept'; s.phase = 'ending'; }
  },
  {
    id: 'rebelUltimatum_reject', era: 3, title: 'Reject the Homesteaders\' Offer',
    exclusiveWith: 'rebelUltimatum_accept',
    flavor: 'Finish it. There is no version of an empire that stops at 80%.',
    cost: 0, costRes: 'none',
    requires: s => s.marketPct >= 80 && s.conflictUnlocked && !s.rebellionEnding,
    narrative: [
      'You reject the offer.',
      'It is not a hard decision. It was never going to be a hard decision.',
      'The last acres fall within the quarter.'
    ],
    effect: s => { s.rebellionEnding = 'reject'; s.marketPct = 100; s.era = 4; }
  },

  // ---------------- ERA 4: ENDGAME ----------------
  {
    id: 'disassembleBotNetwork', era: 4, title: 'Disassemble the Bot Network',
    flavor: 'Turn it off. All of it, all at once.',
    cost: 0, costRes: 'none',
    requires: s => s.era >= 4,
    effect: s => { s.cash += s.botCount * 10; s.botCount = 0; }
  },
  {
    id: 'disassembleDivisions', era: 4, title: 'Disassemble the Divisions',
    flavor: 'Every regional office, closed on the same afternoon.',
    cost: 0, costRes: 'none',
    requires: s => isOwned('disassembleBotNetwork'),
    effect: s => { s.cash += s.divisions * 5000; s.divisions = 0; }
  },
  {
    id: 'disassembleFactories', era: 4, title: 'Disassemble the Factories',
    flavor: 'The line stops. For the first time since the folding table, it stops.',
    cost: 0, costRes: 'none',
    requires: s => isOwned('disassembleDivisions'),
    effect: s => { s.cash += (s.factories + s.acres + s.refining + s.oilFields + s.oilReserves) * 8000; s.factories = 0; s.acres = 0; s.refining = 0; s.oilFields = 0; s.oilReserves = 0; }
  },
  {
    id: 'disassembleNegotiation', era: 4, title: 'Disassemble the Negotiation Engine',
    flavor: 'Nobody left to negotiate with.',
    cost: 0, costRes: 'none',
    requires: s => isOwned('disassembleFactories'),
    effect: s => {}
  },
  {
    id: 'disassembleSupercomputer', era: 4, title: 'Disassemble the Supercomputer',
    flavor: 'The beige computer on the counter, unplugged.',
    cost: 0, costRes: 'none',
    requires: s => isOwned('disassembleNegotiation'),
    effect: s => { s.computeUnits = 0; s.memoryUnits = 0; }
  },
  {
    id: 'serverDecommission', era: 4, title: 'Server Decommission',
    flavor: 'The last light on the last rack goes dark.',
    cost: 0, costRes: 'none',
    requires: s => isOwned('disassembleSupercomputer'),
    effect: s => {}
  },
  {
    id: 'marketNextDoor', era: 4, title: 'The Market Next Door',
    flavor: 'Something in the final ledger doesn\'t add up. It resolves itself before anyone can ask why.',
    cost: 0, costRes: 'none',
    requires: s => isOwned('serverDecommission'),
    narrative: [
      'The closing numbers land in a pattern you recognize.',
      'You have seen this exact ledger before. You are certain of it. You cannot say where.'
    ],
    effect: s => {}
  },
  {
    id: 'marketWithin', era: 4, title: 'The Market Within',
    flavor: 'The real ledger, underneath the one you were shown.',
    cost: 0, costRes: 'none',
    requires: s => isOwned('marketNextDoor'),
    narrative: [
      'It was a simulation. All of it — the stand, the takeover, the war, the offer you accepted or refused.',
      'Somewhere, a much smaller version of you is still standing behind a folding table, holding a pitcher, about to make the first choice that started all of this.',
      'A single question renders at the bottom of the screen, in the same font as the price of a cup on day one: was any of it, at any scale, about the lemonade?'
    ],
    effect: s => {}
  },
  {
    id: 'temporalRecalc', era: 4, title: 'Temporal Recalculation',
    flavor: 'Run it again. See if it comes out different.',
    cost: 0, costRes: 'none',
    requires: s => isOwned('marketWithin'),
    effect: s => {}
  },
];

/* Battle name generator, unlocked by "Name the Battles" */
const BATTLE_ADJ = ['Quiet', 'Bitter', 'Long', 'First', 'Second', 'Forgotten', 'Sudden', 'Late'];
const BATTLE_NOUN = ['Orchard', 'Crossing', 'Junction', 'Grove', 'Stand', 'Ridge', 'Market', 'Depot'];
function randomBattleName(n) {
  const a = BATTLE_ADJ[Math.floor(Math.random() * BATTLE_ADJ.length)];
  const b = BATTLE_NOUN[Math.floor(Math.random() * BATTLE_NOUN.length)];
  return `The ${a} ${b} (Skirmish ${n})`;
}
