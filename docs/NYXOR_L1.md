# Nyxor L1: Sovereign Subnet-EVM, Precompiles & ICM Deployment Record

> **Network Status:** Active & Validating  
> **EVM Chain ID:** `98421`  
> **Deployment Date:** October 13, 2026  
> **Ecosystem:** Avalanche Fuji Testnet (ACP-77 / ACP-99 Compliant)

---

## 1. Executive Summary

Nyxor L1 is a sovereign, permissioned **Subnet-EVM Layer 1 blockchain** deployed on Avalanche Fuji testnet. Built to support institutional-grade Real-World Asset (RWA) perpetual futures, Nyxor L1 demonstrates:
1. **Sovereignty & Custom Gas:** Its own native gas token (`NYX`) with customized low-fee testnet parameters.
2. **Chain-Level Compliance:** Activation of the stateful `TxAllowList` precompile (`0x0200...0002`) at genesis to restrict transaction-sending rights at the consensus mempool boundary.
3. **Decentralized Interoperability:** Native Interchain Messaging (ICM) powered by Avalanche Warp Messaging (AWM) and Teleporter, verified via a live cross-chain message delivery between **Nyxor L1** and the **Avalanche Fuji C-Chain**.

---

## 2. Core Network Identifiers & Endpoints

| Identifier | Value | Description |
|---|---|---|
| **Network Name** | `Nyxor L1` | Official L1 designation |
| **EVM Chain ID** | `98421` | Ethereum-compatible chain identifier |
| **Native Token Symbol** | `NYX` | Native gas currency |
| **Genesis Allocation** | `1,000,000.0000 NYX` | Allocated to deployer at Block 0 |
| **Subnet ID** | `25ZDnC6Ji6JZxbPstyFiczGMJttvBUuH7KK1F2wFqLPUYQ5vo5` | P-Chain Subnet identifier |
| **Blockchain ID** | `2SrgwcLrpgt2kLrqhTr6fMaPFd1kN467ai3eaK4HcFyBq1YbaY` | P-Chain Blockchain identifier |
| **VM ID** | `srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy` | Subnet-EVM Virtual Machine ID |
| **RPC URL** | `https://nodes-prod.43.207.73.245.sslip.io/ext/bc/2SrgwcLrpgt2kLrqhTr6fMaPFd1kN467ai3eaK4HcFyBq1YbaY/rpc` | Hosted HTTPS RPC endpoint |
| **Block Explorer** | [Avalanche Subnet Explorer](https://explorer-test.avax.network/) | Official explorer index |

---

## 3. Validator & Consensus Architecture (ACP-77 / ACP-99)

Nyxor L1 operates on Proof of Authority (PoA) consensus managed by on-chain validator management contracts deployed directly on the L1:

* **Validator Node ID:** `NodeID-4sodDoXrW97ghLGGfDQKg1HmkjrqXhqVH`
* **Node Host:** `nodes-prod.43.207.73.245.sslip.io`
* **Validator Weight:** `100` (Consensus weight)
* **Lifecycle:** Managed cloud node provisioned via Avalanche Builder Console (Active until October 16, 2026).
* **P-Chain Owner Address:** `P-fuji1crw3r2f3k78daauw8ndgtvk8hzmk92azwgqgjv`
* **Deactivation Owner Address:** `P-fuji1crw3r2f3k78daauw8ndgtvk8hzmk92azwgqgjv`

---

## 4. Deployed Smart Contracts & Precompiles

### A. Compliance & Precompiles
* **`TxAllowList` Stateful Precompile:** `0x0200000000000000000000000000000000000002`
  * **Admin Address:** `0x4AD14e89622A046803988213E4a9846756531086` (Role `2` `Admin`)
  * **Function:** Enforces permissioned access. Transactions from unapproved senders revert at the node mempool boundary before EVM execution.
  * **Relayer Role:** `0x40e8484138998f777Be39DB3Baa8Ba425D5a882F` granted Role `1` (`Enabled`).

### B. Validator Management Contracts (On Nyxor L1)
* **`ValidatorManagerProxy` (TransparentUpgradeableProxy):** `0xfacade0000000000000000000000000000000000`
  * Pre-deployed at genesis block 0; upgraded to the implementation contract.
* **`ValidatorManagerImplementation`:** `0x0269fa1782f5ed743486091900aa24ef1c8dcada`
  * Core contract implementing ACP-99 validator lifecycle management.
* **`ValidatorMessagesLibrary`:** `0x802508db190b1826c6fc4238b5172f344ba96811`
  * Shared library for message encoding/decoding with P-Chain.

### C. Interchain Messaging (ICM) & Teleporter
* **`TeleporterMessenger`:** `0x253b2784c75e610dD0FF1da844684a1aC0aa5fcf`
  * Deterministic cross-chain messaging contract (identical address across all Avalanche chains).
* **Hosted Cloud Relayer Address:** `0x40e8484138998f777Be39DB3Baa8Ba425D5a882F`
  * Bidirectional monitoring: `Nyxor L1 (98421)` $\longleftrightarrow$ `Avalanche Fuji C-Chain (43113)`.
  * Gas Funded: `1.0000 NYX` on Nyxor L1 and `0.1000 AVAX` on Fuji C-Chain.

---

## 5. Verified Transaction Hashes & On-Chain Proofs

### P-Chain Lifecycle Transactions
1. **Blockchain Creation (`CreateChainTx`):**
   * **Tx ID:** `2SrgwcLrpgt2kLrqhTr6fMaPFd1kN467ai3eaK4HcFyBq1YbaY`
   * *Creates the blockchain state on Fuji P-Chain with the custom genesis parameters.*
2. **Subnet to L1 Conversion (`ConvertSubnetToL1Tx`):**
   * **Tx ID:** `2S6jeTQjgP6gdnWuNWsA3ZAKcXrgkQi86MxX16Qpq7KThBaitH`
   * *Converts the Subnet into a sovereign L1 and stakes validator balance under ACP-77.*

### Verified Cross-Chain Teleporter Message
* **Source Chain:** Nyxor L1 (`Chain ID: 98421`)
* **Destination Chain:** Avalanche Fuji C-Chain (`Chain ID: 43113`)
* **Source Contract (Nyxor L1):** `0x05c474824e7d2cc67cf22b456f7cf60c0e3a1289`
* **Destination Contract (Fuji C-Chain):** `0xd8b6b037b75b6605c34bf6b7f4dd0e93f40f1af7`
* **Payload Number:** `4820`
* **Transaction Hash (Broadcast on Nyxor L1):**  
  [`0x65ed8b74f1bb021fef5c509b996a161fbd382039196b78fb551b8c6c78853095`](https://testnet.snowscan.xyz/tx/0x65ed8b74f1bb021fef5c509b996a161fbd382039196b78fb551b8c6c78853095)

---

## 6. Genesis Configuration Reference

Below is the verified genesis configuration utilized for Nyxor L1:

```json
{
  "config": {
    "chainId": 98421,
    "homesteadBlock": 0,
    "eip150Block": 0,
    "eip155Block": 0,
    "eip158Block": 0,
    "byzantiumBlock": 0,
    "constantinopleBlock": 0,
    "petersburgBlock": 0,
    "istanbulBlock": 0,
    "muirGlacierBlock": 0,
    "subnetEVMTimestamp": 0,
    "feeConfig": {
      "gasLimit": 100000000,
      "minBaseFee": 1000000000,
      "targetGas": 100000000,
      "baseFeeChangeDenominator": 48,
      "minBlockGasCost": 0,
      "maxBlockGasCost": 0,
      "targetBlockRate": 2,
      "blockGasCostStep": 0
    },
    "txAllowListConfig": {
      "blockTimestamp": 0,
      "adminAddresses": [
        "0x4AD14e89622A046803988213E4a9846756531086"
      ]
    }
  },
  "alloc": {
    "0x4AD14e89622A046803988213E4a9846756531086": {
      "balance": "0xd3c21bcecceda1000000"
    }
  }
}
```

---

## 7. Submission Integration & Architecture Roles

Nyxor adopts a **Dual-Anchor Architecture** designed specifically for maximum hackathon score and permanent auditability:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              NYXOR DUAL-ANCHOR ARCHITECTURE                            │
│                                                                                        │
│  [Anchor 1: Permanent Solvency Benchmark]                                              │
│  Venue: Avalanche Fuji C-Chain (Chain ID: 43113)                                       │
│  Role:  Immutable financial audit reference. All 34 scenario transactions and the      │
│         $7,487.26 USDx vs $0.00 solvency outcome are permanently indexed on Snowscan.  │
│                                                                                        │
│  [Anchor 2: Sovereign Institutional Layer]                                             │
│  Venue: Nyxor L1 (Chain ID: 98421)                                                     │
│  Role:  Sovereign execution environment demonstrating custom gas tokens (NYX),         │
│         chain-level compliance (TxAllowList precompile), and native cross-chain        │
│         liquidity messaging via Avalanche Teleporter (ICM).                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
