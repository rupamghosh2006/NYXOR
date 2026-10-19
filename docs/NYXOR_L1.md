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
| **Subnet ID** | `2rXbQTjPnXKnRpogaLshYEmYfnLFahCgJ5gfuJ4dciHvJb6A9j` | P-Chain Subnet identifier |
| **Blockchain ID** | `2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS` | P-Chain Blockchain identifier |
| **VM ID** | `srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy` | Subnet-EVM Virtual Machine ID |
| **RPC URL** | `https://nodes-prod.43.207.73.245.sslip.io/ext/bc/2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS/rpc` | Hosted HTTPS RPC endpoint |
| **Live Web Terminal** | [https://nyxor-protocol.vercel.app](https://nyxor-protocol.vercel.app) | Live production web application |
| **L1 Creation Transaction** | [L1 Creation Transaction](https://build.avax.network/explorer/mainnet/2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS/block/1) | Builder Hub Block 1 Receipt |
| **Block Explorer** | [Firn Explorer](https://2rbfkegm.firn.gg) | Real-time block explorer |

---

## 3. Validator & Consensus Architecture (ACP-77 / ACP-99)

Nyxor L1 operates on Proof of Authority (PoA) consensus managed by on-chain validator management contracts deployed directly on the L1:

* **Validator Node ID:** `NodeID-EKvv1jhJTCzBmKjm8P3jRvQ1cB3sTKDg2`
* **BLS Public Key:** `0xb4c868c46b46e0fdd2c6566c27e8dc619841ccbe068b3e2154c7d29efe79495cad3234d3cb74c1b700cc53bde09155a2`
* **Validation ID (ACP-77):** `6GXB4EYaJk7akgrkKvaiTUQyk6zCXF2vNgHGyHPxcLR5e85ur`
* **Validator Weight:** `100` (Consensus weight)
* **P-Chain Staked Balance:** `0.1 AVAX` (`100,000,000 nAVAX`)
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

### D. Deployed Nyxor Protocol Suite (On Nyxor L1)
| Contract | Address | Description |
|---|---|---|
| **`DemoUSDC`** | `0x802508DB190b1826c6fC4238B5172F344ba96811` | L1 test margin asset (`USDx`) |
| **`MarketClock`** | `0x0269Fa1782f5Ed743486091900aa24eF1C8dCadA` | L1 simulated market time engine |
| **`MarketSchedule`** | `0x3f5560b462Dc91339FAAeaCde7A0E98D26a20aAb` | Weekend equity market schedule |
| **`MockPriceFeedStandard`** | `0x7F7b80959F30A06D3f066b8b63B065B02aD1A4D7` | Unmanaged oracle price feed |
| **`MockPriceFeedGuarded`** | `0x66ac4aB263B69BE7003089BE185A202a9E981fCa` | Pre-close check-pointing price feed |
| **`FlatRiskPolicy`** | `0x4341D3A566AC6e0e51076B9fEf68EFE3ca5E047F` | 20x unmanaged flat risk policy |
| **`MarketHoursRiskPolicy`** | `0x820BE01587cfd1F9c6d46cB363f09D5c9Dcae974` | Dynamic market-hours risk policy |
| **`LiquidityVaultStandard`** | `0x4c38297282959b86482b10d59210c3f2df84B659` | Standard LP vault (seeded with 500k USDx) |
| **`LiquidityVaultGuarded`** | `0x648b16f94C1ff3776368d8Bc067b5F8881ce6Cfd` | Guarded LP vault (seeded with 500k USDx) |
| **`PerpMarketStandard`** | `0x2268c8cB67e1cd78Ca4Ab254894BB5F5D1E23Fab` | Standard perpetual futures market |
| **`PerpMarketGuarded`** | `0x400D575b8BE7a395fBF4BC8161A4A454605730C7` | Guarded perpetual futures market |

---

## 5. Verified Transaction Hashes & On-Chain Proofs

### P-Chain Lifecycle Transactions
1. **Subnet Creation (`CreateSubnetTx`):**
   * **Tx ID:** [`2rXbQTjPnXKnRpogaLshYEmYfnLFahCgJ5gfuJ4dciHvJb6A9j`](https://build.avax.network/explorer/fuji/p-chain/tx/2rXbQTjPnXKnRpogaLshYEmYfnLFahCgJ5gfuJ4dciHvJb6A9j)
2. **Blockchain Creation (`CreateChainTx`):**
   * **Tx ID:** [`2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS`](https://build.avax.network/explorer/fuji/p-chain/tx/2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS)
   * *Creates the blockchain state on Fuji P-Chain with custom Subnet-EVM genesis parameters.*
3. **Subnet to L1 Conversion (`ConvertSubnetToL1Tx`):**
   * **Tx ID:** [`bdyG8ymzvi2RpiHcJiQvD1ugKSht8VrFXVPjLZzvNxAp3cHhx`](https://build.avax.network/explorer/fuji/p-chain/tx/bdyG8ymzvi2RpiHcJiQvD1ugKSht8VrFXVPjLZzvNxAp3cHhx)
   * *Converts the Subnet into a sovereign ACP-77 L1, stakes 0.1 AVAX, and binds the Validator Manager.*

### Verified Cross-Chain Teleporter Message
* **Source Chain:** Nyxor L1 (`Chain ID: 98421`)
* **Destination Chain:** Avalanche Fuji C-Chain (`Chain ID: 43113`)
* **Margin Token (USDx):** `0x802508DB190b1826c6fC4238B5172F344ba96811`
* **Relayer Lockbox Address:** `0x40e8484138998f777Be39DB3Baa8Ba425D5a882F`
* **Payload / Collateral Amount:** `1,000.00 USDx`
* **Transaction Hash (Mined on Nyxor L1 Block 20):**  
  [`0x7b1581184594132edff78faa1700b4b5fdbac49d3948f7d074937abe410de4f4`](https://build.avax.network/explorer/mainnet/2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS/tx/0x7b1581184594132edff78faa1700b4b5fdbac49d3948f7d074937abe410de4f4)

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
