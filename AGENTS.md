# NYXOR PROTOCOL: Full Build Context for the Coding Agent

> Drop this file in the repo root as `AGENTS.md` (or `CLAUDE.md`). Read all of it before writing code. Re-read sections 0, 6, 17 and 20 whenever you are unsure.

---

## 0. Agent working rules

1. **Verify before you build.** Section 20 lists facts about Avalanche tooling that may have changed. Read the current docs for each one. **Never guess CLI flags, contract addresses, precompile config keys or package versions.** If you cannot verify something, write it down in `docs/DECISIONS.md` as an assumption and keep going with the safest option.
2. **Small verified steps.** Plan, implement, test, document, then commit. Do not move on while tests fail.
3. **Never fabricate results.** No invented contract addresses, transaction hashes, test outputs or benchmark numbers. Deployment addresses come only from real deployments, recorded in `deployments/*.json`.
4. **Be honest about what is simulated.** The price feed, the market clock and the weekend shock are simulated. Label them in the UI, the README and the demo (see section 17).
5. **Scope discipline.** Build the MVP (section 4) first. Stretch items only after the MVP works end to end on Fuji.
6. **Explainability.** The builder must be able to explain every design decision to judges. Write short rationale comments on non-obvious logic and keep `docs/RISK_MODEL.md` current. "The AI wrote it" is not an acceptable answer in the demo.
7. **Record decisions.** Append to `docs/DECISIONS.md` (date, decision, reason, alternatives).
8. **Testnet only.** Nothing here is audited or for real funds. Never put real keys or funds anywhere near this repo.

---

## 1. Project summary

**Name:** Nyxor Protocol (name is a config constant; it may change)
**Tagline:** *The market closes on Friday. Your risk shouldn't.*
**One-liner:** Perpetual futures on stocks and gold trade 24/7, but the real markets close. Nyxor is a market-hours-aware risk engine that automatically tightens leverage, margin, position caps and funding before a market closes, and reopens it in a controlled way, so weekend price gaps don't create bad debt. It runs on its own permissioned Avalanche L1, with margin brought in from the Fuji C-Chain through ICTT.

**Plain-language story (use for README and pitch):** Betting on a stock while the stock exchange is closed is like betting on a game while the scoreboard is off. Nobody knows the real score until Monday. If the score has jumped, bets can't all be paid and the house loses money. Nyxor tightens the rules before the scoreboard goes dark and reopens carefully.

**What this is:** a risk module plus a minimal demo perps market that proves it works.
**What this is not:** a full exchange, an order book, or a production system.

---

## 2. Hackathon context (optimize for this)

This is a build sprint ("Speedrun", "Build Anything on Avalanche"), 30 days, no theme. The bar: a working prototype **deployed on Fuji (or mainnet) with a live demo that does something real on-chain**.

**Judging weights**

| Criterion | Weight | What it means for us |
|---|---|---|
| Does it work | 30% | Deployed, demoable, does what we say. Finish one flow completely. |
| Idea & originality | 25% | The risk-engine idea must be clearly different from "another perps DEX". |
| Technical depth | 20% | Margin math, schedule logic, pre-close deleveraging, re-open procedure are the hard parts. Real code, not scaffolding. |
| Avalanche fit | 15% | L1 + chain-level allowlist + ICTT, each with a stated reason (section 6). |
| Demo & communication | 10% | 3-minute video, clear before/after. |

**Bonus:** own L1 (yes), ICM/ICTT used meaningfully (yes), open-sourcing something reusable (the policy library, section 12), mainnet deployment (stretch, probably skip).

**Hard rules from the brief:** the prototype must be deployed and demoable; the builder must be able to explain it; do not copy an existing project under a new name. AI tools are allowed (record which ones were used and for what).

**Submission must include:** project name + one-liner; full description; tech stack (call out Avalanche-specific parts); live link / contract addresses; source repo (public preferred); demo video ≤ 3 min; which AI tools were used; delta vs. any pre-existing work (there is none; all work is new).

---

## 3. The problem and the thesis

- RWA perps (perpetual futures on stocks, indices, commodities) are among the fastest-growing on-chain derivative categories. They are synthetic and cash-settled: no custody of the underlying.
- Crypto perps reference spot markets that trade 24/7. Stock and commodity perps reference markets that **close** (nights, weekends, holidays) while the perp keeps trading.
- When the reference market reopens, the price can **gap** past liquidation levels. Liquidations work on a price path; a gap jumps over it. Losses then exceed collateral = **bad debt**, which the venue or its liquidity providers absorb.

**Nyxor's approach:** enforce the risk rules by market phase, on-chain, before the gap can hurt:
1. **Pre-close ramp-down:** as close approaches, max leverage and open-interest caps shrink on a schedule.
2. **Pre-close deleveraging:** positions above the closed-market cap are reduced to the cap **before the close, at a trustworthy open-market price**, instead of being liquidated into a gap.
3. **Closed-market regime:** lower leverage cap, higher maintenance margin, smaller position/OI caps, higher funding multiplier, reduce-only for over-cap positions.
4. **Controlled re-open:** a cooldown after the open (reduce-only, liquidations active, shortfall handled by an insurance fund) before normal limits are restored.

**Honest limit to document:** guarding reduces gap risk; it does not eliminate it. With a closed-market cap of 5x, bad debt appears only if the gap exceeds about 20%. A naive 20x market breaks at about 5%.

---

## 4. Scope

### MVP (must ship, in this order)
1. Foundry contracts: market schedule, simulated clock, mock price feed, risk policies (flat vs. market-hours), perp market (isolated margin), liquidity vault with insurance fund.
2. A Subnet-EVM L1 live on Fuji with a transaction allowlist.
3. ICTT: USDC-like token locked on Fuji C-Chain (TokenHome), wrapped on the L1 (TokenRemote), working relayer. Deposit direction required.
4. Keeper service (deleverage, liquidate, price pusher, scenario runner).
5. Web app: Bridge page, Trade page with phase indicator, Demo console with Standard vs. Guarded comparison.
6. Deterministic weekend-gap scenario with recorded results.
7. README, docs, demo video script.

### Stretch (only if MVP is done and stable)
- Withdrawals back to the C-Chain via ICTT.
- KYC-style precompile (only if the plain allowlist already works).
- Real oracle adapter behind `IPriceFeed`.
- Second market (equity index).
- Mainnet deployment.

### Non-goals
Order book, cross-margin, options, real KYC, real fiat, token launch, governance, audits, mobile app.

---

## 5. Architecture

```
            Fuji C-Chain (43113)                                 Nyxor L1 (Subnet-EVM, on Fuji)
  ┌──────────────────────────────────┐   ICTT (Teleporter)   ┌───────────────────────────────────────┐
  │ Test USDC (ERC-20)               │      + ICM relayer    │ ERC20TokenRemote  (wrapped USDC)      │
  │ ERC20TokenHome (locks USDC)      │ ───────────────────▶  │                                       │
  │                                  │ ◀───────────────────  │ MarketClock ── MarketSchedule         │
  └──────────────────────────────────┘     (stretch: out)    │ MockPriceFeed (IPriceFeed)            │
                                                              │ LiquidityVault A ◀─▶ PerpMarket GUARDED│
                                                              │   (insurance fund)    policy: MarketHours│
                                                              │ LiquidityVault B ◀─▶ PerpMarket STANDARD│
                                                              │   (insurance fund)    policy: Flat       │
                                                              │ Chain-level TxAllowList precompile    │
                                                              └───────────────────────────────────────┘
        ▲                                                                   ▲
        │ web app (Next.js): Bridge · Trade · Demo console · Admin          │
        └────────────── keeper service (TS): deleverage, liquidate, price, scenario
```

**Key design choice:** one `PerpMarket` implementation, two deployed instances. The only difference is the injected `IRiskPolicy` (`FlatRiskPolicy` vs. `MarketHoursRiskPolicy`) so the comparison is fair. Each market has its own vault, seeded with identical liquidity.

---

## 6. Avalanche components and why each is used

| Component | Use | Reason to state to judges |
|---|---|---|
| Fuji C-Chain + Snowtrace | Test USDC, ICTT TokenHome, faucet funds | Where stablecoin liquidity lives |
| Subnet-EVM L1 | Hosts the perps market and risk engine | Isolation from C-Chain congestion; own fee config; own rules |
| TxAllowList precompile | Only approved wallets can transact on the L1 | Compliance enforced at chain level, not per contract. Equity-linked perps can be regulated derivatives in some jurisdictions |
| FeeManager precompile (optional) | Tune fees so liquidations stay cheap/predictable | Chain-level knob that a C-Chain contract cannot have |
| ICTT + ICM/Teleporter + relayer | Move margin collateral from C-Chain to L1 | No third-party bridge; collateral comes from where liquidity lives |
| avalanche-cli / Builder Console / L1 Toolbox | Create and manage the L1 | Official tooling |
| `@avalanche-sdk/interchain` (ICTT client), Interchain Kit | Scripts and local end-to-end testing | Official tooling |
| Core wallet | User wallet for both chains | Avalanche-native |

**Fuji facts (from the brief):** RPC `https://api.avax-test.network/ext/bc/C/rpc`, chain ID `43113`, explorer `testnet.snowtrace.io`, free test AVAX from the Fuji faucet. An L1 validator costs a flat ~1.33 AVAX/month after the Etna upgrade and does not need to validate the Primary Network. Treat the exact flow as "verify in docs" (section 20).

**Gas on the L1:** keep it simple. Use a custom gas token funded by genesis allocation to the admin; a script tops up approved traders. Using USDC or AVAX as the L1 gas token via ICTT is a stretch and not needed.

**Allowlist gotcha (verify):** if the transaction allowlist blocks every non-listed sender, the **ICM relayer address, the keeper address and the deployer** must be enabled too, or ICTT deliveries and keeper calls will fail.

---

## 7. Smart contract specification (Solidity ^0.8.24, Foundry, OpenZeppelin v5)

Use fixed-point carefully and document units. **USDC: 6 decimals. Prices: 8 decimals. Basis points: 1e4.** Round in favor of the vault. Use `ReentrancyGuard`, `Pausable`, `AccessControl` (roles: `ADMIN`, `KEEPER`, `GUARDIAN`). Custom errors, events for every state change.

### 7.1 `MarketClock`
- `now()` returns `block.timestamp + demoOffset`.
- `setDemoOffset(int256)` / `advance(uint256 seconds)`, **admin only, and only if `demoMode == true`**. `demoMode` is set at deploy and emitted. Show a banner in the UI whenever it is on.

### 7.2 `MarketSchedule`
- Weekly session table: for each weekday, `openSecondsUTC` and `closeSecondsUTC` (or "closed all day").
- `holidays`: admin-managed list of closed dates.
- `phaseAt(ts) returns (Phase phase, uint256 secondsToClose, uint256 secondsSinceOpen)`.
- Phases: `OPEN`, `PRE_CLOSE` (last `preCloseWindow` seconds before close), `CLOSED`, `REOPEN_COOLDOWN` (first `reopenCooldown` seconds after open).
- Default demo schedule: Mon–Fri open 14:30 UTC, close 21:00 UTC. `preCloseWindow = 3600`, `reopenCooldown = 900`. Document the DST limitation (schedule is fixed UTC; real deployments need a maintained calendar).

### 7.3 `IPriceFeed` and `MockPriceFeed`
```solidity
interface IPriceFeed {
    function latestPrice() external view returns (uint256 price1e8, uint256 updatedAt);
}
```
- `MockPriceFeed`: `setPrice(uint256)` by `KEEPER`/`ADMIN`, stores `updatedAt = clock.now()`.
- Optional helper `queueShock(int256 bps)` for the demo. No real-world price claims.
- Consumers must check staleness (`maxStaleness` per phase; closed-phase staleness is expected, so use the last official close as reference).
- Record `lastOfficialClosePrice` when the phase transitions OPEN/PRE_CLOSE → CLOSED (set by a permissionless `checkpointClose()` once the phase is CLOSED).

### 7.4 `IRiskPolicy`
```solidity
enum Phase { OPEN, PRE_CLOSE, CLOSED, REOPEN_COOLDOWN }

struct RiskParams {
    Phase   phase;
    uint16  maxLeverageX100;       // 2000 = 20.00x
    uint16  initialMarginBps;      // >= 1e4 / maxLeverage
    uint16  maintenanceMarginBps;
    uint256 maxOpenInterestUsd;    // per side, 6 decimals
    uint256 maxPositionUsd;        // per trader
    uint16  fundingMultiplierBps;  // 10000 = 1x
    bool    reduceOnly;            // no new risk allowed
    uint16  deleverageTargetX100;  // leverage a position is cut to by deleverageToCap
}

interface IRiskPolicy {
    function getParams(uint256 ts) external view returns (RiskParams memory);
}
```
- `FlatRiskPolicy`: always returns the OPEN row (20x, no phase logic). This is the **naive baseline**.
- `MarketHoursRiskPolicy`: reads `MarketSchedule`, returns the row for the current phase (table in section 8).
- The two policies, `IRiskPolicy`, `MarketSchedule` and `MarketClock` are the **reusable open-source library** (section 12).

### 7.5 `LiquidityVault`
- LPs `deposit(amount)` / `withdraw(shares)` (withdrawals limited by free liquidity and locked exposure).
- Acts as the **counterparty to all traders at oracle price** (no order book, no price impact in the MVP; protected by OI caps).
- Tracks: `totalAssets`, `insuranceFund`, `badDebtTotal`, `realizedTraderPnl`.
- Receives fees. A set share goes to `insuranceFund`.
- `coverShortfall(amount)`: pays from insurance fund first, then vault assets, and increments `badDebtTotal` for any amount that reduces LP equity.
- Seed each vault with identical liquidity in the demo (for example 1,000,000 test USDC).

### 7.5b Fees
- Taker fee 6 bps of notional on open and close, to the vault. Liquidation penalty 1% of notional: half to keeper, half to insurance fund. Funding per section 8.4. All configurable.

### 7.6 `PerpMarket` (isolated margin only)
State per trader: `side (long/short)`, `sizeUsd`, `collateral`, `entryPrice`, `fundingIndexSnapshot`, `openedAt`.
One position per trader per market in the MVP.

External functions:
- `openPosition(side, collateral, leverageX100)`: checks allowlist is irrelevant here (chain-level), checks policy (`!reduceOnly`, leverage ≤ `maxLeverageX100`, IM, OI caps, position cap), fresh price, charges fee.
- `addMargin(amount)`, `removeMargin(amount)` (must still satisfy IM at current params).
- `decreasePosition(sizeUsd)`, `closePosition()`.
- `liquidate(trader)`: permissionless; callable when equity < maintenance margin; pays keeper reward; calls `vault.coverShortfall` if equity < 0.
- `deleverageToCap(trader)`: **callable by `KEEPER` (or permissionless, a design decision to record) only when phase is `PRE_CLOSE` within the final `deleverageWindow` (default 600s) or `CLOSED`/`REOPEN_COOLDOWN` is not allowed to prevent abuse of stale prices.** Reduces the position to `deleverageTargetX100` leverage using the current **open-market** price, no liquidation penalty (small fee only). Emits `Deleveraged`.
- `settleFunding()`: updates cumulative funding indices.
- `checkpointClose()`: records the close price once.
- `reopen()` / `endCooldown()`: handled implicitly by the schedule, but expose a view `isReopenGapExceeded()` (compare first post-open price to `lastOfficialClosePrice` against `gapThresholdBps`) for the UI and keeper.

Views for the UI: `getPosition`, `getEquity`, `getLeverage`, `getLiquidationPrice`, `getParams`, `getMarketStats` (OI long/short, vault equity, insurance fund, bad debt), `getPhase`.

**Events:** `PositionOpened`, `PositionChanged`, `PositionClosed`, `Liquidated`, `Deleveraged`, `MarginAdded/Removed`, `FundingSettled`, `PhaseObserved`, `BadDebtRecorded`, `CloseCheckpointed`.

### 7.7 Accounting invariants (write as Foundry invariant tests)
- Conservation: tokens held by market + vault = sum(trader collateral) + vault assets + insurance fund (no value created or lost, ignoring rounding dust ≤ 1 unit per operation).
- A position never has `leverage > maxLeverage` at the time of opening or after `removeMargin`.
- `badDebtTotal` only increases through `coverShortfall`.
- Guarded market in a gap ≤ 20% with all positions deleveraged to ≤ 5x: `badDebtTotal == 0`.

---

## 8. Risk model specification (put the math in `docs/RISK_MODEL.md`)

### 8.1 Position math
- `notional N` (USDC), side `s = +1` long / `-1` short, entry `P0`, current `P`, collateral `C`.
- `PnL = s × N × (P − P0) / P0`
- `equity = C + PnL − accruedFunding − fees`
- `leverage = N / equity`
- Liquidatable when `equity < maintenanceMarginBps × N`.
- Long liquidation price ≈ `P0 × (1 − (C − MM×N − costs) / N)`; short is the mirror. Implement exactly and test against the formula.

### 8.2 Policy parameter table (all values are constants in one config; tune later)

| Phase | Max leverage | Initial margin | Maintenance margin | OI cap (per side) | Funding mult | Mode |
|---|---|---|---|---|---|---|
| OPEN | 20x | 5% | 2.5% | 100% of base | 1x | normal |
| PRE_CLOSE | linear 20x → 5x over the window | 1/maxLev | IM/2 | linear 100% → 40% | 1x → 2x | no new risk above the ramp cap |
| CLOSED | 5x | 20% | 6% | 40% | 2x | over-cap positions reduce-only |
| REOPEN_COOLDOWN | 5x | 20% | 6% | 40% | 2x | reduce-only; liquidations active; ramp back to OPEN values after cooldown |

`deleverageTargetX100 = 500` (5x) in PRE_CLOSE and later phases. `FlatRiskPolicy` returns the OPEN row in every phase.

### 8.3 Deleveraging logic
In the final `deleverageWindow` before close, any position with leverage above the closed-market cap may be cut to the cap at the current open-market price. The point: realize the risk reduction at a trustworthy price **before** the gap, not by liquidation after it.

### 8.4 Funding (MVP, keep simple)
- `skew = (OI_long − OI_short) / maxOI`; `rate_per_hour = clamp(k × skew, ±maxRate) × fundingMultiplier`.
- The heavier side pays the lighter side (via cumulative funding indices); the vault is counterparty to the net skew. Document the simplification.

### 8.5 Re-open procedure
1. First price update after open: compute `gapBps = |P_open − lastOfficialClose| / lastOfficialClose`.
2. Enter `REOPEN_COOLDOWN` (reduce-only). Liquidations are enabled against the new official price.
3. Shortfalls: insurance fund first, then vault (recorded as bad debt).
4. After `reopenCooldown`, params ramp back to OPEN. If `gapBps > gapThresholdBps` (default 1000 = 10%), keep the cooldown until an admin or guardian calls `extendCooldown(duration)` (bounded).

---

## 9. Mock oracle and simulated clock (what is real and what is not)

- **Simulated:** the price feed (`MockPriceFeed`), the clock offset (`MarketClock`), and the weekend shock. Everything else (contracts, ICTT, allowlist, L1) is real and deployed.
- Reference price in the demo: 4,150.00 (8 decimals: `415000000000`). It is a placeholder, not a market quote.
- The `/demo` page and README must say: "Price feed and clock are simulated for demonstration. A production deployment needs a real oracle and a maintained market calendar."
- Everything touching the feed goes through `IPriceFeed` so a real adapter can replace the mock without changing the market.

---

## 10. Keeper service (`services/keeper`, TypeScript + viem)

Responsibilities, each in its own module with a dry-run flag:
1. **Phase watcher:** polls `getPhase` on both markets, logs transitions.
2. **Deleverager:** during the deleverage window, finds positions above target and calls `deleverageToCap`.
3. **Liquidator:** scans positions and calls `liquidate` when eligible.
4. **Price pusher:** pushes mock prices (steady-state random walk with small steps, or a scripted value).
5. **Scenario runner:** CLI `scenario:weekend-gap` runs the deterministic demo (section 13) against both markets and writes `results/weekend-gap.json` plus a printed table.
6. **Funder:** `fund-trader <address>` sends gas token on the L1 to approved addresses.

Config via env vars (section 16). Keeper EOA must be allowlisted on the L1. Log every transaction hash.

---

## 11. Web app (`apps/web`: Next.js + TypeScript + wagmi + viem + Tailwind + recharts)

Two chains configured as custom chains: Fuji C-Chain and the Nyxor L1. Wallets: Core and MetaMask. Handle chain switching and wrong-chain states gracefully.

**Design direction:** dark "night" theme (deep navy/near-black, violet and soft cyan accents), monospace numbers, calm and serious (this is risk software). A **phase pill** is the hero element: OPEN (green), PRE-CLOSE (amber), CLOSED (violet), REOPEN (blue), with a countdown. Show a persistent **"SIMULATED CLOCK / PRICE"** banner when `demoMode` is on.

**Pages**
1. `/` Landing: tagline, 3-step explanation of the problem (scoreboard analogy), link to the demo. Keep it short.
2. `/bridge`: shows balances on both chains; **Deposit**: approve, lock on Fuji via TokenHome, show relayer progress, and the wrapped balance appearing on the L1. Show tx links for both chains. Withdraw only if implemented (stretch).
3. `/trade`: market selector (Guarded / Standard). Phase pill and countdown. Leverage-cap gauge (current max leverage vs. time). Open/close position form (rejections explain *why*, for example "Max leverage is 7.5x in the pre-close window"). Position card: equity, leverage, margin ratio, liquidation price, margin-call banner when above the cap. Add/remove margin.
4. `/demo` (the demo console):
   - Clock controls: "Jump to Friday 14:00", "Advance 10 min", "Go to close", "Go to Monday open".
   - Price controls: "Apply gap shock −8%", custom bps.
   - **"Run weekend scenario"** button (calls the keeper or runs scripted transactions), plus a side-by-side panel for Standard vs. Guarded: vault equity, insurance fund, bad debt, liquidations, positions deleveraged. A recharts timeline of price and phase.
5. `/admin`: allowlist management via the precompile interface (add/remove address), keeper/relayer status, risk parameters (read-only table), pause.

**UX rules:** every transaction shows pending/confirmed/failed with an explorer link; amounts are formatted with units; no jargon without a tooltip. The L1 explorer base URL is a config value (fallback: show hash + RPC).

Read data with viem calls and `getLogs`; no indexer needed.

---

## 12. Shared SDK and the reusable open-source library

- `packages/sdk`: ABIs generated from Foundry output, typed viem clients, chain definitions, address loader reading `deployments/*.json`. No hard-coded addresses.
- **`packages/risk-policy` (or `contracts/src/policy` published as its own folder with a README):** `IRiskPolicy`, `MarketSchedule`, `MarketClock`, `FlatRiskPolicy`, `MarketHoursRiskPolicy`, with tests and a short "how to plug this into your own perps market" guide. This is the "open-source something reusable" bonus. License: MIT.

---

## 13. Deterministic demo scenario (must be reproducible)

**Setup (both markets, identical):** vault seeded with 1,000,000 test USDC. Reference price 4,150.00. Simulated clock: Friday, 2 hours before close.

**Traders (mirror the same trades on both markets):**
| Trader | Side | Collateral | Leverage | Notional |
|---|---|---|---|---|
| T1 | Long | 10,000 | 20x | 200,000 |
| T2 | Long | 5,000 | 20x | 100,000 |
| T3 | Long | 8,000 | 10x | 80,000 |
| T4 | Short | 6,000 | 10x | 60,000 |
| T5 | Long | 4,000 | 15x | 60,000 |

**Timeline**
1. OPEN: all five positions opened on both markets (allowed on both).
2. PRE_CLOSE (T−60 min): on Guarded, the leverage cap starts ramping. An attempt by T6 to open a fresh 20x long is **rejected** on Guarded with a clear reason and **accepted** on Standard.
3. Final 10 minutes: the keeper deleverages Guarded positions above 5x to 5x at the open-market price. Standard does nothing.
4. CLOSED: weekend. `checkpointClose()` records the close price.
5. Monday open: apply a **−8%** gap to the mock price (4,150 → 3,818).
6. Outcome to show:
   - Standard: the 20x and 15x longs lose more than 100% of collateral. **Bad debt appears**, and vault equity drops by the shortfall.
   - Guarded: no position exceeds 5x at close, so an 8% gap costs at most 40% of collateral. **No bad debt**, no liquidations, vault equity unchanged apart from fees.
7. Run a second, harsher variant (−25%) and show that Guarded also takes bad debt but much less. Be honest: the guard reduces the damage, it does not remove it.

Record exact numbers from the actual run in `results/` and `docs/DEMO_SCRIPT.md`. **Do not hard-code expected outputs in the UI; read them from chain.**

---

## 14. Testing strategy

- **Unit tests (Foundry):** position math, margin checks, funding, liquidation price, schedule phases (including week boundaries, holidays), policy ramp values at specific times.
- **Fuzz/invariant tests:** the conservation invariant, no over-leverage openings, monotonic bad debt.
- **Scenario test:** the full weekend-gap scenario in `forge test`, asserting Standard bad debt > 0 and Guarded bad debt == 0 for the −8% case.
- **ICTT tests:** Foundry harness / Interchain Kit local network first (round trip), then Fuji.
- **Keeper tests:** dry-run mode against a local anvil/L1 fork.
- **Web:** type-check, lint, and a Playwright smoke test for the bridge and trade flows if time allows.
- CI (GitHub Actions): `forge build && forge test`, `pnpm -r build`, lint.

---

## 15. Deployment runbook (order matters)

1. **Local first:** boot a local Avalanche network with an L1, Teleporter and relayer (Interchain Kit one-command network is documented for this). Get the ICTT round trip and the allowlist working locally.
2. Create the L1 on Fuji (avalanche-cli or Builder Console). Configure genesis: chain ID, gas token alloc, TxAllowList (admin = deployer; enable relayer, keeper), fee config. Fund validator balance from the faucet.
3. Deploy the ICTT pair: test USDC (or Circle test USDC from the Circle faucet for Fuji) → `ERC20TokenHome` on Fuji → `ERC20TokenRemote` on the L1 → register the remote. Start the ICM relayer (both directions). **Check decimals** (USDC is 6; the docs example used 18 so wrapped and underlying scale 1:1; confirm 6-decimal handling or use a custom 6-decimal demo token).
4. Deploy core contracts on the L1: clock, schedule, feed, policies, two vaults, two markets. Write addresses to `deployments/nyxor-l1.json`; ICTT addresses to `deployments/fuji.json`.
5. Verify contracts on Snowtrace (C-Chain) and on the L1's explorer if one is available.
6. Seed vaults, fund demo traders, start the keeper, run the scenario end to end, capture results.
7. Deploy the web app (Vercel or similar) with `NEXT_PUBLIC_*` env vars. Test with a fresh wallet.
8. Record the demo video. Update the README with real addresses and links.

---

## 16. Repo structure, tooling, environment

```
nyxor/
├─ AGENTS.md                  (this file)
├─ README.md
├─ contracts/                 Foundry project
│  ├─ src/{core,policy,oracle,vault,interfaces}/
│  ├─ test/                   unit, fuzz, invariant, scenario
│  └─ script/                 deploy scripts
├─ packages/{sdk,risk-policy}/
├─ apps/web/
├─ services/keeper/
├─ ops/{l1,relayer,ictt}/     genesis template, relayer config template, runbooks
├─ deployments/{fuji.json,nyxor-l1.json}
├─ results/                   scenario outputs
└─ docs/{ARCHITECTURE,RISK_MODEL,DEMO_SCRIPT,DECISIONS,LIMITATIONS}.md
```

- Package manager: pnpm workspaces. Solidity ^0.8.24, Foundry, OpenZeppelin v5, TypeScript strict, viem, wagmi, Next.js, Tailwind, recharts. **Pin exact versions** and record them.
- `.env.example` (never commit real values): `FUJI_RPC_URL`, `L1_RPC_URL`, `L1_CHAIN_ID`, `DEPLOYER_PRIVATE_KEY`, `KEEPER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`, `NEXT_PUBLIC_FUJI_RPC`, `NEXT_PUBLIC_L1_RPC`, `NEXT_PUBLIC_L1_CHAIN_ID`, `NEXT_PUBLIC_L1_EXPLORER_URL`, `NEXT_PUBLIC_DEMO_MODE`.
- Use dedicated throwaway testnet keys. Never reuse a mainnet key.

---

## 17. Security, honesty and limitations

- Unaudited demo code. Testnet only. State this in the README.
- Access control: `ADMIN`, `KEEPER`, `GUARDIAN`; demo-mode functions revert when `demoMode == false`.
- Oracle: staleness checks, bounds on single-update moves outside the shock helper, and a pause.
- Reentrancy guards on all token-moving functions; checks-effects-interactions.
- Known simplifications to list in `docs/LIMITATIONS.md`: mock oracle and clock; fixed-UTC schedule (no DST handling, manual holiday list); vault-as-counterparty at oracle price with no price impact; isolated margin only; simplified funding; one position per trader; no ADL; relayer is a single point of failure in the demo; the L1 validator set is run by the builder.
- Never claim real-market prices, real volume or regulatory approval. Do not present this as a product for real users.

---

## 18. Milestones and acceptance criteria (30 days)

**Week 1: de-risk the stack**
- Local network: ICTT ERC-20 round trip works. Allowlist works locally.
- Empty L1 live on Fuji with allowlist and funded validator.
- Foundry repo with `MarketSchedule` + tests.
*Done when:* a script moves tokens C-Chain → L1 on the local network and the L1 exists on Fuji.

**Week 2: core engine**
- `PerpMarket`, `LiquidityVault`, `IRiskPolicy` + both policies, mock feed, clock, unit + fuzz tests.
*Done when:* scenario test passes locally (Standard bad debt > 0, Guarded == 0 at −8%).

**Week 3: integrate**
- ICTT deposit on Fuji, allowlist enforced for trading, contracts deployed to the L1, keeper working, web app Bridge + Trade pages.
*Done when:* a fresh allowlisted wallet deposits from Fuji and opens a position on the L1 via the UI, and a non-allowlisted wallet is rejected.

**Week 4: ship**
- Demo console, scenario results recorded from the real deployment, README, docs, video, public repo. Stretch items only if everything above is stable.
*Done when:* the full 3-minute demo runs start to finish on Fuji without manual fixes, twice in a row.

**Cut order if behind:** mainnet → UI polish → KYC precompile (keep the plain allowlist) → withdrawals → second market. **Never cut:** the risk engine, the L1, the deposit flow, the Standard vs. Guarded comparison.

---

## 19. Demo (3 minutes) and submission checklist

**Demo script**
1. (0:00–0:20) Problem: the scoreboard-off analogy plus one sentence on RWA perps.
2. (0:20–1:10) Entry: a non-approved wallet is rejected on the L1; an approved wallet deposits USDC on Fuji, wrapped USDC appears on the L1 (show both tx links; pre-fund and pre-run one deposit to avoid relayer wait).
3. (1:10–2:30) Standard vs. Guarded: same positions, pre-close ramp, the rejected 20x attempt on Guarded, keeper deleveraging, weekend jump, −8% gap, bad debt on Standard, none on Guarded, vault balances side by side.
4. (2:30–3:00) Close: what is real, what is simulated, the reusable library, what's next (real oracle, real calendar).

**Submission checklist:** project name + one-liner · full description (what/who/problem) · tech stack with Avalanche-specific parts called out (L1, TxAllowList, ICTT, relayer) · live link + contract addresses (Fuji and L1) · public repo · video ≤ 3 minutes · AI tools used and for what · statement that all work is new.

**Hooks for README/social:** "The market closes on Friday. Your risk shouldn't." · "A members-only chain for 24/7 stock trading." · "Who pays when Monday gaps?"

---

## 20. VERIFY FIRST: facts to confirm in current docs before coding

Docs entry points: Avalanche docs and Builder Hub (`build.avax.network`), academy (`docs.avax.network/academy`), ICTT/Interchain tooling pages, Interchain Kit docs, the native-token-bridge course.

1. Current flow to create an L1 on Fuji (avalanche-cli or Builder Console), including validator manager setup and validator balance funding. Note: docs mention a **Helicon upgrade** that reached mainnet on Sept 22, 2026; check whether it changes tooling versions or steps.
2. Subnet-EVM version, genesis JSON keys for the **TxAllowList** and **FeeManager** precompiles, and their precompile addresses (believed to be fixed addresses of the form `0x0200…0002` for TxAllowList, but **confirm**).
3. Allowlist behavior with the relayer and keeper addresses (do they need to be enabled?).
4. ICTT: current `ERC20TokenHome` / `ERC20TokenRemote` deployment steps, remote registration, and **decimals handling for a 6-decimal token**.
5. ICM relayer and signature aggregator: current install method, config format, funding requirements, and running it in both directions.
6. Whether an explorer exists for the L1 (and how to verify contracts there).
7. Circle test USDC on Fuji (faucet and contract address) vs. a custom demo token.
8. `@avalanche-sdk/interchain` ICTT client API (the docs show: deploy token → deploy home → deploy remote → register → approve → send).
9. Faucet limits for test AVAX and how much the L1 validator needs.
10. Wallet support for adding a custom L1 (Core and MetaMask) in wagmi.

Record each answer in `docs/DECISIONS.md` with the doc link.

---

## 21. Open items and extra constraints from the builder

> **[PLACEHOLDER]** The builder will add their own constraints and priorities here (for example team size, deadlines, preferred libraries, things to avoid, mandatory features). **If this section is empty, ask the builder before making large decisions.** Constraints written here override anything above when they conflict.

---

## 22. Glossary (plain words)

- **Perp (perpetual future):** a bet on an asset's price with leverage and no expiry date.
- **Leverage:** borrowing to take a bigger position; 20x means a 5% move wipes out your collateral.
- **Margin / collateral:** your money backing the position.
- **Liquidation:** the system closes a position when losses approach your collateral.
- **Gap:** the price jumps from one level to another with no trades in between, so liquidation can't happen at intermediate prices.
- **Bad debt:** losses larger than the collateral; someone else has to pay.
- **Insurance fund:** a reserve that absorbs bad debt before liquidity providers do.
- **ICTT:** Avalanche's built-in way to move tokens between chains without a third-party bridge.
- **L1:** your own Avalanche chain with its own rules.
- **Precompile (TxAllowList):** a chain-level rule, here limiting who may send transactions.
