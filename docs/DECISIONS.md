# Nyxor Protocol — Decision Log

> Append entries here as decisions are made. Format: date · decision · reason · alternatives considered.
> Rule §0.7: every non-obvious design choice gets an entry.

---

## 2026-10-11 — Phase 0: Environment & Verification

### Tool versions (verified, Day 1)
| Tool | Version | Source |
|---|---|---|
| Node.js | v24.11.1 | System |
| pnpm | 11.3.0 | System |
| git | 2.47.1.windows.2 | System |
| Foundry (forge/cast/anvil) | v1.8.5 (commit 51a52c59) | GitHub releases v1.8.5 — https://github.com/foundry-rs/foundry/releases/tag/v1.8.5 |
| OpenZeppelin Contracts | v5.2.0 | https://github.com/OpenZeppelin/openzeppelin-contracts/releases/tag/v5.2.0 |
| Solidity | ^0.8.24 (pinned in foundry.toml) | Foundry managed |

### Fuji C-Chain RPC
- **Verified live:** `https://api.avax-test.network/ext/bc/C/rpc` returns `{"result":"0xa869"}` (chain ID 43113). ✓
- Source: https://docs.avax.network/tooling/rpc-providers

### Snowtrace / Routescan API
- Verified endpoint: `https://api.routescan.io/v2/network/testnet/evm/43113/etherscan`
- Snowtrace migrated to Routescan API. The etherscan-compatible API still works for `forge verify-contract`.
- Source: https://docs.routescan.io/

### OpenZeppelin v5 import paths
- **Decision:** use `openzeppelin-contracts/contracts/...` remapping (standard).
- v5 dropped `_setupRole` in favor of `_grantRole`. Using `_grantRole` everywhere.
- Source: https://docs.openzeppelin.com/contracts/5.x/

---

## 2026-10-11 — Architecture: Deploy on Fuji C-Chain first

**Decision:** Deploy all contracts to Fuji C-Chain (chain ID 43113) as the primary target.
The L1 (Subnet-EVM) is a Day 6 stretch; the contracts have zero L1-specific dependencies.

**Reason:** 8-day deadline. Fuji C-Chain gives us a working demo faster. Same Solidity code, same RPC shape. The L1 adds chain-level allowlist value but is not load-bearing for the risk engine proof.

**Alternatives:** L1 first (higher risk of tooling delays, validator funding delays).

---

## 2026-10-11 — Cut list

**Decisions (scope cut due to 8-day deadline):**
- ❌ ICTT / relayer — cut entirely unless L1 works by midday Day 6
- ❌ Real oracle adapter — MockPriceFeed only; ICMPriceFeed is stretch
- ❌ KYC precompile, FeeManager — cut
- ❌ Bridge page, Admin page — cut
- ❌ Second market (equity index) — cut
- ❌ Withdrawals back to C-Chain — cut
- ❌ CI (GitHub Actions) — cut
- ❌ Mainnet deployment — cut
- ✅ Risk-policy library folder + README — kept (open-source bonus, low cost)
- ✅ One-page web app (phase pill, Standard vs Guarded panel, open/close form) — kept

---

## 2026-10-11 — MarketSchedule: Gregorian calendar algorithm

**Decision:** use the Howard Hinnant `civil_from_days` public-domain algorithm for converting
days-since-epoch to (year, month, day) inside Solidity.

**Reason:** No external date library needed. The algorithm is well-known, tested, and fits in ~10 lines of pure integer arithmetic. Handles leap years correctly. Zero gas overhead vs alternatives.

**Source:** https://howardhinnant.github.io/date_algorithms.html#civil_from_days

**Alternative considered:** a table of year/month offsets (simpler but more storage, harder to audit).

---

## 2026-10-11 — Precompile addresses (for Day 6 L1)

**Status:** UNVERIFIED — will verify on Day 6 before L1 creation.
**Assumed (from subnet-evm docs):**
- TxAllowList: `0x0200000000000000000000000000000000000002`
- FeeManager: `0x0200000000000000000000000000000000000003`
**Source to verify:** https://docs.avax.network/avalanche-l1s/evm-l1s/customize-evm-l1

---

## Open risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Fuji faucet limits (UNVERIFIED: 2 AVAX/day per address) | Medium | Builder testing in parallel on Day 1; fund separate deployer + keeper wallets early |
| Snowtrace verification API key required | Low | Free API key from routescan.io dashboard |
| OZ v5 import path differs from v4 in any dep | Low | Using exact v5.2.0 tag, remapping confirmed |
| Foundry `forge verify-contract` flags may differ on routescan vs etherscan | Medium | Will test on Day 4 and document actual flags used |
| L1 viability and validator requirements | High | End of Day 3 research task will determine if L1 is feasible without running nodes |
| Real oracle unavailable on Fuji (stretch item) | Known | MockPriceFeed used throughout; clearly labeled SIMULATED |

---

## AI tools used

- Google Antigravity (Gemini-based coding agent): code generation, architecture scaffolding, test writing
- Role: write first-draft code and tests based on specs in AGENTS.md; human reviews and approves all phases

---

## 2026-10-11 — avalanche-cli Windows compatibility & Maintenance Mode

**VERIFIED:** `avalanche-cli` does NOT support Windows natively.
**VERIFIED:** `avalanche-cli` entered maintenance mode in December 2025.
- Direct Source: https://raw.githubusercontent.com/ava-labs/avalanche-cli/main/README.md (Lines 11–18: "As of December 2025, Avalanche CLI has entered maintenance mode. No new features will be developed by the Ava Labs team; only security patches and critical bug fixes will be addressed.")
- GitHub Repo: https://github.com/ava-labs/avalanche-cli

---

## 2026-10-11 — L1 Feasibility Research Task (Separate Agent Session, Due End of Day 3)

The previous Day 6 L1 plan is moved to a separate agent research task due by the end of Day 3.
Four routes to evaluate:
1. **Builder Console** (web-based UI)
2. **AvaCloud managed L1** (managed service)
3. **avalanche-cli under WSL2** (local Linux subsystem)
4. **avalanche-cli in GitHub Codespaces** (official Dev Container; note avalanche-cli README requirement for Docker IPv6 support)

For each route, the research agent will report (VERIFIED/UNVERIFIED with official doc links):
- Does it work from Windows?
- Does it require the developer to run/maintain validator nodes (local or VPS)?
- What Fuji AVAX funding is required?
- How is the `TxAllowList` precompile configured and enabled?
- Which block explorer is available?

**Recommendation & Gate:**
- Recommend the single route with minimum operational steps.
- If every route requires running and maintaining a persistent validator node, state that plainly.
- **Hard Gate:** If an L1 is not clearly feasible by end of Day 4 without dedicated validator DevOps overhead, drop the L1 entirely and ship 100% on Fuji C-Chain.

---

## 2026-10-11 — Maintenance Margin Policy in PRE_CLOSE (Replaces previous continuity decision)

**Decision:** In `MarketHoursRiskPolicy`, maintenance margin is held constant at the OPEN level (`250` bps = 2.50%) throughout all of `PRE_CLOSE`, and steps discretely to `600` bps (6.00%) strictly upon entering `CLOSED`.
**Reason:** In the previous attempt at ramping MM from 2.5% to 6%, a 20x position opened during OPEN (initial equity ≈ 4.94% after 6 bps taker fee) would become liquidatable around T-18 min before close, *before* the keeper `deleverageToCap` window opens at T-10 min. That would prematurely liquidate sound positions with penalty instead of deleveraging them cleanly. Holding MM flat at 2.50% guarantees that positions with unchanged prices are never liquidatable at any second of `PRE_CLOSE`, giving keepers the intended window to deleverage over-cap positions to 5x. At `CLOSED`, MM steps to 6.00% to allow last-chance liquidations against the frozen official close price.
**Conservative Rounding:**
- Max leverage: rounded DOWN (floor)
- Initial margin: rounded UP (ceil)
- Position / OI caps: rounded DOWN (floor)
- Funding multiplier: rounded UP (ceil)

---

## 2026-10-11 — LiquidityVault & Collateral Accounting Design

**Decision:**
1. **LP Share Price Isolation:** `shares` and `withdraw` calculate exchange rate strictly against `vaultAssets`, NEVER `insuranceFund`. The insurance reserve is segregated and cannot be redeemed or diluted by LPs.
2. **Trader Profit Insolvency:** In the event trader profit exceeds `vaultAssets`, `vaultAssets` drops to 0 and the deficit is recorded in `badDebtTotal`. Payout is capped to prevent draining the segregated insurance reserve.
3. **Exposure Guard on LP Withdrawals:** LP withdrawals cannot reduce `vaultAssets` below `lockedExposure` (`vaultAssets - assetsOut >= lockedExposure`).
4. **Collateral Segregation:** Trader margin collateral is held inside `PerpMarket`; `LiquidityVault` holds LP assets and insurance funds only. Realized PnL and shortfall claims settle between them.

---

## 2026-10-11 — Precompile addresses (UNVERIFIED)

For the L1 if pursued. Assumed from subnet-evm docs:
- TxAllowList: `0x0200000000000000000000000000000000000002`
- FeeManager:  `0x0200000000000000000000000000000000000003`
- Source to verify in Day 3 research: https://docs.avax.network/avalanche-l1s/evm-l1s/customize-evm-l1

---

## 2026-10-12 — Day 3 Hardening & Protocol Risk Mechanics

1. **Effective Leverage Invariant:** Taker open fee (6 bps) is charged on top of margin (i.e. `margin + openFee` transferred from trader, while position collateral stores `margin`). Effective leverage at opening strictly equals `sizeUsd / collateral == leverageX100 <= maxLeverageX100` with zero leverage inflation.
2. **Minimal Funding Rate Mechanism:** Implemented skew-based hourly funding per AGENTS.md §8.4 using 1e18 fixed-point arithmetic (`k = 10 bps`, clamp at `±25 bps/hr`, scaled by `params.fundingMultiplierBps`). Longs owe funding during positive long skew, shorts receive funding, and the vault acts as counterparty to net skew.
3. **CLOSED Market Execution Pricing:** During `Phase.CLOSED`, `_getExecutionPrice()` executes against the frozen `lastOfficialClosePrice()` and bypasses staleness checks. Traders can call `closePosition()` and keepers can call `liquidate()` (against 6% MM) so trader capital is never trapped over weekends.
4. **Deleveraging Funding Settlement:** `deleverageToCap` settles accrued funding and resets `fundingIndexSnapshot` upon resizing over-cap positions, ensuring remaining equity and target size align to precisely `5.00x` leverage without drift.
5. **Stateful Invariant Testing:** Token conservation invariant (`marketBal + vaultBal >= totalTraderCollateral + vaultAssets + insuranceFund`) validated across 3,840 calls without invariant failure or unexpected reverts.
