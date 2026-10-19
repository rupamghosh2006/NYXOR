<div align="center">
  <img src="docs/logo.png" alt="Nyxor Protocol Logo" width="100" />

  # Nyxor Protocol

  **The market closes on Friday. Your risk shouldn't.**  
  An open-source, market-hours-aware risk layer for Real-World Asset (RWA) perpetual futures on Avalanche.

  <br />

  [![Live App](https://img.shields.io/badge/Live%20App-nyxor--protocol.vercel.app-black?style=flat-square&logo=vercel&logoColor=white)](https://nyxor-protocol.vercel.app)
  [![Documentation](https://img.shields.io/badge/Docs-Mintlify-07C983?style=flat-square&logo=mintlify&logoColor=white)](https://ruponchain.mintlify.site)
  [![Avalanche L1](https://img.shields.io/badge/Avalanche%20L1-Chain%2098421-8B5CF6?style=flat-square&logo=avalanche&logoColor=white)](https://build.avax.network/explorer/mainnet/2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS/block/1)
  [![Fuji C-Chain](https://img.shields.io/badge/Fuji%20C--Chain-Chain%2043113-E84142?style=flat-square&logo=avalanche&logoColor=white)](https://testnet.snowscan.xyz)
  [![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat-square&logo=solidity&logoColor=white)](contracts/)
  [![Foundry Tests](https://img.shields.io/badge/Foundry-103%20Passed-16A34A?style=flat-square&logo=ethereum&logoColor=white)](#9-how-to-run--verify)
  [![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
  [![X](https://img.shields.io/badge/X-@nyxorprotocol-black?style=flat-square&logo=x&logoColor=white)](https://x.com/nyxorprotocol)

  <br />
</div>

---

> **Live Demo Application:** [https://nyxor-protocol.vercel.app](https://nyxor-protocol.vercel.app)  
> **Official Documentation:** [https://ruponchain.mintlify.site](https://ruponchain.mintlify.site)  
> **Sovereign Nyxor L1:** [L1 Creation Transaction](https://build.avax.network/explorer/mainnet/2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS/block/1)  
> **Official X / Twitter:** [https://x.com/nyxorprotocol](https://x.com/nyxorprotocol)

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
| **PerpMarketGuarded** | `0x5db927AB629d0304C312e65F3a66D88938012E52` | [Snowscan](https://testnet.snowscan.xyz/address/0x5db927AB629d0304C312e65F3a66D88938012E52) |
| **LiquidityVaultGuarded** | `0x5883F591C2eD45DC82FF9a551B4A00939eb84e2B` | [Snowscan](https://testnet.snowscan.xyz/address/0x5883F591C2eD45DC82FF9a551B4A00939eb84e2B) |
| **MarketHoursRiskPolicy** | `0x3BA8a766880fC8e8074EBCc3A23a2e67d3423871` | [Snowscan](https://testnet.snowscan.xyz/address/0x3BA8a766880fC8e8074EBCc3A23a2e67d3423871) |
| **PerpMarketStandard** | `0xf8FEd93D1C351543195fB0D069ed31478Fc3C562` | [Snowscan](https://testnet.snowscan.xyz/address/0xf8FEd93D1C351543195fB0D069ed31478Fc3C562) |
| **LiquidityVaultStandard** | `0xDD38265C1d66dCF067a24B1740895fDF5EA34f19` | [Snowscan](https://testnet.snowscan.xyz/address/0xDD38265C1d66dCF067a24B1740895fDF5EA34f19) |
| **FlatRiskPolicy** | `0xeAe1e4E4531d1AAD7dCF6efB28aA42ecDCDF048F` | [Snowscan](https://testnet.snowscan.xyz/address/0xeAe1e4E4531d1AAD7dCF6efB28aA42ecDCDF048F) |
| **MarketClock** | `0x5e050a5b66E128ceF2bD9bd0cc4f2b400136fc13` | [Snowscan](https://testnet.snowscan.xyz/address/0x5e050a5b66E128ceF2bD9bd0cc4f2b400136fc13) |
| **MarketSchedule** | `0x57231418E1F58059Ef53aC8E364499264BA69aBF` | [Snowscan](https://testnet.snowscan.xyz/address/0x57231418E1F58059Ef53aC8E364499264BA69aBF) |
| **MockPriceFeedGuarded** | `0x983Da40dB7B35A0Cac08f8De5fcf629520322C44` | [Snowscan](https://testnet.snowscan.xyz/address/0x983Da40dB7B35A0Cac08f8De5fcf629520322C44) |
| **MockPriceFeedStandard** | `0x68Edd9Ae0DD51a56027Db8A67d3726a827D21634` | [Snowscan](https://testnet.snowscan.xyz/address/0x68Edd9Ae0DD51a56027Db8A67d3726a827D21634) |
| **DemoUSDC** | `0x03933052aC03983e37a1C3E0c1cE9DD78787E4f2` | [Snowscan](https://testnet.snowscan.xyz/address/0x03933052aC03983e37a1C3E0c1cE9DD78787E4f2) |

### 5.1 Sovereign Avalanche L1 & Interchain Messaging (Chain ID: 98421)

In addition to the primary Fuji C-Chain benchmark, Nyxor operates a sovereign **Subnet-EVM Layer 1** on Avalanche Fuji testnet featuring native token gas (`NYX`), permissioned access control, and cross-chain messaging:

- **EVM Chain ID:** `98421` (Blockchain ID: `2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS`)
- **Subnet ID:** `2rXbQTjPnXKnRpogaLshYEmYfnLFahCgJ5gfuJ4dciHvJb6A9j`
- **RPC URL:** `https://nodes-prod.43.207.73.245.sslip.io/ext/bc/2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS/rpc`
- **Block Explorer:** [https://2rbfkegm.firn.gg](https://2rbfkegm.firn.gg)
- **Compliance Precompile (`TxAllowList`):** Active at `0x0200000000000000000000000000000000000002` (Admin: `0x4AD14e89...`)
- **TeleporterMessenger:** `0x253b2784c75e610dD0FF1da844684a1aC0aa5fcf`
- **Verified Cross-Chain Message (Nyxor L1 $\to$ Fuji C-Chain):** [`0x7b1581184594132edff78faa1700b4b5fdbac49d3948f7d074937abe410de4f4`](https://build.avax.network/explorer/mainnet/2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS/tx/0x7b1581184594132edff78faa1700b4b5fdbac49d3948f7d074937abe410de4f4)
- **Full Architecture & Deployment Guide:** Documented in [`docs/NYXOR_L1.md`](docs/NYXOR_L1.md).

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
| **Loss Beyond Collateral (Bad Debt)** | **$7,487.26 USDx** | **$0.00 USDx** | **100% LP Solvency Preserved** |

### Verified On-Chain Transaction Receipts (Clean Single-Pass Run)
- **Deleverage T1 to 5x (Guarded):** [`0x1328557928992ccf037dd282a9c8b5b959701a68d4061be6d58a57c5e157cf6f`](https://testnet.snowscan.xyz/tx/0x1328557928992ccf037dd282a9c8b5b959701a68d4061be6d58a57c5e157cf6f) (Block 59348817)
- **Deleverage T2 to 5x (Guarded):** [`0x44d7914488f6ced8deb43ed3ebc5f598ac370fdff2b00859f3bad8b230cfab6b`](https://testnet.snowscan.xyz/tx/0x44d7914488f6ced8deb43ed3ebc5f598ac370fdff2b00859f3bad8b230cfab6b) (Block 59348820)
- **Deleverage T3 to 5x (Guarded):** [`0x291e6408726d530afefea1245d094a00037b091219d1a57e442bd22d2f908660`](https://testnet.snowscan.xyz/tx/0x291e6408726d530afefea1245d094a00037b091219d1a57e442bd22d2f908660) (Block 59348822)
- **Monday Gap Shock (-800 bps Standard):** [`0x8cb588905628bfdbe6cb933100bdc79edb88fa4a94674d7b423b72844543c92f`](https://testnet.snowscan.xyz/tx/0x8cb588905628bfdbe6cb933100bdc79edb88fa4a94674d7b423b72844543c92f) (Block 59348834)
- **Monday Gap Shock (-800 bps Guarded):** [`0x0f0d4638ab9f457f53864118df92098debbccea6e4f9fbadcd4e40137afd4733`](https://testnet.snowscan.xyz/tx/0x0f0d4638ab9f457f53864118df92098debbccea6e4f9fbadcd4e40137afd4733) (Block 59348836)
- **Standard Liquidation (T1):** [`0x234883ed75942a7cd7fa9b4c93ae9ffdbdc91e318d0492c2eb608bed890c5284`](https://testnet.snowscan.xyz/tx/0x234883ed75942a7cd7fa9b4c93ae9ffdbdc91e318d0492c2eb608bed890c5284) (Block 59348839)

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
All **103 tests pass** across 8 test suites (unit, scenario, and invariant tests).

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

Claude and Google Antigravity were utilized as pair-programming and architecture audit assistants during development for smart contract scaffolding, comprehensive test suite authoring, fixed-point math verification, and invariant debugging. All financial risk formulas, calendar algorithms, contract implementations, and economic safety invariants were independently audited, reviewed, verified on-chain, and validated by the author.

---

## 11. Test Count

```text
Ran 8 test suites: 103 tests passed, 0 failed, 0 skipped (103 total tests)
```
