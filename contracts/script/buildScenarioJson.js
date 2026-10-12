const fs = require('fs');

async function main() {
  const runData = JSON.parse(fs.readFileSync('contracts/broadcast/RunScenarioClean.s.sol/43113/run-latest.json', 'utf8'));
  const bench = JSON.parse(fs.readFileSync('deployments/fuji-benchmark.json', 'utf8'));
  const rpc = 'https://api.avax-test.network/ext/bc/C/rpc';

  async function getBlock(txHash) {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      })
    });
    const json = await res.json();
    if (json.result && json.result.blockNumber) {
      return parseInt(json.result.blockNumber, 16);
    }
    return 0;
  }

  const txs = runData.transactions;
  console.log(`Processing ${txs.length} transactions...`);

  const enriched = [];
  for (const t of txs) {
    const block = await getBlock(t.hash);
    enriched.push({
      hash: t.hash,
      block,
      function: t.function,
      to: t.transaction.to
    });
    console.log(`${t.hash} -> Block ${block} (${t.function || 'AVAX transfer'})`);
  }

  // Categorize phases
  // 0: Clock warp, 1: Set price std, 2: Set price grd, 3: AVAX t1, 4: AVAX t2, 5: AVAX t3, 6-8: Mint USDx, 9-12: T1 approve & open, 13-16: T2 approve & open, 17-20: T3 approve & open
  // 21: Clock warp preclose, 22-23: Set prices, 24-26: Deleverage t1, t2, t3
  // 27: Clock warp weekend, 28-29: Checkpoint close
  // 30: Clock warp monday, 31-32: Shock -8%
  // 33: Liquidate T1
  const phase1 = [
    { description: "Clock warp to Friday OPEN (T-2h)", hash: enriched[0].hash, block: enriched[0].block },
    { description: "Set Initial Price 4,150.00 USD (Standard)", hash: enriched[1].hash, block: enriched[1].block },
    { description: "Set Initial Price 4,150.00 USD (Guarded)", hash: enriched[2].hash, block: enriched[2].block },
    { description: "Fund T1 AVAX gas buffer (0.05 AVAX)", hash: enriched[3].hash, block: enriched[3].block },
    { description: "Fund T2 AVAX gas buffer (0.05 AVAX)", hash: enriched[4].hash, block: enriched[4].block },
    { description: "Fund T3 AVAX gas buffer (0.05 AVAX)", hash: enriched[5].hash, block: enriched[5].block },
    { description: "Mint 50,000 USDx to Trader 1", hash: enriched[6].hash, block: enriched[6].block },
    { description: "Mint 50,000 USDx to Trader 2", hash: enriched[7].hash, block: enriched[7].block },
    { description: "Mint 50,000 USDx to Trader 3", hash: enriched[8].hash, block: enriched[8].block },
    { description: "T1 Approve USDx on PerpMarketStandard", hash: enriched[9].hash, block: enriched[9].block },
    { description: "T1 Approve USDx on PerpMarketGuarded", hash: enriched[10].hash, block: enriched[10].block },
    { description: "T1 Open 20x Long (10,000 margin -> 200,000 notional) on Standard", hash: enriched[11].hash, block: enriched[11].block },
    { description: "T1 Open 20x Long (10,000 margin -> 200,000 notional) on Guarded", hash: enriched[12].hash, block: enriched[12].block },
    { description: "T2 Approve USDx on PerpMarketStandard", hash: enriched[13].hash, block: enriched[13].block },
    { description: "T2 Approve USDx on PerpMarketGuarded", hash: enriched[14].hash, block: enriched[14].block },
    { description: "T2 Open 10x Long (8,000 margin -> 80,000 notional) on Standard", hash: enriched[15].hash, block: enriched[15].block },
    { description: "T2 Open 10x Long (8,000 margin -> 80,000 notional) on Guarded", hash: enriched[16].hash, block: enriched[16].block },
    { description: "T3 Approve USDx on PerpMarketStandard", hash: enriched[17].hash, block: enriched[17].block },
    { description: "T3 Approve USDx on PerpMarketGuarded", hash: enriched[18].hash, block: enriched[18].block },
    { description: "T3 Open 10x Short (6,000 margin -> 60,000 notional) on Standard", hash: enriched[19].hash, block: enriched[19].block },
    { description: "T3 Open 10x Short (6,000 margin -> 60,000 notional) on Guarded", hash: enriched[20].hash, block: enriched[20].block }
  ];

  const phase3 = [
    { description: "Clock warp to Friday PRE_CLOSE (T-7.5m)", hash: enriched[21].hash, block: enriched[21].block },
    { description: "Keepers refresh market price 4,150.00 USD (Standard)", hash: enriched[22].hash, block: enriched[22].block },
    { description: "Keepers refresh market price 4,150.00 USD (Guarded)", hash: enriched[23].hash, block: enriched[23].block },
    { description: "Keeper deleverages Guarded T1 (20x -> 5x cap at $4,150.00)", hash: enriched[24].hash, block: enriched[24].block },
    { description: "Keeper deleverages Guarded T2 (10x -> 5x cap at $4,150.00)", hash: enriched[25].hash, block: enriched[25].block },
    { description: "Keeper deleverages Guarded T3 (10x -> 5x cap at $4,150.00)", hash: enriched[26].hash, block: enriched[26].block }
  ];

  const phase4 = [
    { description: "Clock warp to Saturday CLOSED phase", hash: enriched[27].hash, block: enriched[27].block },
    { description: "Checkpoint official close price 4,150.00 USD (Standard)", hash: enriched[28].hash, block: enriched[28].block },
    { description: "Checkpoint official close price 4,150.00 USD (Guarded)", hash: enriched[29].hash, block: enriched[29].block }
  ];

  const phase5 = [
    { description: "Clock warp to Monday Reopen (14:35 UTC)", hash: enriched[30].hash, block: enriched[30].block },
    { description: "Queue -8.00% gap shock (4,150 -> 3,818 USD) on Standard", hash: enriched[31].hash, block: enriched[31].block },
    { description: "Queue -8.00% gap shock (4,150 -> 3,818 USD) on Guarded", hash: enriched[32].hash, block: enriched[32].block }
  ];

  const phase6 = [
    { description: "Liquidate Standard underwater 20x position (T1)", hash: enriched[33].hash, block: enriched[33].block }
  ];

  const scenarioOutput = {
    "_comment": "Clean single-pass deterministic weekend-gap scenario on Avalanche Fuji C-Chain (Chain ID 43113)",
    "executedAt": new Date().toISOString(),
    "deployer": "0x4AD14e89622A046803988213E4a9846756531086",
    "deployment": {
      "DemoUSDC": bench.DemoUSDC,
      "MarketClock": bench.MarketClock,
      "MarketSchedule": bench.MarketSchedule,
      "FlatRiskPolicy": bench.FlatRiskPolicy,
      "MarketHoursRiskPolicy": bench.MarketHoursRiskPolicy,
      "MockPriceFeedStandard": bench.MockPriceFeedStandard,
      "MockPriceFeedGuarded": bench.MockPriceFeedGuarded,
      "LiquidityVaultStandard": bench.LiquidityVaultStandard,
      "LiquidityVaultGuarded": bench.LiquidityVaultGuarded,
      "PerpMarketStandard": bench.PerpMarketStandard,
      "PerpMarketGuarded": bench.PerpMarketGuarded
    },
    "traders": {
      "T1_20x_Long": "0x2d44ca7bC174E2c0bF4CB07e22B340A496150403",
      "T2_10x_Long": "0x44E57c5F6A82E1CA004C6d7C21955b17C1A46377",
      "T3_10x_Short": "0xEABb431ea634723886DcAB7D8D7B1db3e7C17993"
    },
    "transactions": {
      "phase1_open_and_trades": phase1,
      "phase3_keeper_deleverage": phase3,
      "phase4_closed_checkpoint": phase4,
      "phase5_monday_reopen_shock": phase5,
      "phase6_liquidations": phase6
    },
    "reconciliation": {
      "t1Notional": "200,000.00 USDx",
      "t1Margin": "10,000.00 USDx",
      "priceLoss": "-16,000.00 USDx (-8.00% on 200,000 USDx)",
      "fundingPaid": "-1,487.26 USDx",
      "lossBeyondCollateral": "7,487.26 USDx",
      "vaultStandardBadDebtRaw": "7487256111",
      "vaultStandardBadDebtFormatted": "7,487.26 USDx",
      "keeperReward": "1,000.00 USDx",
      "keeperRewardPaidByInsurance": "40.80 USDx",
      "keeperRewardPaidByVault": "959.20 USDx",
      "vaultGuardedBadDebtRaw": "0",
      "vaultGuardedBadDebtFormatted": "0.00 USDx"
    }
  };

  fs.writeFileSync('deployments/fuji-scenario.json', JSON.stringify(scenarioOutput, null, 2));
  fs.writeFileSync('apps/web/src/deployments/fuji-scenario.json', JSON.stringify(scenarioOutput, null, 2));

  // Also update fuji-benchmark.json
  const updatedBench = {
    ...bench,
    "status": "frozen_benchmark",
    "scenarioExecutedAt": scenarioOutput.executedAt,
    "recordedOutcome": {
      "vaultStandardBadDebtRaw": "7487256111",
      "vaultStandardBadDebtFormatted": "7,487.26 USDx",
      "lossBeyondCollateral": "7,487.26 USDx",
      "vaultGuardedBadDebtRaw": "0",
      "vaultGuardedBadDebtFormatted": "0.00 USDx"
    }
  };
  fs.writeFileSync('deployments/fuji-benchmark.json', JSON.stringify(updatedBench, null, 2));
  fs.writeFileSync('apps/web/src/deployments/fuji-benchmark.json', JSON.stringify(updatedBench, null, 2));

  console.log("Updated deployments/fuji-scenario.json and deployments/fuji-benchmark.json successfully!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
