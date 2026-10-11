# packages/risk-policy

> **Nyxor Risk Policy Library** — open-source, MIT-licensed.
> A plug-in risk parameter engine for RWA perpetual-futures markets that are affected by reference-market closure (nights, weekends, holidays).

---

## What this is

This folder contains the reusable on-chain risk layer extracted from the Nyxor Protocol reference implementation.
You can drop these contracts into any existing perps market to get market-hours-aware leverage caps, margin requirements and funding multipliers — without rewriting your market contract.

## Contracts

| Contract | Description |
|---|---|
| `IRiskPolicy` | Interface that `PerpMarket` calls on every trade. |
| `RiskParams` | Struct returned by `IRiskPolicy.getParams(ts)`. |
| `FlatRiskPolicy` | Naive baseline: always returns OPEN-phase parameters (20x, no phase logic). Use as the "unguarded" comparison. |
| `MarketHoursRiskPolicy` | The guarded policy: reads `MarketSchedule` and returns phase-appropriate parameters with a linear ramp-down in PRE_CLOSE. |
| `MarketSchedule` | Determines the current `Phase` from a Unix timestamp. Mon–Fri sessions with configurable open/close times, holiday support. |
| `MarketClock` | Returns an effective timestamp. In demo mode, an admin can time-travel. In production, returns `block.timestamp`. |

## How to integrate

```solidity
// 1. Deploy the schedule (or reuse one)
MarketSchedule schedule = new MarketSchedule(admin, 3600, 900);

// 2. Deploy your chosen policy
IRiskPolicy policy = new MarketHoursRiskPolicy(address(schedule), BASE_OI_USD, BASE_POS_USD);

// 3. In your PerpMarket, call policy.getParams(clock.now()) before any risk check
RiskParams memory p = policy.getParams(clock.now());
require(leverageX100 <= p.maxLeverageX100, "Leverage exceeds current cap");
require(!p.reduceOnly || isDecrease, "Market is in reduce-only mode");
```

## Parameter table

| Phase | Max leverage | Initial margin | Maintenance margin | OI cap | Funding mult | Mode |
|---|---|---|---|---|---|---|
| OPEN | 20x | 5% | 2.5% | 100% | 1x | Normal |
| PRE_CLOSE | linear 20x→5x | 1/lev | IM/2 | linear 100%→40% | 1x→2x | No new risk above ramp cap |
| CLOSED | 5x | 20% | 6% | 40% | 2x | Reduce-only |
| REOPEN_COOLDOWN | 5x | 20% | 6% | 40% | 2x | Reduce-only + liquidations active |

## Limitations (be honest with your users)

- **Fixed-UTC schedule.** No DST handling. Update `openSecondsUTC`/`closeSecondsUTC` when DST changes, or use a keeper.
- **Holiday list is manual.** An admin must add holidays in advance.
- **Mock clock.** `MarketClock` in demo mode can be time-traveled by an admin. Production deployments should use `demoMode = false` at construction.
- **Not audited.** This is a hackathon prototype. Do not use for real funds.

## License

MIT
