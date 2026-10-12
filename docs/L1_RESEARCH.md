# Subnet-EVM L1 Launch Feasibility & Route Comparison on Avalanche Fuji

> **Scope:** Research report evaluating routes to launch a Subnet-EVM L1 on Avalanche Fuji testnet with the `TxAllowList` precompile, executed from a Windows laptop in approximately one day of work.  
> **Rule §0 Compliance:** Current official documentation only. All claims are marked **[VERIFIED]** (with deep-link URLs to specific documentation pages), **[ESTIMATE]**, or **[UNVERIFIED]**. Generic landing pages (`build.avax.network`, `/docs`, `/academy`) are omitted; claims without deep-link documentation are strictly designated **[UNVERIFIED]**.

---

## 1. Executive Summary & The Infrastructure Question

### Does every route require infrastructure I must keep running?

**Plain Answer:** **YES, with exactly two temporary cloud-hosted exceptions:**
1. **Route 1 (Builder Console Managed Testnet Nodes):** Ava Labs provisions and hosts free validator nodes in their cloud for you. **[UNVERIFIED: Displayed in Builder Console node provisioning modal; no static deep-link doc page]**  
   **Constraint:** These managed nodes and hosted ICM relayers automatically shut down after **3 days (72 hours)**. **[UNVERIFIED: Stated in console modal; deep-link unavailable]**
2. **Route 2 (AvaCloud Managed L1):** AvaCloud provisions and hosts managed validator nodes in the cloud. **[VERIFIED: [AvaCloud Free Trial Guide](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-free-trial-plan-on-testnet-with-basic-setup)]**  
   **Constraint:** The Testnet Starter plan offers a **5-day free trial with no credit card required**. **[VERIFIED: [AvaCloud Free Trial Guide](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-free-trial-plan-on-testnet-with-basic-setup)]** After the trial, it requires a paid subscription (promotional rate: \$50/month for Testnet Starter; \$999/month was the promotional rate for Mainnet Starter). **[VERIFIED: [AvaCloud Pricing](https://avacloud.io/pricing)]**

**Why CLI routes (WSL2 / Codespaces) require persistent infrastructure:**  
An Avalanche L1 is a sovereign consensus network. Blocks are **not** produced by Avalanche's Primary Network or Fuji C-Chain validators. An L1 requires dedicated validator nodes running `AvalancheGo` with the `subnet-evm` plugin.
- `avalanche-cli` does **not** host cloud nodes; it only submits P-Chain registration transactions and prompts for a live validator `NodeID`. **[VERIFIED: [Avalanche CLI README](https://github.com/ava-labs/avalanche-cli)]**
- If you run the validator node locally inside **WSL2**, the node halts whenever your Windows laptop sleeps, hibernates, disconnects from Wi-Fi, or reboots. The L1 freezes immediately. **[UNVERIFIED: Operating system constraint]**
- If you run the validator node inside a **GitHub Codespace**, Codespaces automatically suspends after 30 minutes of inactivity, terminating the node and freezing the chain. **[VERIFIED: [GitHub Codespaces Lifecycle](https://docs.github.com/en/codespaces/customizing-your-codespace/setting-your-timeout-period-for-github-codespaces)]**
- Therefore, both CLI routes require provisioning and maintaining an always-on 24/7 Linux VPS (e.g., AWS EC2, Hetzner, DigitalOcean) with at least 16 GB RAM, 4 vCPUs, and 200 GB SSD storage.

---

## 2. Comparison Matrix

| Criteria | Route 1: Builder Console | Route 2: AvaCloud Managed | Route 3: `avalanche-cli` in WSL2 | Route 4: `avalanche-cli` in Codespaces |
|---|---|---|---|---|
| **Works from Windows?** | **YES [UNVERIFIED: Browser UI]** | **YES [VERIFIED: [AvaCloud Portal](https://portal.avacloud.io/)]** | **PARTIAL [VERIFIED: [CLI README](https://github.com/ava-labs/avalanche-cli)]** (Via WSL2 Ubuntu) | **YES [VERIFIED: [Codespaces Docs](https://docs.github.com/en/codespaces)]** |
| **Needs 24/7 local node?** | **NO [UNVERIFIED: Console cloud node]** | **NO [VERIFIED: [AvaCloud Docs](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-free-trial-plan-on-testnet-with-basic-setup)]** | **YES [UNVERIFIED]** (Halts on sleep) | **YES [VERIFIED: [Codespaces Timeout](https://docs.github.com/en/codespaces/customizing-your-codespace/setting-your-timeout-period-for-github-codespaces)]** |
| **Node Lifespan / Availability** | **3 Days (72 hrs) [UNVERIFIED]** | **5-Day Free Trial [VERIFIED: [AvaCloud Free Trial](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-free-trial-plan-on-testnet-with-basic-setup)]** | Bound to laptop uptime | Bound to container active session |
| **Financial Cost** | **Free (\$0) [UNVERIFIED]** | **Free for 5 Days, then \$50/mo promo [VERIFIED: [AvaCloud Pricing](https://avacloud.io/pricing)]** | Free (or VPS hosting fee) | Free tier Codespaces |
| **Fuji AVAX Needed** | ~2–5 Fuji AVAX **[ESTIMATE]** | Handled / ~1.33 AVAX/mo **[ESTIMATE]** | ~2–5 Fuji AVAX **[ESTIMATE]** | ~2–5 Fuji AVAX **[ESTIMATE]** |
| **Faucet Access** | 1-click via Builder Account **[UNVERIFIED]** | Portal integration **[UNVERIFIED]** | Public faucet (rate-limited) **[VERIFIED: [Core Faucet](https://core.app/tools/testnet-faucet/)]** | Public faucet (rate-limited) **[VERIFIED: [Core Faucet](https://core.app/tools/testnet-faucet/)]** |
| **`TxAllowList` Support** | Genesis Builder + Toolbox **[VERIFIED: [Genesis Precompiles](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/01-permissioning-precompiles)]** | Basic setup: **[UNVERIFIED]** / Advanced: **[VERIFIED: [AvaCloud Precompiles](https://docs.avacloud.io/portal/precompiles)]** | Genesis JSON edit **[VERIFIED: [Subnet-EVM Repo](https://github.com/ava-labs/subnet-evm)]** | Genesis JSON edit **[VERIFIED: [Subnet-EVM Repo](https://github.com/ava-labs/subnet-evm)]** |
| **RPC URL Provided** | Hosted HTTPS endpoint **[UNVERIFIED]** | Dedicated High-Avail HTTPS **[VERIFIED: [AvaCloud Free Trial](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-free-trial-plan-on-testnet-with-basic-setup)]** | `http://localhost:9650` (or VPS IP) **[UNVERIFIED]** | Port-forwarded URL **[VERIFIED: [Codespaces Docs](https://docs.github.com/en/codespaces)]** |
| **Block Explorer** | Subnet Explorer listing **[VERIFIED: [Avalanche Explorer](https://explorer-test.avax.network/)]** | Dedicated branded explorer **[VERIFIED: [AvaCloud Hidden Explorer](https://docs.avacloud.io/portal/features/hidden-explorer)]** | None (manual setup required) | None (manual setup required) |
| **Tooling Status** | **Active [UNVERIFIED]** | **Active Enterprise [VERIFIED: [AvaCloud](https://avacloud.io/)]** | **Deprecated / Maint. Mode [VERIFIED: [CLI README](https://github.com/ava-labs/avalanche-cli)]** | **Deprecated / Maint. Mode [VERIFIED: [CLI README](https://github.com/ava-labs/avalanche-cli)]** |
| **Setup Time** | **1–2 hours [ESTIMATE]** | **15–30 mins [ESTIMATE]** | **6–12 hours [ESTIMATE]** | **4–8 hours [ESTIMATE]** |

---

## 3. Deep Route-by-Route Evaluation

### Route 1: Avalanche Builder Console (`build.avax.network`)

*   **Official Documentation Deep-Links:**
    *   Genesis Permissioning Precompiles: [https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/01-permissioning-precompiles](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/01-permissioning-precompiles)
    *   Create L1 Step-by-Step: [https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/02-create-l1](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/02-create-l1)
    *   Testing Allowlist Precompile: [https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/03-test-transaction-deployer-allowlist](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/03-test-transaction-deployer-allowlist)
    *   Interacting with Precompiles: [https://docs.avax.network/docs/avalanche-l1s/precompiles/interacting-with-precompiles](https://docs.avax.network/docs/avalanche-l1s/precompiles/interacting-with-precompiles)
    *   Subnet Explorer: [https://explorer-test.avax.network/](https://explorer-test.avax.network/)
*   **Does it work from Windows?**
    *   **[UNVERIFIED: Browser UI; no dedicated OS compatibility doc]** Compatible with Chrome, Edge, Brave, and Firefox on Windows. Connects directly to Core Wallet or MetaMask browser extension.
*   **Does it require keeping validator nodes running 24/7?**
    *   **[UNVERIFIED: Console testnet feature]** Ava Labs provisions free, managed cloud validator nodes and hosted ICM relayers through the Builder Console.
    *   **Critical Constraint [UNVERIFIED: In-console modal notice]** Managed testnet nodes automatically shut down after **3 days (72 hours)**. Hosted ICM relayers also shut down after 3 days.
*   **Fuji AVAX requirements and acquisition:**
    *   **[ESTIMATE]** Requires ~2–5 Fuji AVAX total for P-Chain creation transactions (`CreateSubnetTx`, `CreateChainTx`) and initial validator balance (ACP-77 dynamic validator fees are ~1.33 AVAX/month **[ESTIMATE]**).
    *   **Acquisition [UNVERIFIED: Console faucet]** Builder Account unlocks faucet claims. Public fallback: [https://core.app/tools/testnet-faucet/](https://core.app/tools/testnet-faucet/) **[VERIFIED: [Core Faucet](https://core.app/tools/testnet-faucet/)]**.
*   **How to enable `TxAllowList` and set Admin:**
    *   **[VERIFIED: [Genesis Permissioning Precompiles](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/01-permissioning-precompiles)]** Must be toggled and configured in the Genesis Builder before the chain is created. *(See Section 5).*
*   **How to add relayer and keeper addresses to the allowlist:**
    *   **[VERIFIED: [Interacting with Precompiles](https://docs.avax.network/docs/avalanche-l1s/precompiles/interacting-with-precompiles)]** Precompile address: `0x0200000000000000000000000000000000000002`. Admin calls `setEnabled(address)` via the Transactor Allowlist tool in the Toolbox after the chain is running.
*   **RPC URL and Explorer provided:**
    *   **[UNVERIFIED: Console endpoint]** RPC URL: Hosted HTTPS endpoint (`https://subnets.avax.network/...`).
    *   **[VERIFIED: [Avalanche Explorer](https://explorer-test.avax.network/)]** Explorer: Indexed on Avalanche Subnet Explorer.
*   **Known pitfalls:**
    *   Managed nodes expire in 72 hours; all state is lost when the node terminates.
    *   If `TxAllowList` is not enabled in genesis, the Toolbox will show "not available / not activated"; the only fix is to recreate the chain. **[VERIFIED: [Create L1 Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/02-create-l1)]**
    *   Whether the relayer and keeper must be allowlisted before transacting is to be verified in the Day 5 rehearsal.

---

### Route 2: AvaCloud Managed L1 (`avacloud.io`)

*   **Official Documentation Deep-Links:**
    *   Portal: [https://portal.avacloud.io/](https://portal.avacloud.io/)
    *   Pricing: [https://avacloud.io/pricing](https://avacloud.io/pricing)
    *   Free Trial Basic Setup Guide: [https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-free-trial-plan-on-testnet-with-basic-setup](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-free-trial-plan-on-testnet-with-basic-setup)
    *   Advanced Setup Guide (Paid Starter/Pro): [https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-starter-or-pro-plan-on-testnet-with-advanced-setup](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-starter-or-pro-plan-on-testnet-with-advanced-setup)
    *   Precompiles Menu: [https://docs.avacloud.io/portal/precompiles](https://docs.avacloud.io/portal/precompiles)
    *   Hidden / Dedicated Explorer: [https://docs.avacloud.io/portal/features/hidden-explorer](https://docs.avacloud.io/portal/features/hidden-explorer)
*   **Does it work from Windows?**
    *   **[VERIFIED: [AvaCloud Portal](https://portal.avacloud.io/)]** Yes. 100% web-based portal and REST API.
*   **Does it require keeping validator nodes running 24/7?**
    *   **[VERIFIED: [AvaCloud Free Trial Guide](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-free-trial-plan-on-testnet-with-basic-setup)]** No. AvaCloud provisions, maintains, and monitors cloud validators.
*   **Plan, Pricing & Free Trial Details:**
    *   **[VERIFIED: [AvaCloud Free Trial Guide](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-free-trial-plan-on-testnet-with-basic-setup)]** Testnet Starter Plan includes a **5-day free trial** with **no credit card required**, provisioning 2 Testnet validators, 1 Testnet RPC, and 1 Developer RPC. Provisioning takes ~15 minutes **[ESTIMATE]**.
    *   **[VERIFIED: [AvaCloud Pricing](https://avacloud.io/pricing)]** After the trial, Testnet Starter promotional pricing is **\$50 / month**.
*   **Can the Free Trial creation flow enable the Transaction Allow List at genesis?**
    *   **[UNVERIFIED: Not documented in Basic Setup guide]** The [Free Trial Basic Setup Guide](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-free-trial-plan-on-testnet-with-basic-setup) outlines an automated quickstart flow without exposing precompile toggles. Precompile configuration (including the "Transaction Manager" allowlist) is explicitly documented only in the [Advanced Setup Guide](https://docs.avacloud.io/portal/l-1-creation/how-to-create-an-l-1-with-the-starter-or-pro-plan-on-testnet-with-advanced-setup) for paid Starter/Pro tiers. It is unverified whether the Free Trial UI allows custom precompiles or enforces defaults.
*   **Does AvaCloud provide an explorer?**
    *   **[VERIFIED: [AvaCloud Hidden Explorer Docs](https://docs.avacloud.io/portal/features/hidden-explorer)]** **YES.** Dedicated Routescan-powered explorer with public and private access modes.
*   **Known pitfalls:**
    *   Free trial ends strictly after **5 days**; nodes shut down unless converted to a paid tier.

---

### Route 3: `avalanche-cli` under WSL2 (Ubuntu on Windows)

*   **Official Documentation Deep-Links:**
    *   CLI Repository: [https://github.com/ava-labs/avalanche-cli](https://github.com/ava-labs/avalanche-cli)
    *   Microsoft WSL Docs: [https://learn.microsoft.com/en-us/windows/wsl/](https://learn.microsoft.com/en-us/windows/wsl/)
*   **Does it work from Windows?**
    *   **[VERIFIED: [CLI README](https://github.com/ava-labs/avalanche-cli)]** Native Windows: **NO**.  
        > *"Avalanche CLI is not currently supported on Windows. It has been tested on Linux and macOS."*
    *   **[VERIFIED: [Microsoft WSL Docs](https://learn.microsoft.com/en-us/windows/wsl/)]** Under WSL2: **YES**. Runs within the Linux subsystem.
*   **Does it require keeping validator nodes running 24/7?**
    *   **[VERIFIED: [CLI README](https://github.com/ava-labs/avalanche-cli)]** **YES.** `avalanche-cli` only submits P-Chain transactions; it does not host cloud nodes. If running locally in WSL2, the node halts when Windows sleeps or restarts.
*   **Known pitfalls:**
    *   **[VERIFIED: [CLI README](https://github.com/ava-labs/avalanche-cli)]** Entered **Maintenance Mode** in December 2025; no new features.
    *   **[VERIFIED: [CLI README](https://github.com/ava-labs/avalanche-cli)]** Docker inside WSL2 requires explicit IPv6 configuration (`/etc/docker/daemon.json`).

---

### Route 4: `avalanche-cli` in GitHub Codespaces (Dev Container)

*   **Official Documentation Deep-Links:**
    *   Codespaces Lifecycle: [https://docs.github.com/en/codespaces/customizing-your-codespace/setting-your-timeout-period-for-github-codespaces](https://docs.github.com/en/codespaces/customizing-your-codespace/setting-your-timeout-period-for-github-codespaces)
    *   CLI Repository: [https://github.com/ava-labs/avalanche-cli](https://github.com/ava-labs/avalanche-cli)
*   **Does it require keeping validator nodes running 24/7?**
    *   **[VERIFIED: [Codespaces Lifecycle](https://docs.github.com/en/codespaces/customizing-your-codespace/setting-your-timeout-period-for-github-codespaces)]** **YES, and Codespaces fails this requirement.** Default idle timeout is 30 minutes; max timeout is 4 hours. Node halts upon hibernation.
*   **Known pitfalls:**
    *   **[VERIFIED: [CLI README](https://github.com/ava-labs/avalanche-cli)]** Requires host Docker daemon IPv6 (`fixed-cidr-v6`), which standard Codespaces users cannot configure.

---

## 4. Longevity & Validator Lifecycle: What Happens When Nodes Expire?

### 1. Can I add new managed nodes as validators before expiry?
*   **[UNVERIFIED: Architectural consensus behavior]** While the network is actively producing blocks, the L1 operator can attach new validator nodes via P-Chain validator registration (`registerL1Validator` / `AddValidatorTx`) to hand off consensus before the initial node shuts down.

### 2. Can I add validators after all validators have expired?
*   **[UNVERIFIED: Architectural consensus behavior]** If all validators expire, block production halts (the chain stalls). If the VMC is on C-Chain, P-Chain registration can be submitted, but newly joined nodes must sync block history from surviving peers. If all ephemeral nodes were decommissioned upon expiration, the historical block database is gone, making reviving the same chain practically impossible without an external state backup.

### 3. Does the Validator Manager need the chain to be live?
*   **If VMC is deployed on the L1:** **[UNVERIFIED: EVM consensus dependency]** **YES.** If the chain is stalled, it cannot process EVM transactions to execute VMC calls.
*   **If VMC is deployed on the C-Chain:** **[UNVERIFIED: Interchain architecture]** **NO.** The C-Chain operates independently. Transactions execute on C-Chain and communicate with P-Chain via Warp messages.

### 4. What happens to the chain, RPC, and contracts after expiry?
*   **[UNVERIFIED: Based on cloud infrastructure lifecycle]**
    *   **RPC:** Hosted endpoint goes offline (connection timeout / 502 Bad Gateway).
    *   **Block Production:** Halts immediately.
    *   **Contracts:** Become inaccessible via RPC.
    *   **ICM Relayer:** Terminates, halting cross-chain messaging.

### 5. Can the same L1 be revived?
*   **[UNVERIFIED: Architectural consensus behavior]** P-Chain records persist indefinitely. The chain can theoretically resume only if an exact disk snapshot of the node database is attached to a newly registered validator node.

---

## 5. `TxAllowList` in Builder Console: The Correct Genesis & Toolbox Flow

> [!IMPORTANT]
> **Precompile Activation Rule:** In Subnet-EVM, stateful precompiles like `TxAllowList` (`0x0200000000000000000000000000000000000002`) **MUST be enabled at genesis (Block 0)** with an admin address.  
> If an L1 is deployed without enabling the precompile in genesis, the precompile storage is uninitialized. The Toolbox **Transactor Allowlist** tool will show **"Not available / Not activated"**. The documented fix on Builder Hub is to recreate the L1. **[VERIFIED: [Create L1 Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/02-create-l1)]**

### Step-by-Step Flow: Genesis Builder to Toolbox

#### Phase A: Genesis Builder (Before Chain Creation)
1.  **Open Genesis Builder:** In Builder Console, select **Create L1**. **[VERIFIED: [Create L1 Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/02-create-l1)]**
2.  **Network Parameters:** Set Name (`Nyxor L1`), Chain ID (`98421`), and Token Symbol (`NYX`).
3.  **Permissioning Section:** Locate the **Precompile / Permissioning** configuration section. **[VERIFIED: [Genesis Precompiles Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/01-permissioning-precompiles)]**
4.  **Enable Transaction Allow List:** Toggle **Transaction Allow List** (address `0x0200000000000000000000000000000000000002`) to **ON**. **[VERIFIED: [Genesis Precompiles Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/01-permissioning-precompiles)]**
5.  **Set Initial Admin:** Enter your deployer wallet address into the **Admin Addresses** field (grants Role `2` `Admin`). **[VERIFIED: [Genesis Precompiles Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/01-permissioning-precompiles)]**
6.  **Verify `genesis.json`:** Confirm that `config` contains: **[VERIFIED: [Genesis Precompiles Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/01-permissioning-precompiles)]**
    ```json
    "txAllowListConfig": {
      "blockTimestamp": 0,
      "adminAddresses": ["0xYourDeployerAddress"]
    }
    ```
    *(Reference template saved at `ops/l1/genesis.template.json`).*

#### Phase B: Deploy Chain & Start Managed Node
1.  **Create Chain:** Sign `CreateSubnetTx` and `CreateChainTx` on Fuji P-Chain using Core Wallet. **[VERIFIED: [Create L1 Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/02-create-l1)]**
2.  **Start Managed Node:** Select **Free Managed Testnet Node** in the console. **[UNVERIFIED: In-console modal feature]**
3.  **Convert to L1:** Sign `ConvertSubnetToL1Tx` and fund validator balance. **[VERIFIED: [Create L1 Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/02-create-l1)]**
4.  **Confirm Block Production:** Wait ~2 minutes for healthy block production status. **[ESTIMATE]**

#### Phase C: Managing Roles in the Transactor Allowlist Tool
1.  Navigate to **Builder Console -> Toolbox -> Transactor Allowlist**. **[VERIFIED: [Testing Allowlist Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/03-test-transaction-deployer-allowlist)]**
2.  Connect Admin / Deployer wallet.
3.  Select your L1 from the chain dropdown (the precompile will now be detected as active).
4.  Enter target address (trader, keeper, relayer).
5.  Select **Role 1 (`Enabled`)** and click **Submit / Set Role**. **[VERIFIED: [Testing Allowlist Guide](https://docs.avax.network/academy/avalanche-l1/access-restriction/02-genesis-activation/03-test-transaction-deployer-allowlist)]**
6.  Sign transaction in Core Wallet (calls `setEnabled(addr)` on `0x0200000000000000000000000000000000000002`). **[VERIFIED: [Interacting with Precompiles](https://docs.avax.network/docs/avalanche-l1s/precompiles/interacting-with-precompiles)]**
7.  Verify on the **Read Allowlist** tab that the address returns Role `1`.

---

## 6. Relayer, Keeper & Gas Distribution Mechanics

### Do the hosted ICM Relayer and Keeper addresses need to be enabled?
*   **[UNVERIFIED: To be tested in Day 5 rehearsal]**
*   **Hypothesis:** `TxAllowList` inspects the transaction sender (`tx.origin`) at the node mempool boundary. If an address has Role `0` (`None`), its transactions will be rejected before EVM execution.
    *   **ICM Relayer:** Submits transactions to deliver cross-chain messages to `TeleporterMessenger`. If not enabled, deliveries will fail.
    *   **Keeper Service:** Submits transactions to call `deleverageToCap` and `liquidate`. If not enabled, calls will fail.

### How does the L1 native gas token reach non-admin wallets?
*   **[UNVERIFIED: To be tested in Day 5 rehearsal]**
    1.  **Receiving Gas Tokens:** The Admin (allocated gas tokens at genesis in `alloc`) transfers gas tokens to the trader/keeper wallet.
    2.  **Sending Transactions:** The recipient cannot spend gas or execute transactions until the Admin grants them Role `1` (`Enabled`) on the `TxAllowList` precompile (`0x0200000000000000000000000000000000000002`).

---

## 7. The Helicon Upgrade Verification

*   **Activation Date:** **September 22, 2026 on Mainnet** (activated on Fuji in August 2026). **[UNVERIFIED: Network upgrade date announcement]**
*   **Changes:** Targeted Primary Network staking, 48-hour validator cycles, C-Chain Continuous Execution VM, and 90% validator uptime (ACP-267).
*   **Does Helicon alter L1 creation or Subnet-EVM?**
    *   **[UNVERIFIED: Derived from documentation]** Helicon documentation does not describe changes to P-Chain L1 transaction types (`CreateSubnetTx`, `CreateChainTx`), Subnet-EVM precompile interfaces (`TxAllowList` at `0x0200...0002`), or ACP-77 (Etna) dynamic validator staking fees (~1.33 AVAX/month **[ESTIMATE]**).

---

## 8. Day 5 Rehearsal Checklist & Implementation Strategy

### Rehearsal Checklist (Day 5, ~1 Hour)
Execute on a throwaway L1 before the official deployment to validate all assumptions:
- [ ] **1. Create Throwaway L1:** In Genesis Builder, toggle **Transaction Allow List** to ON and set deployer wallet as Admin.
- [ ] **2. Inspect Genesis:** Verify generated JSON contains `"txAllowListConfig": {"blockTimestamp": 0, "adminAddresses": ["0x..."]}`.
- [ ] **3. Start Managed Node:** Launch 3-day managed testnet node and complete `ConvertSubnetToL1Tx`.
- [ ] **4. Verify Tool Detection:** Open Toolbox -> Transactor Allowlist; confirm tool recognizes active precompile (not "not available / not activated").
- [ ] **5. Test Unauthorized Rejection:** Attempt a transaction from a fresh, non-allowlisted wallet; confirm transaction reverts / is rejected.
- [ ] **6. Authorize Second Wallet:** Use Transactor Allowlist tool to grant Role `1` (`Enabled`) to a secondary test wallet.
- [ ] **7. Test Authorized Execution:** Transfer gas tokens to the second wallet and confirm it can now execute transactions successfully.
- [ ] **8. Relayer Test:** Obtain the hosted ICM relayer address from the console and test adding it to the allowlist.
- [ ] **9. Document Deltas:** Record any unexpected error codes or UI differences in `docs/DECISIONS.md`.

---

## 9. Recommended Implementation Plan: The Late-L1 Strategy

```
[Day 1–4: Core Engine on Fuji C-Chain]
  └─ Deploy & verify all contracts on Fuji C-Chain (Chain ID 43113)
  └─ Run unit, fuzz, and WeekendGapScenario tests

[Day 5: The Rehearsal (Throwaway L1)]
  └─ Execute Day 5 Rehearsal Checklist (~1 hour)
  └─ De-risk allowlist workflow; let throwaway L1 expire

[Day 6–7: Real Nyxor L1 Launch & Demo Capture]
  └─ Launch official Nyxor L1 via Builder Console (or AvaCloud Free Trial)
  └─ Pre-enable Keeper and Relayer
  └─ Deploy Nyxor contracts to L1
  └─ Record ≤ 3-minute video demo immediately while nodes are live

[Day 8: Submission & Permanent Live Link]
  └─ Submit Fuji C-Chain deployment as permanent, non-expiring live link
  └─ Disclose L1 testnet lifecycle in README
```

1.  **Days 1–4 (Fuji C-Chain Primary):** Deploy all contracts to **Fuji C-Chain (Chain ID 43113)** as the permanent, verifiable live link for judges.
2.  **Day 5 (Rehearsal):** Complete the rehearsal checklist on a throwaway chain.
3.  **Day 6 or 7 (Official L1 Launch):** Launch the official **Nyxor L1**, deploy contracts, and record the demo video immediately while nodes are actively producing blocks.
4.  **Day 8 (Submission):** Submit Fuji C-Chain deployment as the permanent live link with clear disclosure of the temporary testnet L1 lifecycle in `README.md`.
