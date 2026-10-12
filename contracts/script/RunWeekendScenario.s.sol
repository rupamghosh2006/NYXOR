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
///         Uses 3 distinct trader wallets (T1, T2, T3) funded by the deployer
///         plus the keeper wallet to demonstrate multi-trader scenario execution.
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

        _loadContracts();

        // Derive 3 distinct deterministic throwaway trader keypairs
        uint256 t1Key = uint256(keccak256(abi.encodePacked("NYXOR_TRADER_1", deployerPrivateKey)));
        address t1 = vm.addr(t1Key);

        uint256 t2Key = uint256(keccak256(abi.encodePacked("NYXOR_TRADER_2", deployerPrivateKey)));
        address t2 = vm.addr(t2Key);

        uint256 t3Key = uint256(keccak256(abi.encodePacked("NYXOR_TRADER_3", deployerPrivateKey)));
        address t3 = vm.addr(t3Key);

        console2.log("=== Deterministic Weekend-Gap Scenario Execution ===");
        console2.log("Keeper/Deployer Wallet:", deployer);
        console2.log("Trader 1 Wallet (20x Long) :", t1);
        console2.log("Trader 2 Wallet (10x Long) :", t2);
        console2.log("Trader 3 Wallet (10x Short):", t3);

        // ── Phase 1: Setup & Funding by Deployer ──────────────────────────────
        vm.startBroadcast(deployerPrivateKey);

        // Warp clock to Friday afternoon (T-2h before close, OPEN phase)
        clock.setDemoOffset(int256(FRI_CLOSE - 7200) - int256(block.timestamp));
        feedStandard.setPrice(INITIAL_PRICE);
        feedGuarded.setPrice(INITIAL_PRICE);

        // Fund trader wallets with AVAX for gas (if low) and USDx for margin
        if (t1.balance < 0.02 ether) payable(t1).transfer(0.03 ether);
        if (t2.balance < 0.02 ether) payable(t2).transfer(0.03 ether);
        if (t3.balance < 0.02 ether) payable(t3).transfer(0.03 ether);

        usdc.mint(t1, 50_000 * 1e6);
        usdc.mint(t2, 50_000 * 1e6);
        usdc.mint(t3, 50_000 * 1e6);

        vm.stopBroadcast();

        // ── Phase 2: Friday OPEN — Traders Open Positions ──────────────────────
        // Trader 1: Aggressive 20x Long (10,000 USDx margin -> 200,000 USDx notional)
        vm.startBroadcast(t1Key);
        usdc.approve(address(marketStandard), type(uint256).max);
        usdc.approve(address(marketGuarded), type(uint256).max);
        marketStandard.openPosition(true, 10_000 * 1e6, 2000);
        marketGuarded.openPosition(true, 10_000 * 1e6, 2000);
        vm.stopBroadcast();
        console2.log("T1 opened 20x Long (200,000 USDx notional) on Standard and Guarded");

        // Trader 2: Moderate 10x Long (8,000 USDx margin -> 80,000 USDx notional)
        vm.startBroadcast(t2Key);
        usdc.approve(address(marketStandard), type(uint256).max);
        usdc.approve(address(marketGuarded), type(uint256).max);
        marketStandard.openPosition(true, 8_000 * 1e6, 1000);
        marketGuarded.openPosition(true, 8_000 * 1e6, 1000);
        vm.stopBroadcast();
        console2.log("T2 opened 10x Long (80,000 USDx notional) on Standard and Guarded");

        // Trader 3: Short Hedge 10x Short (6,000 USDx margin -> 60,000 USDx notional)
        vm.startBroadcast(t3Key);
        usdc.approve(address(marketStandard), type(uint256).max);
        usdc.approve(address(marketGuarded), type(uint256).max);
        marketStandard.openPosition(false, 6_000 * 1e6, 1000);
        marketGuarded.openPosition(false, 6_000 * 1e6, 1000);
        vm.stopBroadcast();
        console2.log("T3 opened 10x Short (60,000 USDx notional) on Standard and Guarded");

        // ── Phase 3: PRE_CLOSE Phase (T-5m) — Keeper Deleveraging ──────────────
        vm.startBroadcast(deployerPrivateKey);

        clock.setDemoOffset(int256(FRI_CLOSE - 300) - int256(block.timestamp));
        feedStandard.setPrice(INITIAL_PRICE);
        feedGuarded.setPrice(INITIAL_PRICE);

        console2.log("Phase at T-5m: PRE_CLOSE. Keeper deleveraging Guarded positions to 5.00x cap...");
        marketGuarded.deleverageToCap(t1);
        marketGuarded.deleverageToCap(t2);

        console2.log("Guarded T1 leverage cut to:", marketGuarded.getLeverage(t1));
        console2.log("Guarded T2 leverage cut to:", marketGuarded.getLeverage(t2));

        // ── Phase 4: CLOSED (Weekend) — Checkpoint Close Price ─────────────────
        clock.setDemoOffset(int256(FRI_CLOSE + 3600) - int256(block.timestamp));
        feedStandard.checkpointClose();
        feedGuarded.checkpointClose();
        console2.log("Frozen official close price:", feedGuarded.lastOfficialClosePrice() / 1e8, "USD");

        // ── Phase 5: Monday Reopen with -8% Shock ──────────────────────────────
        uint256 monOpen = FRI_OPEN + 3 * 86_400;
        clock.setDemoOffset(int256(monOpen) - int256(block.timestamp));
        feedStandard.queueShock(-800);
        feedGuarded.queueShock(-800);

        (uint256 shockedPrice,) = feedGuarded.latestPrice();
        console2.log("Monday reopen price (-8.00% gap):", shockedPrice / 1e8, "USD");

        // ── Phase 6: Liquidations & Outcome Reporting ──────────────────────────
        console2.log("Liquidating Standard underwater 20x position (T1)...");
        marketStandard.liquidate(t1);

        uint256 stdBadDebt = vaultStandard.badDebtTotal();
        uint256 grdBadDebt = vaultGuarded.badDebtTotal();

        console2.log("=== Scenario Execution Results ===");
        console2.log("Standard Market Bad Debt (raw 6 dec):", stdBadDebt);
        console2.log("Standard Market Bad Debt (formatted):", stdBadDebt / 1e6, "USDx");
        console2.log("Guarded Market Bad Debt (raw 6 dec) :", grdBadDebt);
        console2.log("Guarded Market Bad Debt (formatted) :", grdBadDebt / 1e6, "USDx");
        console2.log("Guarded T1 Equity Remaining         :", uint256(marketGuarded.getEquity(t1)) / 1e6, "USDx");

        vm.stopBroadcast();
    }
}
