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
- **`LiquidityVaultStandard`:** [`0xDD38265C1d66dCF067a24B1740895fDF5EA34f19`](https://testnet.snowscan.xyz/address/0xDD38265C1d66dCF067a24B1740895fDF5EA34f19)
- **`LiquidityVaultGuarded`:** [`0x5883F591C2eD45DC82FF9a551B4A00939eb84e2B`](https://testnet.snowscan.xyz/address/0x5883F591C2eD45DC82FF9a551B4A00939eb84e2B)
- **Liquidation Transaction Receipt:** [`0x234883ed75942a7cd7fa9b4c93ae9ffdbdc91e318d0492c2eb608bed890c5284`](https://testnet.snowscan.xyz/tx/0x234883ed75942a7cd7fa9b4c93ae9ffdbdc91e318d0492c2eb608bed890c5284) (Block `59348839`)

### 3.1 Initial Benchmark State
$$\text{Initial Bad Debt} = 0.000000\text{ USDx}$$

### 3.2 Position Setup (Friday OPEN Phase)
Trader 1 (T1) opens a maximum 20x long position:
- **Collateral:** $10,000.000000\text{ USDx}$
- **Notional Size:** $200,000.000000\text{ USDx}$
- **Entry Price:** $\$4,150.00$ ($415,000,000,000$)
- **Opening Fee (6 bps):** $\$120.000000\text{ USDx}$ ($96.00$ vault assets, $24.00$ insurance fund)

### 3.3 The Weekend Shock (Monday Reopen)
A $-8.00\%$ gap shock is applied to both oracle feeds over the weekend:
- **Official Friday Close:** $\$4,150.00$
- **Monday Reopen Price:** $\$3,818.00$ ($-332.00$ price delta)

### 3.4 Outcome on Standard Naive Market (Flat 20x)
Standard market has no deleveraging logic. T1 enters Monday carrying full $200,000\text{ USDx}$ notional:
1. **Gross Trader Loss:**
   $$\text{PnL} = 200,000 \times \frac{3,818 - 4,150}{4,150} = -16,000.000000\text{ USDx}$$
2. **Accrued Funding:**
   $$\text{FundingPaid} = 1,487.256111\text{ USDx}$$
3. **Trader Equity at Liquidation:**
   $$\text{Equity} = 10,000.000000 - 16,000.000000 - 1,487.256111 = -7,487.256111\text{ USDx}$$
4. **Headline Metric: Loss Beyond Collateral (Negative Equity):**
   $$\text{Trader Deficit} = \sum \max(0, -\text{Equity}) = \mathbf{7,487.256111\text{ USDx}} \approx \mathbf{7,487.26\text{ USDx}}$$
   - **Price-driven deficit:** $\$16,000.00 - \$10,000.00 = \mathbf{6,000.00\text{ USDx}}$
   - **Funding-driven deficit:** $\mathbf{1,487.26\text{ USDx}}$
   *(Exact match to live contract call `badDebtTotal()`: `7487256111`).*
5. **Separate Keeper & Insurance Flows:**
   - $\text{KeeperReward} = 50\text{ bps} \times 200,000 = 1,000.000000\text{ USDx}$ paid directly from vault reserves to liquidator.
   - Absorbed by Insurance Fund: $\$40.800000\text{ USDx}$ (entire balance).
   - Absorbed by LP Vault Assets: $\$959.200000\text{ USDx}$.
6. **Exact Two-Sided Invariant Verification:**
   - `balanceOf(PerpMarketStandard) == 14,000.000000 USDx` ($= \text{T2 Collateral } 8,000 + \text{T3 Collateral } 6,000$). **Zero stranded tokens!**
   - `balanceOf(StandardVault) == 509,204.000000 USDx` ($= \text{vaultAssets } 509,204 + \text{insuranceFund } 0$). **Exact reserve conservation!**

### 3.5 Outcome on Nyxor Guarded Market
In the final 10 minutes of Friday trading (PRE_CLOSE window at T-7.5m), the Nyxor risk engine called `deleverageToCap` for all positions above the 5.00x closed-market cap (T1, T2, and T3) at the fair open-market price ($\$4,150.00$):
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
- **Foundry Invariant & Unit Test Suite (`WeekendGapScenario.t.sol`):** Evaluates **5 reference traders plus rejected trader T6**, two-sided exact token conservation invariants, and short-side stress testing (+8% gap against 20x short).

---

## 5. Historical Context: Superseded Deployments

*(Marked as superseded per audit — retained for audit trail only)*:
1. `0x4c38297282959b86482b10d59210c3f2df84B659`: Accumulated bad debt across multiple script iterations ($16,287.02\text{ USDx}$).
2. `0x7f758330d60bd3B51E94B2582e4c05DFAbE765F8`: Old token-transfer accounting where deficit tokens were stranded in `PerpMarket` ($9,446.42\text{ USDx}$ bad debt).
3. **Current Active Benchmark Deployment (`0xDD38265C1d66dCF067a24B1740895fDF5EA34f19`):** Deployed fresh via `DeployDemo`, executed in a single atomic pass, with exact two-sided balance invariants and `badDebtTotal` defined strictly as negative equity ($7,487.26\text{ USDx}$).
