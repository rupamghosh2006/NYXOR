# Nyxor Protocol — Project Context & Handoff Specification

> **Reconstructed from:** Claude conversation transcript (`a6aaf9bc-e83f-411a-9724-544f095859bd`, "Avalanche speedrun project planning") and the live repository codebase at commit `8962d3e`.

---

## 1. Executive Summary & Current Project State

Nyxor is an open-source, market-hours-aware **risk parameter engine and isolated-margin perpetual futures risk layer** (not an exchange) built on Avalanche for the **Build Anything on Avalanche Speedrun Hackathon**.

### What the Project Currently Does
- **The Core Problem:** Perpetual futures on real-world assets (stocks, equities, commodities) trade 24/7 on-chain, but real-world reference markets close on nights, weekends, and holidays. When markets reopen on Monday with a gap (e.g., −8% or −20%), continuous liquidation paths fail: trader losses blow past collateral into negative equity, creating protocol bad debt absorbed by liquidity providers.
- **The Solution:** A schedule-aware risk policy (`MarketHoursRiskPolicy`) that transitions through 4 phases:
  1. `OPEN`: Normal 20.00x leverage, 2.50% maintenance margin (MM), 100% open interest (OI) cap.
  2. `PRE_CLOSE` (Final 60 mins of Friday): Max leverage linearly tightens from 20x down to 5x; MM held constant at 2.50%; keepers execute `deleverageToCap` at the fair active Friday price during the final 10-minute window.
  3. `CLOSED` (Weekend / Holidays): 5.00x max leverage, reduce-only mode, 6.00% MM, doubled funding rate.
  4. `REOPEN_COOLDOWN` (15 mins Monday open): First verified price print registered, liquidations processed against opening price before restoring standard limits.
- **Twin Benchmark Architecture:** The protocol deploys twin markets and vaults on Avalanche Fuji C-Chain:
  - **Standard Market (`FlatRiskPolicy`):** Naive 24/7 flat 20x leverage venue.
  - **Guarded Market (`MarketHoursRiskPolicy`):** Nyxor schedule-aware risk engine.
- **Verified Fuji Benchmark Outcomes (Chain ID: 43113):**
  - **Standard Market:** Trader 1's 20x long suffers an −8% Monday gap shock, blowing through $10,000 collateral into **$7,487.26 USDx** ($7,487,256,111 raw units) of negative equity bad debt.
  - **Guarded Market:** Deleveraged by keeper to 5.00x before Friday close; Monday equity is $6,000.00 > $3,000.00 MM requirement. **0 liquidations, $0.00 bad debt**, 100% LP solvency preserved.
  - **Token Conservation:** `balanceOf(PerpMarketStandard) == 14,000.00 USDx` (exact collateral of T2 & T3; zero stranded tokens); `balanceOf(Vault) == 509,204.00 USDx` ($= \text{vaultAssets } 509,204 + \text{insuranceFund } 0$).

---

## 2. Chronological Progression of the Project

1. **Ideation & Scoping (Messages 0–39):**
   - User presented the Avalanche Speedrun brief (30 days total, reduced to 8 days remaining).
   - Analyzed previous cycle winners (agent commerce: ChainPe, Latch, Gatekeep).
   - Identified DeFi gap: lack of RWA perps on Avalanche due to off-market gap risk.
   - Conceptualized Nyxor: a risk layer for RWA perps with market-hours awareness.
   - Master prompt generated and stored as `AGENTS.md`.

2. **Phase 1: Clock & Schedule Foundation (Messages 40–47):**
   - Created `MarketClock.sol` with demo timestamp offsets.
   - Implemented `MarketSchedule.sol` using Howard Hinnant's Gregorian calendar algorithm (`civil_from_days`) in pure Solidity.
   - Implemented `MockPriceFeed.sol` and `FlatRiskPolicy.sol`.
   - 42 tests passing.

3. **Phase 2: Risk Engine & Liquidity Vaults (Messages 48–53):**
   - Implemented `PerpMarket.sol` (isolated margin, 6 bps taker fee, 50 bps keeper reward, 50 bps insurance fee).
   - Implemented `LiquidityVault.sol` (LP assets, shares, segregated insurance fund).
   - **Key Architectural Bug Spotted:** Ramping MM from 2.5% to 6% during `PRE_CLOSE` prematurely liquidated healthy 20x positions before keepers could deleverage them. Fixed by holding MM constant at 2.50% during `PRE_CLOSE` and stepping to 6.00% only at `CLOSED`.
   - 68 tests passing.

4. **Phase 3: Hardening, Funding Rates & L1 Research (Messages 54–63):**
   - Added hourly funding rate mechanism based on open interest skew with doubled multiplier during `CLOSED`.
   - Allowed positions to close during `CLOSED` phase at official Friday close price.
   - Researched Subnet-EVM L1 feasibility: confirmed native `avalanche-cli` does not support Windows and entered maintenance mode in Dec 2025; running local/Codespace validators halts on sleep/timeout; cloud managed nodes expire in 72h–5d.
   - **Gate Decision:** Focus 100% on Avalanche Fuji C-Chain; treat Subnet L1 as future roadmap.
   - 87 tests passing.

5. **Phase 4: Fuji Deployment & Web Dashboard (Messages 64–67):**
   - Deployed initial contracts to Fuji C-Chain.
   - Built Next.js web application (`apps/web`) with Tailwind, Wagmi/Viem, and public RPC failover.
   - 100 tests passing.

6. **Phase 5: The Audit & Reconciliation Crisis (Messages 68–77):**
   - Advisor Claude audited claimed on-chain bad debt numbers.
   - Coding agent admitted earlier report figures (16,285 and 9,326 USDx) were conflated across multiple unverified iterations.
   - Decoded raw chain events: proved $16,287.02 was cumulative across 2 script broadcasts (Tx `0xed882a...` on block 59332558 and an earlier run on block 59330044).
   - Script restructured: created `RunScenarioClean.s.sol` for a single-pass atomic run, and `DeployDemo.s.sol` to separate frozen benchmarks from fresh interactive demo instances.

7. **Phase 6: The Token Leak & Final Accounting Fix (Messages 78–79 & Commit `8962d3e`):**
   - Single-pass clean run yielded 9,446.42 USDx bad debt on Standard.
   - **Advisor Claude identified a core accounting leak:** `PerpMarketStandard` held 21,487.22 USDx, leaving 7,487.22 USDx stranded in the contract because `coverShortfall` paid tokens that were not owed, and liquidation fee policies were conflated with uncollectible trader debt.
   - **Fix Implemented in Commit `8962d3e`:**
     - `badDebtTotal` redefined strictly as uncollectible trader negative equity ($\sum \max(0, -\text{Equity}) = \mathbf{7,487.26\text{ USDx}}$).
     - `recordBadDebt` made counter-only (no token transfer).
     - Keeper reward ($1,000 USDx) paid directly from vault/insurance reserves to liquidator.
     - Exact two-sided conservation invariants enforced (`balanceOf(market) == sum(collateral)` and `balanceOf(vault) == vaultAssets + insuranceFund`).
     - Added short-side stress test (+8% gap against 20x short; guarded position survives with 0 bad debt).
     - Redeployed and executed clean scenario on Fuji (`0xDD38265C...`).
     - **All 103 Foundry tests pass.**

---

## 3. Architecture & Technical Specifications

### Contracts Overview (`contracts/src/`)
| Contract | Purpose | Key Details |
|---|---|---|
| `DemoUSDC.sol` | Margin asset | ERC-20, 6 decimals, public `mint()`. |
| `MarketClock.sol` | Time oracle | Normal timestamp or `effectiveNow = block.timestamp + demoOffset` in `demoMode`. |
| `MarketSchedule.sol` | Calendar & sessions | Pure Solidity Gregorian calendar (Hinnant algorithm). Evaluates session phases (`OPEN`, `PRE_CLOSE`, `CLOSED`, `REOPEN_COOLDOWN`). |
| `MockPriceFeed.sol` | Price oracle | 8 decimals. Supports `setPrice`, `checkpointClose`, and `queueShock(int256 bps)`. |
| `FlatRiskPolicy.sol` | Baseline policy | Static 20.00x max leverage, 2.50% MM, 1.0x funding multiplier. |
| `MarketHoursRiskPolicy.sol` | Guarded risk policy | Schedule-dependent dynamic limits, linear pre-close ramp down to 5x. |
| `PerpMarket.sol` | Derivatives engine | Isolated margin, position tracking, PnL, funding accrual, fee splits, `deleverageToCap`, permissionless `liquidate`. |
| `LiquidityVault.sol` | Counterparty liquidity | LP deposits/withdrawals, share pricing against `vaultAssets`, segregated `insuranceFund`, `recordBadDebt`, `payKeeperReward`, epoch-based recapitalization. |

### Network Configuration
- **Network:** Avalanche Fuji Testnet (C-Chain)
- **Chain ID:** `43113` (`0xa869`)
- **RPC URL:** `https://api.avax-test.network/ext/bc/C/rpc` (with fallback to `https://avalanche-fuji-c-chain-rpc.publicnode.com`)
- **Block Explorer:** `https://testnet.snowscan.xyz` (Routescan API)
- **Deployer / Admin Address:** `0x4AD14e89622A046803988213E4a9846756531086`

### Deployed Contract Instances

#### Active Frozen Benchmark (`deployments/fuji-benchmark.json`)
*Permanent on-chain audit record of the executed weekend-gap scenario.*
- `DemoUSDC`: `0x03933052aC03983e37a1C3E0c1cE9DD78787E4f2`
- `MarketClock`: `0x5e050a5b66E128ceF2bD9bd0cc4f2b400136fc13`
- `MarketSchedule`: `0x57231418E1F58059Ef53aC8E364499264BA69aBF`
- `FlatRiskPolicy`: `0xeAe1e4E4531d1AAD7dCF6efB28aA42ecDCDF048F`
- `MarketHoursRiskPolicy`: `0x3BA8a766880fC8e8074EBCc3A23a2e67d3423871`
- `MockPriceFeedStandard`: `0x68Edd9Ae0DD51a56027Db8A67d3726a827D21634`
- `MockPriceFeedGuarded`: `0x983Da40dB7B35A0Cac08f8De5fcf629520322C44`
- `LiquidityVaultStandard`: `0xDD38265C1d66dCF067a24B1740895fDF5EA34f19` (Holds live **7,487.26 USDx** bad debt)
- `LiquidityVaultGuarded`: `0x5883F591C2eD45DC82FF9a551B4A00939eb84e2B` (Holds live **0.00 USDx** bad debt)
- `PerpMarketStandard`: `0xf8FEd93D1C351543195fB0D069ed31478Fc3C562`
- `PerpMarketGuarded`: `0x5db927AB629d0304C312e65F3a66D88938012E52`

#### Fresh Demo Instance (`deployments/demo-latest.json`)
*Untouched, funded deployment ready for live recording & video demonstration.*
- `DemoUSDC`: `0x135aFE4842964D78FD3eF55A016Ac5561Ddd89e3`
- `MarketClock`: `0x4A3f27718DE4b836ebC87c8B2A77f11D0F164F21`
- `MarketSchedule`: `0x860dAd0B2A95A4BD7748D42FafB8134e89050414`
- `FlatRiskPolicy`: `0x5706a24B1A6c96079739DA1906588daB09BB767b`
- `MarketHoursRiskPolicy`: `0x26525b45b1eC201B069c5289298F63E71e91EE8A`
- `MockPriceFeedStandard`: `0x369E3078E5b49719FfC320C7d8E4ecb54653BF86`
- `MockPriceFeedGuarded`: `0x9E70BA7fD8f6E2C6fDD633c294959372dFE4e5BA`
- `LiquidityVaultStandard`: `0x6b113f722361fE76c51e512cfa2d0a39afB7CE5B`
- `LiquidityVaultGuarded`: `0x6324Ed0576efDBe8Ed064e2d17B21E5D71d69F53`
- `PerpMarketStandard`: `0x50Da3bAa03bDa3C18b532B7B8B346b27D1D48837`
- `PerpMarketGuarded`: `0xA6faFFdD2D82b40F0Cd92E3960F23FC25042B171`

#### Superseded Deployments (Historical Audit Trail Only)
1. `0x4c38297282959b86482b10d59210c3f2df84B659` (Old cumulative run: $16,287.02 USDx bad debt)
2. `0x7f758330d60bd3B51E94B2582e4c05DFAbE765F8` (Old leak accounting: $9,446.42 USDx bad debt with stranded tokens)

### Web Application Architecture (`apps/web`)
- **Framework:** Next.js 14.2.15 / React 18 / TypeScript / Tailwind CSS.
- **Web3 Stack:** Viem 2.21.26, Wagmi 2.12.17, TanStack Query 5.59.0.
- **Self-Contained Deployment:** Reads configuration directly from `src/deployments/` without external symlinks.
- **Components:**
  - `PhaseHero.tsx`: Dynamic phase badge with real-time countdown to session close/open.
  - `ComparisonPanel.tsx`: Side-by-side standard vs guarded solvency metrics.
  - `RecordedRun.tsx`: Displays the frozen on-chain benchmark run and ordered transaction log.
  - `TradingPanel.tsx`: Interactive isolated margin order placement and position monitor.
  - `AdminConsole.tsx`: Demo time-travel and gap shock controls.

---

## 4. Finalized Decisions & Known Bugs / Discrepancies

### Finalized Decisions
1. **Primary Deployment Target:** Avalanche Fuji C-Chain. Subnet L1 requires persistent validator DevOps; documented in `docs/L1_RESEARCH.md`.
2. **Gregorian Calendar Arithmetic:** Howard Hinnant algorithm (`civil_from_days`) implemented in Solidity without external libraries.
3. **PRE_CLOSE MM Policy:** Held flat at 2.50% during `PRE_CLOSE` to prevent premature liquidations, stepping to 6.00% in `CLOSED`.
4. **Rounding Principles:** Leverage floor, initial margin ceil, OI floor, funding multiplier ceil.
5. **Exact Two-Sided Invariants:**
   - $\text{balanceOf}(\text{Market}) == \sum \text{Collateral of open positions}$
   - $\text{balanceOf}(\text{Vault}) == \text{vaultAssets} + \text{insuranceFund}$
6. **Bad Debt Definition:** Defined strictly as uncollectible trader negative equity ($\text{Deficit} = \sum \max(0, -\text{Equity})$), which is $7,487.26 USDx on the benchmark run.

### Discrepancies & Stale Documentation Identified
1. **`README.md`:**
   - Section 5 lists stale superseded addresses (`0x400D575b...` from `fuji.json`).
   - Section 7 lists stale cumulative bad debt ($16,287.02) and old transaction receipts.
   - Section 9 and 11 report "100 tests passed" (actual count is now **103 passed**).
   - Section 10 contains an empty placeholder for AI tools.
2. **`apps/web/src/app/page.tsx`:**
   - Line 298 button label says `Frozen Benchmark (Scenario Recorded — 9,446.42 Unbacked Loss)`. Should be updated to `7,487.26 USDx Loss Beyond Collateral`.
3. **`docs/LIMITATIONS.md §4`:**
   - Free-option vulnerability during `CLOSED` phase remains an unmitigated architectural tradeoff in the MVP (traders can close at Friday's price on the weekend if bad news breaks). Disclosed honestly in docs.

---

## 5. Prioritized Next Steps

1. **Clean Up Documentation & UI Labels (Immediate / 10 mins):**
   - Update `README.md` Section 5 with active frozen benchmark addresses.
   - Update `README.md` Section 7 with the verified $7,487.26 reconciliation and the new receipt hashes from `deployments/fuji-scenario.json`.
   - Update test count in `README.md` from 100 to 103.
   - Fill in Section 10 of `README.md` (AI Tools disclosure: Google Antigravity / Claude).
   - Update `page.tsx` line 298 button label to `7,487.26 USDx`.
2. **Deploy Web Dashboard to Vercel (High Priority / 15 mins):**
   - Deploy `apps/web` to Vercel.
   - Verify all live reads work over public Avalanche RPC in a private/incognito browser window.
3. **Record Video Demonstration (High Priority / 30 mins):**
   - Connect to the **Fresh Demo Instance** (`demo-latest.json`).
   - Demonstrate:
     1. Normal trading during `OPEN` phase.
     2. Time travel to `PRE_CLOSE` and keeper deleveraging.
     3. Weekend close checkpoint.
     4. Monday reopen gap shock (−8%).
     5. Contrast standard bad debt vs guarded LP protection.
4. **Final Hackathon Submission Checklist:**
   - GitHub public repository URL.
   - Live Vercel dashboard URL.
   - 3-minute Loom / YouTube demo video.
   - Submission text quoting verified $7,487.26 vs $0.00 outcome.
