# Hosting Nyxor Web App on Vercel

## Prerequisites
- Vercel CLI (`npm i -g vercel`) or Vercel dashboard
- GitHub repo already pushed to `rupamghosh2006/NYXOR`
- Optionally: a dedicated Fuji RPC endpoint (QuickNode, Infura, Alchemy — the public Fuji RPC rate-limits at ~50 req/s)

---

## Step 1 — Connect the repo

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the GitHub repo `rupamghosh2006/NYXOR`
3. Set **Root Directory** = `apps/web`
4. Framework preset = **Next.js** (auto-detected)

---

## Step 2 — Set environment variables in Vercel dashboard

Navigate to **Project → Settings → Environment Variables** and add:

| Variable | Value | Required? |
|---|---|---|
| `NEXT_PUBLIC_CHAIN` | `fuji` | Required |
| `NEXT_PUBLIC_FUJI_RPC_URL` | `https://api.avax-test.network/ext/bc/C/rpc` | Required — use your dedicated RPC here |
| `NEXT_PUBLIC_FUJI_EXPLORER` | `https://testnet.snowscan.xyz` | Required |
| `NEXT_PUBLIC_L1_CHAIN_ID` | *(leave empty until L1 deployed)* | Optional |
| `NEXT_PUBLIC_L1_RPC_URL` | *(leave empty until L1 deployed)* | Optional |
| `NEXT_PUBLIC_L1_EXPLORER` | *(leave empty until L1 deployed)* | Optional |
| `NEXT_PUBLIC_L1_CHAIN_NAME` | `Nyxor L1` | Optional |

**Address overrides** (only needed if you redeploy contracts):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_ADDR_DEMO_USDC` | Override DemoUSDC address |
| `NEXT_PUBLIC_ADDR_MARKET_CLOCK` | Override MarketClock address |
| `NEXT_PUBLIC_ADDR_MARKET_SCHEDULE` | Override MarketSchedule address |
| `NEXT_PUBLIC_ADDR_PERP_MARKET_STANDARD` | Override PerpMarketStandard |
| `NEXT_PUBLIC_ADDR_PERP_MARKET_GUARDED` | Override PerpMarketGuarded |
| `NEXT_PUBLIC_ADDR_VAULT_STANDARD` | Override LiquidityVaultStandard |
| `NEXT_PUBLIC_ADDR_VAULT_GUARDED` | Override LiquidityVaultGuarded |
| `NEXT_PUBLIC_ADDR_FEED_STANDARD` | Override MockPriceFeedStandard |
| `NEXT_PUBLIC_ADDR_FEED_GUARDED` | Override MockPriceFeedGuarded |
| `NEXT_PUBLIC_ADDR_FLAT_RISK_POLICY` | Override FlatRiskPolicy |
| `NEXT_PUBLIC_ADDR_MARKET_HOURS_RISK_POLICY` | Override MarketHoursRiskPolicy |
| `NEXT_PUBLIC_ADDR_DEPLOYER` | Override deployer address (controls admin console lock) |

> [!NOTE]
> If address overrides are not set, the build falls back to `deployments/fuji.json` at build time — the correct behaviour for the current deployment.

---

## Step 3 — Build & deploy

**Via Vercel dashboard:**
Click **Deploy**. Vercel will run:
```
pnpm install --frozen-lockfile
pnpm --filter nyxor-web build
```
Build output directory: `.next` (auto-detected by Vercel for Next.js)

**Via CLI (alternative):**
```bash
cd apps/web
vercel --prod
```
When prompted:
- Link to existing project? Yes (if already created in dashboard) / No (creates new)
- Root directory: `apps/web` if running from repo root

---

## Step 4 — RPC Rate Limiting

The public Fuji RPC (`api.avax-test.network`) rate-limits unauthenticated requests. The app polls contracts every 4s. Under active demo load you may see `429` errors.

**Solution — use a dedicated RPC endpoint:**
1. Sign up at [QuickNode](https://www.quicknode.com/) or [Infura](https://infura.io/) or [Alchemy](https://www.alchemy.com/)
2. Create an Avalanche Fuji endpoint
3. Set `NEXT_PUBLIC_FUJI_RPC_URL=<your-endpoint-url>` in Vercel

The endpoint URL is already wired in `src/config/chains.ts`:
```ts
export const FUJI_RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC_URL ||
  "https://api.avax-test.network/ext/bc/C/rpc";
```

---

## Step 5 — Switch to Nyxor L1 later

Once the L1 is deployed, redeploy contracts there and set:
```
NEXT_PUBLIC_CHAIN=l1
NEXT_PUBLIC_L1_CHAIN_ID=<l1-chain-id>
NEXT_PUBLIC_L1_RPC_URL=<l1-rpc>
NEXT_PUBLIC_L1_EXPLORER=<l1-explorer>
NEXT_PUBLIC_ADDR_PERP_MARKET_GUARDED=<l1-address>
# ... all other addresses
```

Redeploy on Vercel → the same frontend now targets the L1. No code changes needed.

---

## Checklist before going live

- [ ] `NEXT_PUBLIC_FUJI_RPC_URL` is a dedicated endpoint (not the public one)
- [ ] All `NEXT_PUBLIC_ADDR_*` variables are unset (use fuji.json defaults) or correctly overridden
- [ ] No secrets (`PRIVATE_KEY`, mnemonics, `.env`) committed to the repo
- [ ] Demo banner confirms simulated clock/oracle is displayed
- [ ] `badDebtTotal()` on the vault shows live values (check Snowscan or the Deployment Record section)
