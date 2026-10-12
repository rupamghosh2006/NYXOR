# Nyxor Protocol — 3-Minute Video Demo Script

> **Instance Target for Recording:** Fresh Demo Instance (`deployments/demo-latest.json`)  
> **Chain ID:** `43113` (Avalanche Fuji C-Chain)  
> **UI Dashboard:** `http://localhost:3000` (or production Vercel URL)

---

## Video Outline & Time Breakdown

| Timestamp | Topic | Screen Focus | Talking Points |
|---|---|---|---|
| **0:00 – 0:40** | The Scoreboard Problem | Dashboard Landing / Phase Hero | RWA perps trade 24/7 on crypto, but real-world markets close. Gaps blow through liquidation points creating unbacked bad debt. |
| **0:40 – 1:20** | Nyxor Market Hours Engine | Phase Pill / Risk Policy Table | 4 phases (`OPEN`, `PRE_CLOSE`, `CLOSED`, `REOPEN_COOLDOWN`). Dynamic leverage ramp from 20x to 5x. Pre-close keeper deleveraging. |
| **1:20 – 2:15** | Live Time-Travel & -8% Gap Shock | Admin Console & Comparison Panel | Demonstrate PRE_CLOSE deleveraging at fair Friday price. Checkpoint close. Inject -8% Monday gap shock. |
| **2:15 – 2:45** | Solvency Contrast | Solvency Metrics Grid | Standard Market takes $7,487.26 USDx bad debt. Guarded Market has $0.00 bad debt with 100% LP solvency preserved. |
| **2:45 – 3:00** | On-Chain Audit Proof & Wrap-up | Frozen Benchmark Tab | Show 34 verified on-chain transactions and exact token conservation invariants. "The market closes on Friday; your risk shouldn't." |

---

## Step-by-Step Operator Guide

### 1. Preparation Before Hitting Record
1. Start local dev server:
   ```bash
   cd apps/web && pnpm dev
   ```
2. Open browser to [http://localhost:3000](http://localhost:3000).
3. Confirm the top toggle is set to **Fresh Demo Instance** (both vaults show clean $500k assets and $0.00 bad debt).
4. Connect Core or MetaMask wallet (using deployer address `0x4AD14e89622A046803988213E4a9846756531086` to unlock the Admin Console).

### 2. Segment 1: The Pitch (0:00 – 0:40)
- **Visual:** Full dashboard view.
- **Script:**
  > *"Welcome to Nyxor Protocol. We built an open-source, market-hours-aware risk layer for real-world asset perpetual futures on Avalanche.*
  >
  > *Today, synthetic stock perps trade 24/7 on crypto rails, but Wall Street closes every weekend. Trading a stock perp over the weekend is like betting on a game when the stadium scoreboard is turned off. Nobody knows the real score until Monday.*
  >
  > *When markets reopen with an 8% or 20% gap, continuous liquidation models break. Positions gap straight through margin into negative equity, leaving protocols with unbacked bad debt. Nyxor solves this by making risk parameters schedule-aware."*

### 3. Segment 2: The 4 Phases (0:40 – 1:20)
- **Visual:** Hover over the Phase Hero pill and the Dynamic Risk Parameter badges.
- **Script:**
  > *"Nyxor transitions across four operating regimes:*
  > - *OPEN: Standard 20x leverage and normal 24/7 trading.*
  > - *PRE_CLOSE: In the final hour before Friday's close, leverage caps linearly ramp from 20x down to 5x.*
  > - *CLOSED: Weekend reduce-only mode with a 5x leverage cap and 6% maintenance margin.*
  > - *REOPEN_COOLDOWN: Monday open registers the first verified opening print before restoring standard limits.*
  >
  > *Crucially, during the final 10 minutes of Friday trading, automated keeper bots cut any over-cap position down to 5x at the active, fair Friday price—eliminating excess leverage before the scoreboard goes dark."*

### 4. Segment 3: Interactive Gap Shock Demo (1:20 – 2:15)
- **Visual:** Scroll down to the Admin Console.
- **Actions:**
  1. Click **Advance to PRE_CLOSE (T-7.5m)**. Point out the dynamic leverage cap dropping from 20.00x to 5.00x.
  2. Click **Warp to CLOSED (Weekend)**. Point out the frozen Friday close price checkpoint ($4,150.00) and reduce-only badge.
  3. Click **Warp to Monday Reopen (14:35 UTC)**.
  4. Click **Inject −8.00% Gap Shock (3,818.00 USD)**.
  5. Scroll to the **Market Solvency Comparison Panel**.
- **Script:**
  > *"Let's simulate a weekend gap right now. We time-travel to Friday PRE_CLOSE—our keeper bot cuts over-cap positions to 5x. We checkpoint Friday's close at $4,150. Over the weekend, markets are closed. Monday morning arrives with a −8.00% gap shock to $3,818."*

### 5. Segment 4: Solvency Contrast (2:15 – 2:45)
- **Visual:** Focus on the Side-by-Side Comparison Cards.
- **Script:**
  > *"Look at the results side by side:*
  > - *On the Naive Standard Market, Trader 1 carried a 20x long over the weekend. An 8% gap causes a 160% loss of margin. The position is wiped into negative equity, leaving **7,487.26 USDx** of unbacked bad debt that directly erodes liquidity provider capital.*
  > - *On the Nyxor Guarded Market, the position was deleveraged to 5x on Friday. An 8% gap causes only a 40% loss of margin. Trader equity is 6,000 USDx, well above the 3,000 USDx maintenance margin. **Zero liquidations, zero bad debt**, and 100% LP solvency preserved."*

### 6. Segment 5: On-Chain Audit Proof (2:45 – 3:00)
- **Visual:** Toggle to the **Frozen Benchmark** tab and show the **Recorded Benchmark Run** table with verified Snowscan transaction receipts.
- **Script:**
  > *"Every single transaction from this run has been executed, verified, and permanently frozen on Avalanche Fuji C-Chain with exact two-sided token conservation proven on-chain. All contracts, policies, and tests are open-source. The market closes on Friday; your risk shouldn't."*
