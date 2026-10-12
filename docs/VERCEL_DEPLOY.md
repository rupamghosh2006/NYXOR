# Hosting Nyxor Web App on Vercel

## Overview
The Nyxor Protocol web application connects to verified smart contracts on Avalanche Fuji C-Chain.
- **Zero Secrets**: No private keys or private RPC tokens are needed or stored in environment variables.
- **Fallback RPCs**: The frontend uses Viem's `fallback()` transport across multiple public Fuji RPC endpoints (`api.avax-test.network` and `avalanche-fuji-c-chain-rpc.publicnode.com`). If one endpoint is rate-limited, it automatically falls back to the secondary endpoint.

---

## Step 1 — Connect the repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the GitHub repo `rupamghosh2006/NYXOR`
3. Set **Root Directory** = `apps/web`
4. Framework preset = **Next.js** (auto-detected)

---

## Step 2 — Environment Variables in Vercel

Navigate to **Project → Settings → Environment Variables**:

| Variable | Value | Description |
|---|---|---|
| `NEXT_PUBLIC_CHAIN` | `fuji` | Active chain (`fuji` or `l1`) |
| `NEXT_PUBLIC_FUJI_RPC_URL` | `https://api.avax-test.network/ext/bc/C/rpc` | Public Fuji RPC endpoint (fallback configured) |
| `NEXT_PUBLIC_FUJI_EXPLORER` | `https://testnet.snowscan.xyz` | Explorer base URL |

> [!NOTE]
> All `NEXT_PUBLIC_*` variables are client-facing in the browser bundle. **Never put private keys, API secrets, or authenticated RPC URLs with secret tokens in `NEXT_PUBLIC_*` variables.** The application is designed to function with public endpoints using Viem's automatic failover transport.

---

## Step 3 — Build & Deploy

Click **Deploy**. Vercel will run:
```bash
pnpm install --frozen-lockfile
pnpm --filter nyxor-web build
```
Output directory is `.next` (auto-detected).

---

## Step 4 — Contract Addresses & Verification Links

Contract addresses are automatically imported from `deployments/fuji.json` at build time.
Verified on Routescan / Snowscan:
- `PerpMarketGuarded`: `0x400D575b8BE7a395fBF4BC8161A4A454605730C7`
- `LiquidityVaultGuarded`: `0x648b16f94C1ff3776368d8Bc067b5F8881ce6Cfd`
- `PerpMarketStandard`: `0x2268c8cB67e1cd78Ca4Ab254894BB5F5D1E23Fab`
- `LiquidityVaultStandard`: `0x4c38297282959b86482b10d59210c3f2df84B659`

---

## Step 5 — Nyxor L1 Switch (Future / Day 6)

When deploying to the Nyxor Subnet L1, configure:
```env
NEXT_PUBLIC_CHAIN=l1
NEXT_PUBLIC_L1_CHAIN_ID=<l1_chain_id>
NEXT_PUBLIC_L1_RPC_URL=<l1_public_rpc>
NEXT_PUBLIC_L1_EXPLORER=<l1_explorer_url>
```
The UI will automatically update the active chain, network pill, and RPC transport.
