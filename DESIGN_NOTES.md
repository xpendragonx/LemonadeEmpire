# Lemonade Empire — Design Session Notes

Working notes from the brainstorm + build session. Carrying this into a new
session so nothing gets re-derived from scratch.

## Concept

A re-skin of **Universal Paperclips** (Frank Lantz, 2017): instead of an AI
optimizing paperclip production until it consumes the universe, you play a
kid whose lemonade stand becomes a global business empire, with the same
underlying satire — relentless optimization eventually curdles into
something monstrous, just told in business terms instead of AI-safety terms.

Original game structure to study/replay for reference:
https://www.decisionproblem.com/paperclips/ — the uploaded source
(`index_3.html`, the Universal Paperclips client) was used as the reference
for every mechanic below.

## Full era-by-era mapping (locked in during brainstorm)

### Era 1 — The Stand (human era)
| Original | Lemonade Empire |
|---|---|
| Wire | Lemons |
| Clips made/sold | Cups of lemonade sold |
| AutoClipper | Auto-Juicer |
| MegaClipper | Bottling Plant |
| WireBuyer | Standing Lemon Order |
| Price/Margin, Marketing, Public Demand | Same concepts, same names |
| Trust (from investors) | Trust (kept) |
| Processors / Memory | Server Racks / Memory (a "supercomputer under the table") |
| Operations → Creativity | Operations → **Ideas** |
| Flavor projects (Slogan, Jingle, Limerick) | New Slogan, Catchy Jingle, Viral Meme Campaign |
| Quantum Computing / Photonic Chip | Cloud Computing / Custom AI Chip |
| Hadwiger/Tóth math-joke cluster | Real hard math/CS problems re-applied to lemonade logistics: **Malfatti Circles Problem** (wedge-cutting), **Kissing Number Problem** (ice packing), **Kepler Conjecture, Refined** (ice-to-liquid density), **Bin Packing Problem** (cooler packing), **Tóth Sausage Conjecture** (kept verbatim — crate stacking), **Traveling Salesman Problem** (delivery routing) |
| "A Token of Goodwill" | **Capital Return to Shareholders** (dividends/buybacks → Trust) |
| Coherent Extrapolated Volition | Kept verbatim (inside joke) |
| Cure for Cancer / World Peace / Global Warming / Male Pattern Baldness (irony track) | **Cure for Scurvy** (real good side effect, vitamin C), **World Peace (Sort Of)**, **Ecological Collateral**, **Nationwide Sugar Concerns** (diabetes), **Water Table Depletion**, **Uncontrollable Pucker** (the absurd unexplained one) |
| Nanoscale Wire Production | Synthetic Lemon Flavoring Breakthrough |
| Hostile Takeover / Full Monopoly | Kept as-is — ends Era 1, flips objective from Revenue to **Global Influence** |

### Era 2 — The Takeover
| Original | Lemonade Empire |
|---|---|
| Harvester Drones | Acres Controlled |
| Wire Drones | Refining Capacity |
| Clip Factories | Factories |
| Solar Farms | Oil Fields |
| Battery Towers | Oil Reserves (BPD) |
| Power performance throttling | Kept — factories throttled by oil supply |

### Era 3 — Global Conflict (was: Space Era)
| Original | Lemonade Empire |
|---|---|
| Drifters (rival swarms) | **Homesteaders' Rebellion** |
| Yomi | Army Discipline |
| HypnoDrones | merged into **Bot Network** (see below) |
| The Swarm (feed/teach/entertain/clad/synchronize) | Merged with HypnoDrones into one **Bot Network** system: Buy Server/API Capacity, Train Messaging Model, Generate Content, Brand the Accounts, Coordinate Campaigns — manipulates public opinion / pacifies the rebellion |
| Probes / % universe colonized | **Expansion Divisions** — stats: Speed, Market Research, Franchise Growth, Risk Mitigation, Combat; "% of global market controlled" |
| Strategy Engine (A100, GREEDY, TIT FOR TAT, etc.) | Kept literal as negotiation tactics |
| Investment Engine (stocks) | Kept largely as-is — a literal stock portfolio |
| Honor (from battles) | Kept as Honor |
| Drifter Emperor endgame monologue | **The Homesteaders' leader's ultimatum** — sarcastic commentary on convenience/comfort valued over meaning. Accept = quiet ending (walk away, go make lemonade by hand). Reject = crush the rebellion, proceed to Era 4. |

### Era 4 — Endgame
- **Liquidation**: disassemble Bot Network → Divisions → Factories/Acres/Refining/Oil → Negotiation Engine → Supercomputer (mirrors original's "Disassemble the Swarm/Probes/Factories" sequence).
- **Simulation reveal**: "The Market Next Door" → "The Market Within" — it was all a simulation, echoing original's "Universe Within/Next Door" twist, tied back to the convenience-vs-meaning theme.
- **New Game+**: "Run the Simulation Again" — full state reset except a persistent `simulationsRun` counter (mirrors original's Xavier Re-initialization / time reversion).

Credit to Frank Lantz's *Universal Paperclips* (2017) is shown on the
opening splash screen before the game starts, per the user's explicit request.

## What got built

Location: `lemonade-empire/` in the `xpendragonx/A.I.Artist` repo (this repo
also contains an unrelated pre-existing p5.js sketch at the root — left
untouched).

Files:
- `index.html` — page structure (credit splash, 3-column layout: Stand/Empire/Power, Supercomputer/Projects/Bot Network, Investment/Negotiation/Divisions/Conflict/Endgame)
- `style.css` — yellow/green terminal-monospace theme
- `game-data.js` — `freshState()` (full state shape) + `PROJECTS` array (~85 one-time upgrades, data-driven: `{id, era, title, flavor, cost, costRes, requires(s), narrative?, effect(s), exclusiveWith?}`)
- `game.js` — engine: building purchase system (geometric cost scaling), tick loop (production/sales/trust/ideas/power/bots/negotiation/divisions), narrative overlay queue, save/load via localStorage, New Game+ reset

Git status: pushed to branch `claude/great-maxwell-8bzr4t` (baseline commit + the
pixel-stand redesign below).

### Bugs found + fixed during testing (headless Playwright, full 4-era
playthrough scripted and passing with zero console errors)
1. **Softlock**: starting cash was only $5, and both the first lemon batch
   and the first Auto-Juicer cost $5 — a player who bought lemons first had
   no way to ever earn cash (no production without a juicer, no juicer
   without cash). Fixed by adding a manual **"Squeeze a Cup"** button
   (consumes 1 lemon, produces cups by hand, no cash needed) — mirrors the
   original's manual "Make Paperclip" click.
2. Project list was rebuilding its entire DOM every 500ms tick even when
   nothing changed — wasteful churn, also broke test automation. Fixed with
   a diff against the last-rendered visible-project-id set; only rebuilds
   when the set actually changes, otherwise just toggles button
   `disabled` state.
3. Endgame panel (with the "Run the Simulation Again" button) was
   rebuilding every 100ms tick instead of only on the slower render pass —
   moved to the 500ms slow-render cadence.
4. Negotiation panel's cost label said "1,000 operations" but
   `runNegotiation()` actually charges cash — label was stale from an
   earlier design iteration. Fixed to show the real (scaling) cash cost.

## Playability critique (why the new session exists)

User played the built game and said **it was not fun at all**. Diagnostic
so far (interrupted mid-question, resume here):

- **Main issue identified: "no hook."** Not pacing, not clarity, not lack
  of feedback specifically — the game doesn't grab you at the start.
- **Worst point: the very start (Era 1 opening)** — the first few minutes/
  clicks before anything is automated. This is the highest-priority target
  for the next brainstorm.
- Explicit constraint from the user: **keep the core math mechanics**
  (the underlying formulas/systems — exponential cost scaling, demand
  curve, production math, project-gating) while improving the
  **playability mechanics** around them (pacing, hook, feel).

### Candidate directions not yet discussed with the user (raise fresh, don't assume)
- What makes original Universal Paperclips' opening hook work: instant
  manual clicking with visible, immediate payoff (each click = a paperclip,
  immediately sellable), a very short on-ramp to the first automation
  purchase, dry deadpan humor in the copy, and a sense of "just one more
  click" from second one.
- Possible opening-hook levers for Lemonade Empire: make the manual
  "Squeeze a Cup" action the *first* thing the player does (not something
  buried after a purchase decision), give it satisfying immediate feedback
  (number pop, running cup tally front and center), reconsider whether
  buying lemons vs. juicer vs. squeezing is a meaningful early choice or
  just friction, look at whether starting numbers ($5 cash, $5 lemons,
  $5 juicer) create decision paralysis instead of momentum.
- Also worth revisiting: general "juice" (animations, number tickers,
  micro-feedback on every action) and whether the 3-column dense panel
  layout front-loads too much information before the player has any
  context for why it matters.

## Next steps for the new session
1. Resume the playability brainstorm — diagnose the Era 1 opening hook
   problem specifically before proposing fixes.
2. Keep iterating in brainstorm mode (no generation) until design is
   confirmed, per the user's standing preference.
3. Once confirmed, implement changes against the existing
   `lemonade-empire/` codebase (don't rebuild from scratch — the engine,
   data model, and full era progression are already built and tested).
4. Remember the outstanding git push blocker if it's still unresolved.

## Session 2 — opening redesign (built)

Diagnosis confirmed with the user: no hook at the start. Fix: a small
Stardew-style pixel opening before the text engine.

**Farm phase (`farm.js`, `sprites.js`, single-screen canvas, 320x200 logical)**
- Fixed-track movement: the kid slides horizontally between stations (trees,
  juicer). No pathfinding. Helper walks in straight lines (no obstacles).
- Pick: click a tree to shake it, then click each fallen lemon (flies to basket).
- Juice: hold on the juicer (or Space), release in the green zone.
  Zones: <40% weak x0.6, <70% good x1, <90% PERFECT x1.5, else bitter x0.5.
- Customers buy automatically; foot traffic *is* the demand indicator (no bar).
  Passersby show "$$?" when the price is steep; queue shows "sold out?".
- Trees hold 5 lemons, regrow 1 per 4s; planting is instant. 3 plots per lot,
  3 lots max ("Buy the Neighbor's Lot" = first acquisition).
- Upgrade buttons only (crafting idea dropped): Plant a Tree, Buy the Neighbor's
  Lot, Upgrade Juicer, Paint a Bigger Sign, Hire a Helper, Buy a Used Computer.
- MegaMart: billboard at 70 cups sold, construction at 130, grand opening at
  190 → only 40% of customers still come to you. Unlocks the $10 computer.
- Buying the computer zooms into its screen; the existing engine runs on a CRT
  "monitor"; the world stays in an "Out the window" panel and changes with the
  empire (orchards, derricks, factories, bottling plant, bot billboards,
  homesteader camps, MegaMart repainted LEMON EMPIRE after Hostile Takeover,
  demolished after liquidation, a single tree after The Market Within).
- Accepting the Homesteaders' offer shuts the terminal off (`phase: 'ending'`)
  and returns you to the stand, squeezing by hand, with "Run the Simulation Again".
- Art is all drawn in code (no external assets → no license issues). Kenney
  packs were the plan but kenney.nl was unreachable from the build sandbox; the
  code-drawn sprites can be swapped for a pack later.

**Math changes (deliberate)**
- Pricing was broken: revenue always rose with price, so "max the price" always
  won. Demand now uses exponent 1.5 on the price term (elastic, like the
  original's `demand^1.15`), giving a real sweet spot. See `updateDemand()`.
- Customer rate = marketing x 2 x demand% x traffic; traffic is 6 by hand, 50
  once the computer runs sales. MegaMart share (0.4) applies until Hostile Takeover.
- `?speed=N` URL param fast-forwards for testing.

**Pacing (scripted bot, 4x speed):** ~6-7 game-minutes to the computer before
the last MegaMart tweak; milestones were then pulled earlier to target ~5-6.
