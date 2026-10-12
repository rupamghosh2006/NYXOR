# Nyxor Protocol — Documented System Limitations

This document lists known architectural limitations, honest simplifications, and edge cases in the MVP build of Nyxor Protocol.

---

## 1. Vault Insolvency & Epoch-Based Recapitalization

### The Scenario
If extreme market shock and accumulated bad debt exceed both the insurance reserve and 100% of the LP liquidity pool, `vaultAssets` drops to `0`. The vault becomes insolvent.

### Mechanism
- Rather than leaving insolvent LP shares eligible to claim fresh deposits, `LiquidityVault` uses an **epoch counter** (`uint256 public epoch`).
- When fresh capital is deposited after a complete wipeout (`vaultAssets == 0 && totalShares > 0`), the vault automatically advances `epoch++`.
- Shares are segregated per epoch (`sharesOfByEpoch[epoch][lp]`).
- Old LPs from previous epochs have zero balance in the new epoch, protecting recapitalizing liquidity providers from dilution or asset extraction.

---

## 2. Market Schedule & Daylight Saving Time (DST)

### The Limitation
- Market sessions (`MarketSchedule.sol`) are configured with fixed UTC second-of-day offsets (e.g. `14:30 UTC` open, `21:00 UTC` close for US equities).
- Fixed UTC offsets do not automatically adjust when US/UK jurisdictions enter or exit Daylight Saving Time (e.g. EDT vs EST).

### Production Path
In a production deployment, `MarketSchedule` would either integrate an off-chain oracle calendar maintaining exact market session schedules or be regularly maintained by an authorized governor/keeper.

---

## 3. Simulated Clock & Mock Oracle

### Hackathon Prototype Context
- `MarketClock.sol` contains demo time-travel methods (`advance`, `setDemoOffset`) enabled only when `demoMode == true`.
- `MockPriceFeed.sol` provides deterministic price simulation and gap injection (`queueShock`) to allow verifiable benchmarking of weekend gap defense.
- A production deployment replaces `MockPriceFeed` with a verified push/pull oracle adapter implementing `IPriceFeed`.

---

## 4. Closed-Market Exits & The Free-Option Problem (Asymmetric Information Risk)

### The Economic Vulnerability
In Nyxor MVP, traders are permitted to call `closePosition()` during `Phase.CLOSED` (weekends/holidays) against the frozen `lastOfficialClosePrice()`. This was designed so trader capital is never trapped or frozen over a weekend.

However, **executing at Friday's official close price creates a free option for informed traders**:
- If adverse news breaks on Saturday or Sunday (e.g. negative corporate earnings, macroeconomic shock, geopolitical crisis), informed traders holding long positions could close on Sunday at Friday's price.
- The trader escapes with zero loss at Friday's quote.
- When the reference market opens on Monday with a negative price gap, the liquidity vault holds the inventory/shortfall and absorbs the loss.

### Production Mitigations (Non-MVP Roadmap)
In a production deployment, closed-market exits must **not** be treated as risk-free or costless:
1. **Closed-Phase Exit Spread / Penalty:** Apply an asymmetric exit fee (e.g. 100–300 bps) during `CLOSED` and `REOPEN_COOLDOWN` phases, with 100% of the penalty routed to the `insuranceFund` to compensate LPs for bearing gap risk.
2. **Guardian Circuit Breakers:** Authorize guardians to pause closed-market execution upon verified off-hours black swan events.
3. **P2P Matching / Dark Pool:** During closed hours, require trades to cross peer-to-peer against other traders rather than clearing instantaneously against vault liquidity at Friday's frozen oracle price.

> [!WARNING]
> **Honest Label:** Closed-market exits in Nyxor are NOT risk-free. Allowing exits at the last official close protects trader liquidity but transfers asymmetric weekend event risk to liquidity providers unless offset by an exit spread or insurance reserve.

