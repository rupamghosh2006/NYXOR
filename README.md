# Nyxor Protocol

> **The market closes on Friday. Your risk shouldn't.**  
> An open-source, market-hours-aware **risk layer** for Real-World Asset (RWA) perpetual futures on Avalanche.

---

## 1. What Nyxor Is (and What It Is Not)

- **What it IS:** A modular, schedule-aware risk parameter engine and isolated-margin perpetual risk layer. It automatically adjusts leverage limits, maintenance margin thresholds, open interest caps, and funding rates based on real-world reference market sessions. It incorporates automated pre-close deleveraging at fair open-market prices to protect liquidity providers against weekend gap shocks.
- **What it IS NOT:** Nyxor is **not an exchange**, not an order book, not an AMM, and not a token project. It is infrastructure designed to be integrated into derivative protocols offering stock, index, and commodity synthetics.

---

## 2. The Problem: The Scoreboard Dilemma

Synthetic RWA perpetuals (stocks, equity indices, gold, commodities) trade 24/7 on crypto rails, but the real-world markets they track close for nights, weekends, and holidays.

Trading a stock perp over the weekend is like betting on a game while the stadium scoreboard is turned off. Nobody knows the real score until Monday morning. When the traditional exchange reopens, news accumulated over the weekend can cause the spot price to **gap** violently over liquidation levels:
1. **Liquidations require continuous price paths:** Traditional on-chain liquidation engines assume liquidators can catch underwater positions as prices cross maintenance thresholds.
2. **Weekend gaps jump over thresholds:** A sudden −8% or −20% Monday open gaps directly past collateral.
3. **Losses exceed margin:** Trader equity drops deep into the negative. The resulting **bad debt** is absorbed directly by liquidity providers or the protocol vault.

---

## 3. The Nyxor Solution: Phase-Aware Risk Engine

Nyxor eliminates gap-induced insolvencies by dynamically transitioning between four distinct operating phases:

```
 Monday 14:30 UTC              Friday 20:00 UTC     Friday 21:00 UTC           Monday 14:30 UTC     Monday 14:45 UTC
      ┌──────────────────────────────┬──────────────────┬─────────────────────────────┬────────────────────┬───────────►
      │            OPEN              │    PRE_CLOSE     │           CLOSED            │  REOPEN_COOLDOWN   │   OPEN
      │      Normal 24/7 (20x)       │  Linear 20x → 5x │    5x Cap, Reduce-Only      │  Liquidations On   │  Ramp to 20x
      └──────────────────────────────┴──────────────────┴─────────────────────────────┴────────────────────┴───────────►
                                     ▲                  ▲                             ▲
                             Ramp Starts        Keeper Deleveraging            Official Open Gap
                                                (Final 10 min window)          Settled Against Vault
```

1. **Pre-Close Linear Ramp (`PRE_CLOSE`):** Leverage caps linearly tighten from 20x down to 5x over the final 60 minutes before close. Open interest caps contract from 100% to 40%.
2. **Keeper Pre-Close Deleveraging:** During the final 10-minute window before market close, keeper bots systematically cut any over-cap position to the 5x closed-market cap at the **active, fair Friday market price**—eliminating excessive leverage *before* the scoreboard goes dark.
3. **Defensive Closed Regime (`CLOSED`):** Over the weekend, markets operate in `reduce-only` mode with higher maintenance margins (6.00%) and doubled funding rates.
4. **Controlled Reopening (`REOPEN_COOLDOWN`):** A 15-minute post-open cooldown registers the first verified opening print, processes liquidations against the opening price, and absorbs shortfalls before restoring standard 20x limits.

---

## 4. Architecture

```
                       Nyxor Protocol Architecture (Avalanche Fuji C-Chain)
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                                                                                        │
   │    MarketClock ─────────────────► MarketSchedule (UTC Weekly Sessions & Holidays)      │
   │         │                                      │                                       │
   │         ▼                                      ▼                                       │
   │    MockPriceFeed ──────────────────────► IRiskPolicy                                   │
   │    (8-decimal Oracle)                      ├── FlatRiskPolicy (Naive 20x Baseline)     │
   │                                            └── MarketHoursRiskPolicy (Guarded Engine)  │
   │                                                           │                            │
   │                                                           ▼                            │
   │    LiquidityVault ◄──────────────────────────────► PerpMarket                          │
   │    (LP Assets + Segregated Insurance Fund)         (Isolated Margin, Phase-Aware)      │
   │                                                                                        │
   └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Verified Avalanche Fuji Deployments (Chain ID: 43113)

All contracts are compiled with Solidity `0.8.24`, deployed to Avalanche Fuji C-Chain, and verified on Snowscan / Routescan:

| Contract | Address | Explorer Link |
|---|---|---|
| **PerpMarketGuarded** | `0x400D575b8BE7a395fBF4BC8161A4A454605730C7` | [Snowscan](https://testnet.snowscan.xyz/address/0x400D575b8BE7a395fBF4BC8161A4A454605730C7) |
| **LiquidityVaultGuarded** | `0x648b16f94C1ff3776368d8Bc067b5F8881ce6Cfd` | [Snowscan](https://testnet.snowscan.xyz/address/0x648b16f94C1ff3776368d8Bc067b5F8881ce6Cfd) |
| **MarketHoursRiskPolicy** | `0x820BE01587cfd1F9c6d46cB363f09D5c9Dcae974` | [Snowscan](https://testnet.snowscan.xyz/address/0x820BE01587cfd1F9c6d46cB363f09D5c9Dcae974) |
| **PerpMarketStandard** | `0x2268c8cB67e1cd78Ca4Ab254894BB5F5D1E23Fab` | [Snowscan](https://testnet.snowscan.xyz/address/0x2268c8cB67e1cd78Ca4Ab254894BB5F5D1E23Fab) |
| **LiquidityVaultStandard** | `0x4c38297282959b86482b10d59210c3f2df84B659` | [Snowscan](https://testnet.snowscan.xyz/address/0x4c38297282959b86482b10d59210c3f2df84B659) |
| **FlatRiskPolicy** | `0x4341D3A566AC6e0e51076B9fEf68EFE3ca5E047F` | [Snowscan](https://testnet.snowscan.xyz/address/0x4341D3A566AC6e0e51076B9fEf68EFE3ca5E047F) |
| **MarketClock** | `0x0269Fa1782f5Ed743486091900aa24eF1C8dCadA` | [Snowscan](https://testnet.snowscan.xyz/address/0x0269Fa1782f5Ed743486091900aa24eF1C8dCadA) |
| **MarketSchedule** | `0x3f5560b462Dc91339FAAeaCde7A0E98D26a20aAb` | [Snowscan](https://testnet.snowscan.xyz/address/0x3f5560b462Dc91339FAAeaCde7A0E98D26a20aAb) |
| **MockPriceFeedGuarded** | `0x66ac4aB263B69BE7003089BE185A202a9E981fCa` | [Snowscan](https://testnet.snowscan.xyz/address/0x66ac4aB263B69BE7003089BE185A202a9E981fCa) |
| **MockPriceFeedStandard** | `0x7F7b80959F30A06D3f066b8b63B065B02aD1A4D7` | [Snowscan](https://testnet.snowscan.xyz/address/0x7F7b80959F30A06D3f066b8b63B065B02aD1A4D7) |
| **DemoUSDC** | `0x802508DB190b1826c6fC4238B5172F344ba96811` | [Snowscan](https://testnet.snowscan.xyz/address/0x802508DB190b1826c6fC4238B5172F344ba96811) |

---

## 6. What Is Simulated vs. What Is Real

- **Simulated:**
  - **Oracle Feed (`MockPriceFeed`):** Price updates, frozen official close checkpoints, and gap shock percentages are simulated because real testnet feeds cannot reliably produce an arbitrary −8% weekend gap on demand.
  - **Market Clock (`MarketClock`):** In `demoMode == true`, authorized admin keys can warp timestamps across session boundaries to demo Friday closes and Monday opens without waiting days.
  - **Weekend Shock:** The −8.00% weekend gap shock is injected via `queueShock(-800)`.
- **Live On-Chain (100% Real):**
  - All smart contracts, isolated margin position logic, equity calculations, and dynamic policy parameter ramps.
  - Pre-close deleveraging algorithm and permissionless liquidation engines.
  - Dual liquidity vaults, LP share accounting, and shortfall debt settlement.
  - Live on-chain bad debt recording on Avalanche Fuji C-Chain.

---

## 7. Deterministic Weekend-Gap Scenario Results

The weekend-gap test scenario opens mirrored positions on both markets from an initial reference price of **$4,150.00**, simulates an **−8.00% Monday reopen gap** to **$3,818.00**, and executes liquidations:

| Metric | Standard Market (Naive 24/7) | Guarded Market (Nyxor Engine) | Delta / Protection |
|---|---|---|---|
| **Max Leverage Policy** | Static 20.00x | Dynamic 20.00x $\to$ 5.00x | Risk reduced before close |
| **Pre-Close Deleveraging** | None (100% exposed) | Automated at T-7.5m to 5.00x | Cut at fair Friday price |
| **Monday Open Price** | $3,818.00 (-8.00%) | $3,818.00 (-8.00%) | Identical shock |
| **Liquidations** | Underwater 20x long liquidated | **0 liquidations (Healthy)** | Collateral safely absorbed gap |
| **Recorded Bad Debt** | **$16,287.02 USDx** | **$0.00 USDx** | **100% LP Solvency Preserved** |

### Verified On-Chain Transaction Receipts
- **Deleverage T1 to 5x:** [`0x086294bc68d94678015d8354a1b26e1256e034b403b988fa2f589c16b14a362b`](https://testnet.snowscan.xyz/tx/0x086294bc68d94678015d8354a1b26e1256e034b403b988fa2f589c16b14a362b)
- **Monday Gap Shock (-800 bps):** [`0x9d39e817e2f5aae5869c5333977efa7634356d41dc462417a8e1611e43dc5362`](https://testnet.snowscan.xyz/tx/0x9d39e817e2f5aae5869c5333977efa7634356d41dc462417a8e1611e43dc5362)
- **Standard Liquidation:** [`0xed882a5c3702338c518989ba4727d91eda0ac6458fa02fd43991aea32b90bdef`](https://testnet.snowscan.xyz/tx/0xed882a5c3702338c518989ba4727d91eda0ac6458fa02fd43991aea32b90bdef)

Full step-by-step mathematical reconciliation is documented in [`docs/RISK_MODEL.md`](docs/RISK_MODEL.md).

---

## 8. Limitations & Honest Engineering Trade-offs

1. **Closed-Market Exits & The Free-Option Problem:** In the MVP, traders can close positions during `CLOSED` phase against the frozen `lastOfficialClosePrice`. While this prevents trapping trader capital, informed traders who learn of breaking weekend news could front-run the Monday open, leaving the vault with asymmetric risk. Production mitigation requires an asymmetric exit spread (100–300 bps) or dark pool matching. See [`docs/LIMITATIONS.md §4`](docs/LIMITATIONS.md).
2. **Calendar & Daylight Saving Time (DST):** Market schedules are configured in UTC seconds (14:30–21:00 UTC). A production deployment requires an active calendar oracle to account for daylight saving transitions and exchange holidays.
3. **Severe Gap Boundary:** Pre-close deleveraging to 5x completely eliminates bad debt for gaps up to ~20%. For catastrophic gaps exceeding 20%, bad debt can still emerge, but is strictly bounded compared to naive 20x venues.

---

## 9. How to Run & Verify

### Run Test Suite (Foundry)
```bash
cd contracts
forge test
```
All **100 tests pass** across 8 test suites (unit, scenario, and invariant tests).

### Run Local Scenario Simulation
```bash
forge test --match-contract WeekendGapScenario -vvv
```

### Launch Web Dashboard (`apps/web`)
```bash
cd apps/web
pnpm install
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view the live dashboard connected to Avalanche Fuji contracts with automatic public RPC failover.

---

## 10. AI Tools Disclosure

<!-- AI TOOLS PLACEHOLDER: Fill in tools used during development -->
[To be completed by author]

---

## 11. Test Count

```text
Ran 8 test suites: 100 tests passed, 0 failed, 0 skipped (100 total tests)
```
