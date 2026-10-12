# Nyxor Protocol — Risk Model Specification

> **Positioning:** Nyxor is an open-source, market-hours-aware **risk layer** for real-world asset (RWA) perpetual futures on Avalanche. It is **not** an exchange.

---

## 1. Mathematical Foundations

### 1.1 Position Accounting & Units
All contracts adhere strictly to fixed-point arithmetic:
- **Collateral / USDx:** 6 decimals ($10^6$)
- **Price:** 8 decimals ($10^8$)
- **Basis Points (bps):** $10^4$ (100 bps = 1.00%)
- **Leverage:** $\times 100$ (2000 = 20.00x)

Given notional size $N$ (USDx), collateral $C$ (USDx), entry price $P_0$ (8 dec), current price $P$ (8 dec), and side $s \in \{+1 \text{ (long)}, -1 \text{ (short)}\}$:

$$\text{PnL} = s \times N \times \frac{P - P_0}{P_0}$$

$$\text{Equity} = C + \text{PnL} - \text{AccruedFunding}$$

$$\text{Effective Leverage} = \frac{N}{\text{Equity}}$$

### 1.2 Maintenance Margin & Liquidation Condition
A position is subject to permissionless liquidation whenever equity breaches the maintenance margin requirement ($MM_{\text{bps}}$):

$$\text{Equity} < \frac{N \times MM_{\text{bps}}}{10000}$$

For a long position with liquidation threshold $MM$:

$$P_{\text{liq}} = P_0 \times \left(1 - \frac{C - MM \times N - \text{AccruedFunding}}{N}\right)$$

### 1.3 Liquidation Shortfall, Loss Beyond Collateral & LP Loss
When a market price gaps past the liquidation threshold, equity becomes negative ($\text{Equity} < 0$).

1. **Loss Beyond Collateral (Trader Deficit):**
   $$\text{Trader Deficit} = -\text{Equity}$$
   This represents the exact amount by which trader trading losses and accrued funding exceeded deposited margin.

2. **Total Liquidation Shortfall:**
   $$\text{Shortfall} = \text{Trader Deficit} + \text{KeeperReward} + \text{InsurancePenalty}$$
   Where:
   - $\text{KeeperReward} = 50\text{ bps} \times N$ (0.50% of notional)
   - $\text{InsurancePenalty} = 50\text{ bps} \times N$ (0.50% of notional)

3. **LP Loss After Insurance Fund (Recorded Bad Debt):**
   The Liquidity Vault covers the shortfall hierarchically:
   $$\text{PaidByInsurance} = \min(\text{InsuranceFund}, \text{Shortfall})$$
   $$\text{LP Loss After Insurance Fund} = \text{Shortfall} - \text{PaidByInsurance}$$

   The **headline figure** (`badDebtTotal`) is this net unbacked loss that directly reduces LP vault assets after the insurance reserve has absorbed what it could.

---

## 2. Market-Hours Risk Parameters

| Phase | Max Leverage | Initial Margin | Maintenance Margin | OI Cap (Side) | Funding Mult | Mode |
|---|---|---|---|---|---|---|
| **OPEN** | 20.00x | 5.00% | 2.50% | 100% of base | 1.0x | Normal 24/7 |
| **PRE_CLOSE** | Linear 20x $\to$ 5x | $1 / \text{MaxLev}$ | 2.50% (Constant) | Linear 100% $\to$ 40% | 1.0x $\to$ 2.0x | Ramp down cap |
| **CLOSED** | 5.00x | 20.00% | 6.00% | 40% of base | 2.0x | Reduce-only |
| **REOPEN_COOLDOWN** | 5.00x | 20.00% | 6.00% | 40% of base | 2.0x | Cooldown (15m) |

- **Naive Baseline (`FlatRiskPolicy`):** Always returns the OPEN row (20.00x leverage, 2.50% MM) regardless of session hours.
- **Nyxor Engine (`MarketHoursRiskPolicy`):** Enforces schedule-aware parameters based on `MarketSchedule.phaseAt(ts)`.

---

## 3. Worked Example: Clean On-Chain Weekend-Gap Run

Reconciliation from the single-pass on-chain scenario execution on Avalanche Fuji C-Chain:
- **`LiquidityVaultStandard`:** [`0x7f758330d60bd3B51E94B2582e4c05DFAbE765F8`](https://testnet.snowscan.xyz/address/0x7f758330d60bd3B51E94B2582e4c05DFAbE765F8)
- **`LiquidityVaultGuarded`:** [`0x442697fea0BAF3775149B415d502e8c06dF05e92`](https://testnet.snowscan.xyz/address/0x442697fea0BAF3775149B415d502e8c06dF05e92)
- **Liquidation Transaction Receipt:** [`0x9e0eed1a20f6dadc8bf268c6fe2f32e768aeae30dae91b222c5347c896c0b5be`](https://testnet.snowscan.xyz/tx/0x9e0eed1a20f6dadc8bf268c6fe2f32e768aeae30dae91b222c5347c896c0b5be) (Block `59333270`)

### 3.1 Initial Benchmark State
$$\text{Initial Bad Debt} = 0.000000\text{ USDx}$$

### 3.2 Position Setup (Friday OPEN Phase)
Trader 1 (T1) opens a maximum 20x long position:
- **Collateral:** $10,000.000000\text{ USDx}$
- **Notional Size:** $200,000.000000\text{ USDx}$
- **Entry Price:** $\$4,150.00$ ($415,000,000,000$)
- **Opening Fee (6 bps):** $\$120.000000\text{ USDx}$

### 3.3 The Weekend Shock (Monday Reopen)
A $-8.00\%$ gap shock is applied to both oracle feeds over the weekend:
- **Official Friday Close:** $\$4,150.00$
- **Monday Reopen Price:** $\$3,818.00$ ($-332.00$ price delta)

### 3.4 Outcome on Standard Naive Market (Flat 20x)
Standard market has no deleveraging logic. T1 enters Monday carrying full $200,000\text{ USDx}$ notional:
1. **Gross Trader Loss:**
   $$\text{PnL} = 200,000 \times \frac{3,818 - 4,150}{4,150} = -16,000.000000\text{ USDx}$$
2. **Accrued Funding:**
   $$\text{FundingPaid} = 1,487.219444\text{ USDx}$$
3. **Trader Equity at Liquidation:**
   $$\text{Equity} = 10,000.000000 - 16,000.000000 - 1,487.219444 = -7,487.219444\text{ USDx}$$
4. **Loss Beyond Collateral (Trader Deficit):**
   $$\text{Loss Beyond Collateral} = 7,487.219444\text{ USDx} \approx \mathbf{7,487.22\text{ USDx}}$$
5. **Liquidation Penalties:**
   - $\text{KeeperReward} = 50\text{ bps} \times 200,000 = 1,000.000000\text{ USDx}$
   - $\text{InsurancePenalty} = 50\text{ bps} \times 200,000 = 1,000.000000\text{ USDx}$
6. **Total Liquidation Shortfall:**
   $$\text{Shortfall} = 7,487.219444 + 1,000.000000 + 1,000.000000 = 9,487.219444\text{ USDx} \approx \mathbf{9,487.22\text{ USDx}}$$
7. **Insurance Fund Absorption:**
   The Standard Insurance Fund had accumulated $40.800000\text{ USDx}$ in fees. It pays out its entire balance:
   $$\text{PaidByInsurance} = 40.800000\text{ USDx}$$
8. **LP Loss After Insurance Fund (Vault Bad Debt):**
   $$\text{LP Loss After Insurance Fund} = 9,487.219444 - 40.800000 = \mathbf{9,446.419444\text{ USDx}} \approx \mathbf{9,446.42\text{ USDx}}$$
9. **Final On-Chain State:**
   - Contract call `badDebtTotal()`: `9446419444` ($9,446.42\text{ USDx}$).
   - Reconciled to the exact single raw unit from on-chain event `ShortfallCovered(9487219444, 40800000, 9446419444)`.

### 3.5 Outcome on Nyxor Guarded Market
In the final 10 minutes of Friday trading (PRE_CLOSE window at T-7.5m), the Nyxor risk engine called `deleverageToCap(t1)` at the fair open-market price ($\$4,150.00$):
1. **Leverage Cut:** Reduced from $20.00\text{x}$ down to the closed-market cap of $5.00\text{x}$ ($500$).
2. **Deleveraged Notional:** Reduced to $50,000.000000\text{ USDx}$.
3. **Collateral Retained:** $\$10,000.000000\text{ USDx}$.
4. **Impact of $-8.00\%$ Monday Gap:**
   $$\text{PnL} = 50,000 \times (-8.00\%) = -4,000.000000\text{ USDx}$$
5. **Remaining Trader Equity:**
   $$\text{Equity} = 10,000.000000 - 4,000.000000 = \mathbf{6,000.000000\text{ USDx}}$$
6. **Health Check:**
   $$\text{Maintenance Margin Required} = 6.00\% \times 50,000 = 3,000.000000\text{ USDx}$$
   $$\text{Equity } (6,000) > \text{MM } (3,000) \implies \text{Healthy!}$$
7. **Solvency Result:** Zero liquidations. **Zero bad debt ($\mathbf{0.00\text{ USDx}}$).** 100% LP solvency preserved.

---

## 4. Test Scope & Trader Wallets Disclosure

- **Fuji On-Chain Scenario Broadcast:** Executes using **3 distinct trader wallets** derived from the deployer keypair:
  - Trader 1: $20\text{x}$ Long ($10,000\text{ margin} \to 200,000\text{ notional}$)
  - Trader 2: $10\text{x}$ Long ($8,000\text{ margin} \to 80,000\text{ notional}$)
  - Trader 3: $10\text{x}$ Short ($6,000\text{ margin} \to 60,000\text{ notional}$)
- **Foundry Invariant & Unit Test Suite (`WeekendGapScenario.t.sol`):** Evaluates **5 reference traders plus rejected trader T6** across boundary conditions (open boundary, ramp midpoint, gap shocks up to $-25\%$).

---

## 5. Historical Context: Superseded Deployment

*(Marked as superseded per audit — retained for audit trail only)*:
- Earlier deployment `0x4c38297282959b86482b10d59210c3f2df84B659` accumulated bad debt across two separate liquidations:
  1. Block `59330044` (`0xe6f38ed...`): Liquidated deployer position ($9,326.00\text{ USDx}$).
  2. Block `59332558` (`0xed882a5...`): Liquidated T1 position ($6,961.02\text{ USDx}$).
  Total cumulative bad debt was $16,287.02\text{ USDx}$.
- The current clean benchmark deployment described in Section 3 was deployed fresh and executed in a single atomic pass from zero.
