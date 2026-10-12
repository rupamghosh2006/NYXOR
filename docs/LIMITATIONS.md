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
