// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MarketClock} from "../src/core/MarketClock.sol";
import {MockPriceFeed} from "../src/oracle/MockPriceFeed.sol";
import {LiquidityVault} from "../src/vault/LiquidityVault.sol";
import {PerpMarket} from "../src/core/PerpMarket.sol";

contract CompleteWeekendScenarioScript is Script {
    uint256 internal constant INITIAL_PRICE = 4150 * 1e8; // 4,150.00 USD
    uint256 internal constant FRI_OPEN = 1_792_161_000;
    uint256 internal constant FRI_CLOSE = 1_792_184_400;

    MarketClock internal clock;
    MockPriceFeed internal feedStandard;
    MockPriceFeed internal feedGuarded;
    LiquidityVault internal vaultStandard;
    LiquidityVault internal vaultGuarded;
    PerpMarket internal marketStandard;
    PerpMarket internal marketGuarded;

    function _loadContracts() internal {
        clock = MarketClock(vm.envAddress("NYXOR_CLOCK"));
        feedStandard = MockPriceFeed(vm.envAddress("NYXOR_FEED_STANDARD"));
        feedGuarded = MockPriceFeed(vm.envAddress("NYXOR_FEED_GUARDED"));
        vaultStandard = LiquidityVault(vm.envAddress("NYXOR_VAULT_STANDARD"));
        vaultGuarded = LiquidityVault(vm.envAddress("NYXOR_VAULT_GUARDED"));
        marketStandard = PerpMarket(payable(vm.envAddress("NYXOR_MARKET_STANDARD")));
        marketGuarded = PerpMarket(payable(vm.envAddress("NYXOR_MARKET_GUARDED")));
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        _loadContracts();

        uint256 t1Key = uint256(keccak256(abi.encodePacked("NYXOR_TRADER_1", deployerPrivateKey)));
        address t1 = vm.addr(t1Key);

        uint256 t2Key = uint256(keccak256(abi.encodePacked("NYXOR_TRADER_2", deployerPrivateKey)));
        address t2 = vm.addr(t2Key);

        vm.startBroadcast(deployerPrivateKey);

        // ── Phase 3: PRE_CLOSE Phase — Keeper Deleveraging ──────────────
        // Offset to FRI_CLOSE - 450 (safe in [1, 600] deleverage window)
        clock.setDemoOffset(int256(FRI_CLOSE - 450) - int256(block.timestamp));
        feedStandard.setPrice(INITIAL_PRICE);
        feedGuarded.setPrice(INITIAL_PRICE);

        console2.log("Phase 3: Deleveraging T1 and T2 on Guarded Market...");
        marketGuarded.deleverageToCap{gas: 500000}(t1);
        marketGuarded.deleverageToCap{gas: 500000}(t2);
        console2.log("Guarded T1 leverage cut to:", marketGuarded.getLeverage(t1));
        console2.log("Guarded T2 leverage cut to:", marketGuarded.getLeverage(t2));

        // ── Phase 4: CLOSED (Weekend) — Checkpoint Close Price ─────────────────
        clock.setDemoOffset(int256(FRI_CLOSE + 7200) - int256(block.timestamp));
        feedStandard.checkpointClose{gas: 200000}();
        feedGuarded.checkpointClose{gas: 200000}();
        console2.log("Frozen official close price:", feedGuarded.lastOfficialClosePrice() / 1e8, "USD");

        // ── Phase 5: Monday Reopen with -8% Shock ──────────────────────────────
        uint256 monOpen = FRI_OPEN + 3 * 86_400;
        clock.setDemoOffset(int256(monOpen + 300) - int256(block.timestamp));
        feedStandard.queueShock{gas: 200000}(-800);
        feedGuarded.queueShock{gas: 200000}(-800);

        (uint256 shockedPrice,) = feedGuarded.latestPrice();
        console2.log("Monday reopen price (-8.00% gap):", shockedPrice / 1e8, "USD");

        // ── Phase 6: Liquidations & Outcome Reporting ──────────────────────────
        console2.log("Liquidating Standard underwater 20x position (T1)...");
        marketStandard.liquidate{gas: 500000}(t1);

        uint256 stdBadDebt = vaultStandard.badDebtTotal();
        uint256 grdBadDebt = vaultGuarded.badDebtTotal();

        console2.log("=== Scenario Execution Results ===");
        console2.log("Standard Market Bad Debt (raw 6 dec):", stdBadDebt);
        console2.log("Standard Market Bad Debt (formatted):", stdBadDebt / 1e6, "USDx");
        console2.log("Guarded Market Bad Debt (raw 6 dec) :", grdBadDebt);
        console2.log("Guarded Market Bad Debt (formatted) :", grdBadDebt / 1e6, "USDx");

        vm.stopBroadcast();
    }
}
