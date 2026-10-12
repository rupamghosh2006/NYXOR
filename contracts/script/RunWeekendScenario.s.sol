// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DemoUSDC} from "../src/core/DemoUSDC.sol";
import {MarketClock} from "../src/core/MarketClock.sol";
import {MockPriceFeed} from "../src/oracle/MockPriceFeed.sol";
import {LiquidityVault} from "../src/vault/LiquidityVault.sol";
import {PerpMarket} from "../src/core/PerpMarket.sol";

/// @title RunWeekendScenarioScript
/// @notice Executes the deterministic weekend-gap scenario on Fuji testnet.
///         Demonstrates Standard (naive) vs Guarded (market-hours risk engine) side-by-side.
contract RunWeekendScenarioScript is Script {
    uint256 internal constant INITIAL_PRICE = 4150 * 1e8; // 4,150.00 USD
    uint256 internal constant FRI_OPEN = 1_792_161_000;
    uint256 internal constant FRI_CLOSE = 1_792_184_400;

    DemoUSDC internal usdc;
    MarketClock internal clock;
    MockPriceFeed internal feedStandard;
    MockPriceFeed internal feedGuarded;
    LiquidityVault internal vaultStandard;
    LiquidityVault internal vaultGuarded;
    PerpMarket internal marketStandard;
    PerpMarket internal marketGuarded;

    function _loadContracts() internal {
        usdc = DemoUSDC(vm.envAddress("NYXOR_USDC"));
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
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=== Running Deterministic Weekend-Gap Scenario ===");
        console2.log("Operator:", deployer);

        _loadContracts();

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Warp clock to Friday afternoon (OPEN)
        clock.setDemoOffset(int256(FRI_CLOSE - 7200) - int256(block.timestamp));
        feedStandard.setPrice(INITIAL_PRICE);
        feedGuarded.setPrice(INITIAL_PRICE);

        // Fund and approve operator for scenario trades
        usdc.mint(deployer, 500_000 * 1e6);
        usdc.approve(address(marketStandard), type(uint256).max);
        usdc.approve(address(marketGuarded), type(uint256).max);

        console2.log("Phase at T-2h: OPEN. Opening position...");
        marketStandard.openPosition(true, 10_000 * 1e6, 2000);
        marketGuarded.openPosition(true, 10_000 * 1e6, 2000);

        // Step 2: PRE_CLOSE Phase (T-5 min) — Deleveraging
        clock.setDemoOffset(int256(FRI_CLOSE - 300) - int256(block.timestamp));
        feedStandard.setPrice(INITIAL_PRICE);
        feedGuarded.setPrice(INITIAL_PRICE);

        console2.log("Phase at T-5m: PRE_CLOSE. Deleveraging Guarded position to 5x...");
        marketGuarded.deleverageToCap(deployer);
        console2.log("Guarded leverage after deleverage:", marketGuarded.getLeverage(deployer));

        // Step 3: CLOSED (Weekend) — Checkpoint Close
        clock.setDemoOffset(int256(FRI_CLOSE + 3600) - int256(block.timestamp));
        feedStandard.checkpointClose();
        feedGuarded.checkpointClose();
        console2.log("Checkpointed official close price:", feedGuarded.lastOfficialClosePrice());

        // Step 4: Monday Reopen with -8% Gap Shock
        uint256 monOpen = FRI_OPEN + 3 * 86_400;
        clock.setDemoOffset(int256(monOpen) - int256(block.timestamp));
        feedStandard.queueShock(-800);
        feedGuarded.queueShock(-800);

        (uint256 shockedPrice,) = feedGuarded.latestPrice();
        console2.log("Monday shocked price (-8%):", shockedPrice);

        // Step 5: Liquidate Standard position
        console2.log("Liquidating Standard underwater position...");
        marketStandard.liquidate(deployer);

        uint256 stdBadDebt = vaultStandard.badDebtTotal();
        uint256 grdBadDebt = vaultGuarded.badDebtTotal();

        console2.log("=== Scenario Execution Results ===");
        console2.log("Standard Market Bad Debt (USDC 6 dec):", stdBadDebt);
        console2.log("Guarded Market Bad Debt (USDC 6 dec):", grdBadDebt);

        vm.stopBroadcast();
    }
}
