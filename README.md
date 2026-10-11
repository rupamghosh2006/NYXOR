# Nyxor Protocol

> **The market closes on Friday. Your risk shouldn't.**  
> An open-source, market-hours-aware **risk layer** for Real-World Asset (RWA) perpetual futures on Avalanche.

---

## The Problem: The Scoreboard Dilemma

RWA perps (perpetual futures on equities, commodities, and index trackers) trade 24/7 on-chain, but the underlying reference markets close on nights, weekends, and holidays.

Trading a stock perp while the exchange is closed is like betting on a game while the scoreboard is off. Nobody knows the real score until Monday morning. When the reference market reopens, the spot price can **gap** directly over liquidation thresholds:
- Standard liquidations rely on continuous price paths.
- A sudden weekend gap bypasses liquidations entirely.
- Losses exceed trader collateral, leaving the venue or liquidity providers with **bad debt**.

## The Nyxor Solution

Nyxor is **not an exchange**; it is an autonomous risk parameter engine that automatically tightens risk rules before the reference market closes, and manages reopening safely:

1. **Pre-Close Linear Ramp**: Leverage caps ramp down (20x &rarr; 5x) and open interest caps contract over the pre-close window (e.g. final 1 hour before Friday close).
2. **Pre-Close Deleveraging**: Positions exceeding the closed-market cap (5x) are systematically deleveraged to 5x before the close at a reliable, active open-market price—preventing bad debt before the gap can occur.
3. **Closed-Market Defensive Regime**: In the closed phase, markets switch to `reduce-only` mode, maintenance margin tightens, and funding multipliers double.
4. **Controlled Reopen**: Reopen cooldown allows liquidations against the verified opening price before normal limits are restored.

---

## Architecture & Reusable Components

```
                Nyxor Protocol Architecture (Fuji C-Chain / Avalanche L1)
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                                                                             │
  │    MarketClock ─────────── MarketSchedule (Gregorian Sessions & Holidays)   │
  │         │                               │                                   │
  │         ▼                               ▼                                   │
  │    MockPriceFeed ─────────────► IRiskPolicy                                 │
  │    (Simulated Oracle)            ├── FlatRiskPolicy (Naive 20x Baseline)    │
  │                                  └── MarketHoursRiskPolicy (Guarded Engine) │
  │                                                 │                           │
  │                                                 ▼                           │
  │    LiquidityVault ◄──────────────────────► PerpMarket                       │
  │    (LP Assets + Insurance Fund)            (Isolated Margin, Phase-Aware)   │
  │                                                                             │
  └─────────────────────────────────────────────────────────────────────────────┘
```

### Core Contracts (`contracts/src/`)
- **`core/MarketClock.sol`**: Provides effective timestamps with admin time-travel capabilities in demo mode.
- **`core/MarketSchedule.sol`**: Phase detection engine (`OPEN`, `PRE_CLOSE`, `CLOSED`, `REOPEN_COOLDOWN`) with Gregorian date decomposition and holiday management.
- **`policy/IRiskPolicy.sol`**: Shared interface defining phase-based leverage caps, margin requirements, OI caps, and funding multipliers.
- **`policy/FlatRiskPolicy.sol`**: Naive benchmark policy that holds 20x leverage static throughout all hours.
- **`policy/MarketHoursRiskPolicy.sol`**: The guarded risk policy featuring smooth, continuous pre-close ramps and defensive weekend parameters.
- **`vault/LiquidityVault.sol`**: Vault holding LP capital, segregated insurance reserves, and tracking cumulative bad debt.
- **`oracle/MockPriceFeed.sol`**: 8-decimal oracle with frozen official close checkpoints and configurable price gap shocks.

---

## Transparency & Honest Disclosures

- **Simulated Oracle & Clock**: The price feed (`MockPriceFeed`), simulated time-travel (`MarketClock`), and weekend price shocks are simulated to demonstrate deterministic gap mechanics during hackathon review.
- **Testnet Only**: All contracts and scripts are built for Avalanche Fuji testnet. This software is unaudited and designed as a research prototype.

---

## Verification & Testing

Built with Foundry and pinned to Solidity `0.8.24` and OpenZeppelin Contracts `v5.2.0`.

```bash
# Clone the repository
git clone https://github.com/rupamghosh2006/NYXOR.git
cd NYXOR/contracts

# Run all test suites
forge test -v
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
