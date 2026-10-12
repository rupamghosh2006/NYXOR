// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DemoUSDC} from "../src/core/DemoUSDC.sol";
import {MarketClock} from "../src/core/MarketClock.sol";
import {MockPriceFeed} from "../src/oracle/MockPriceFeed.sol";
import {LiquidityVault} from "../src/vault/LiquidityVault.sol";
import {PerpMarket} from "../src/core/PerpMarket.sol";

/// @title RunScenarioCleanScript
/// @notice Runs the complete weekend-gap scenario in a single run against fresh demo instance
contract RunScenarioCleanScript is Script {
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
        usdc = DemoUSDC(0x0857fA382043d910Ae1e587e1756746c96F7A169);
        clock = MarketClock(0x6f09eF68d78BfB1e8BDa9B389bB54e35C27265B9);
        feedStandard = MockPriceFeed(0x809B492BdfC43A36392821bcC684b0020b345fCe);
        feedGuarded = MockPriceFeed(0x1710E8C0310186280AbAE3889278EA55c0A53b50);
        vaultStandard = LiquidityVault(0x7f758330d60bd3B51E94B2582e4c05DFAbE765F8);
        vaultGuarded = LiquidityVault(0x442697fea0BAF3775149B415d502e8c06dF05e92);
        marketStandard = PerpMarket(payable(0xd0f198adCa10703D8a85355120aD806B850Dca75));
        marketGuarded = PerpMarket(payable(0x724b9525b6Dd7Cc81ad37a06b1A20006BBDc83cB));
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        _loadContracts();

        uint256 t1Key = uint256(keccak256(abi.encodePacked("NYXOR_TRADER_1", deployerPrivateKey)));
        address t1 = vm.addr(t1Key);

        uint256 t2Key = uint256(keccak256(abi.encodePacked("NYXOR_TRADER_2", deployerPrivateKey)));
        address t2 = vm.addr(t2Key);

        uint256 t3Key = uint256(keccak256(abi.encodePacked("NYXOR_TRADER_3", deployerPrivateKey)));
        address t3 = vm.addr(t3Key);

        console2.log("=== Running Clean Scenario on Fresh Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("T1:", t1);
        console2.log("T2:", t2);
        console2.log("T3:", t3);

        // ── Phase 1: Setup, Funding & Opening Trades (Friday OPEN) ──────────
        vm.startBroadcast(deployerPrivateKey);
        clock.setDemoOffset(int256(FRI_CLOSE - 7200) - int256(block.timestamp));
        feedStandard.setPrice(INITIAL_PRICE);
        feedGuarded.setPrice(INITIAL_PRICE);

        if (t1.balance < 0.02 ether) payable(t1).transfer(0.03 ether);
        if (t2.balance < 0.02 ether) payable(t2).transfer(0.03 ether);
        if (t3.balance < 0.02 ether) payable(t3).transfer(0.03 ether);

        usdc.mint(t1, 50_000 * 1e6);
        usdc.mint(t2, 50_000 * 1e6);
        usdc.mint(t3, 50_000 * 1e6);
        vm.stopBroadcast();

        // T1 opens 20x Long
        vm.startBroadcast(t1Key);
        usdc.approve(address(marketStandard), type(uint256).max);
        usdc.approve(address(marketGuarded), type(uint256).max);
        marketStandard.openPosition(true, 10_000 * 1e6, 2000);
        marketGuarded.openPosition(true, 10_000 * 1e6, 2000);
        vm.stopBroadcast();
        console2.log("T1 opened 20x Long on Standard & Guarded");

        // T2 opens 10x Long
        vm.startBroadcast(t2Key);
        usdc.approve(address(marketStandard), type(uint256).max);
        usdc.approve(address(marketGuarded), type(uint256).max);
        marketStandard.openPosition(true, 8_000 * 1e6, 1000);
        marketGuarded.openPosition(true, 8_000 * 1e6, 1000);
        vm.stopBroadcast();
        console2.log("T2 opened 10x Long on Standard & Guarded");

        // T3 opens 10x Short
        vm.startBroadcast(t3Key);
        usdc.approve(address(marketStandard), type(uint256).max);
        usdc.approve(address(marketGuarded), type(uint256).max);
        marketStandard.openPosition(false, 6_000 * 1e6, 1000);
        marketGuarded.openPosition(false, 6_000 * 1e6, 1000);
        vm.stopBroadcast();
        console2.log("T3 opened 10x Short on Standard & Guarded");

        // ── Phase 3: PRE_CLOSE (T-7.5m) — Keeper Deleveraging on Guarded ─────
        vm.startBroadcast(deployerPrivateKey);
        clock.setDemoOffset(int256(FRI_CLOSE - 450) - int256(block.timestamp));
        feedStandard.setPrice(INITIAL_PRICE);
        feedGuarded.setPrice(INITIAL_PRICE);

        console2.log("Deleveraging Guarded T1 and T2...");
        marketGuarded.deleverageToCap{gas: 500000}(t1);
        marketGuarded.deleverageToCap{gas: 500000}(t2);

        // ── Phase 4: CLOSED (Saturday) — Checkpoint Close ────────────────────
        clock.setDemoOffset(int256(FRI_CLOSE + 7200) - int256(block.timestamp));
        feedStandard.checkpointClose{gas: 200000}();
        feedGuarded.checkpointClose{gas: 200000}();

        // ── Phase 5: Monday Reopen with -8% Shock ────────────────────────────
        uint256 monOpen = FRI_OPEN + 3 * 86_400;
        clock.setDemoOffset(int256(monOpen + 300) - int256(block.timestamp));
        feedStandard.queueShock{gas: 200000}(-800);
        feedGuarded.queueShock{gas: 200000}(-800);

        // ── Phase 6: Liquidations ───────────────────────────────────────────
        console2.log("Liquidating Standard T1...");
        marketStandard.liquidate{gas: 500000}(t1);

        uint256 stdBadDebt = vaultStandard.badDebtTotal();
        uint256 grdBadDebt = vaultGuarded.badDebtTotal();

        console2.log("=== Final Clean Results ===");
        console2.log("Standard Vault Bad Debt (raw):", stdBadDebt);
        console2.log("Standard Vault Bad Debt (USDx):", stdBadDebt / 1e6);
        console2.log("Guarded Vault Bad Debt (raw) :", grdBadDebt);
        console2.log("Guarded Vault Bad Debt (USDx) :", grdBadDebt / 1e6);

        vm.stopBroadcast();
    }
}
