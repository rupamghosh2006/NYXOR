// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {DemoUSDC} from "../../src/core/DemoUSDC.sol";
import {MarketClock} from "../../src/core/MarketClock.sol";
import {MarketSchedule} from "../../src/core/MarketSchedule.sol";
import {MockPriceFeed} from "../../src/oracle/MockPriceFeed.sol";
import {FlatRiskPolicy} from "../../src/policy/FlatRiskPolicy.sol";
import {MarketHoursRiskPolicy} from "../../src/policy/MarketHoursRiskPolicy.sol";
import {LiquidityVault} from "../../src/vault/LiquidityVault.sol";
import {PerpMarket} from "../../src/core/PerpMarket.sol";
import {IPerpMarket} from "../../src/interfaces/IPerpMarket.sol";

/// @title WeekendGapScenarioTest
/// @notice Deterministic reproduction of the weekend-gap scenario from AGENTS.md §13.
///         Compares Standard market (naive flat policy) vs Guarded market (market-hours risk policy).
contract WeekendGapScenarioTest is Test {
    address internal admin = makeAddr("admin");
    address internal keeper = makeAddr("keeper");

    // Five reference traders + rejected trader T6
    address internal t1 = makeAddr("t1");
    address internal t2 = makeAddr("t2");
    address internal t3 = makeAddr("t3");
    address internal t4 = makeAddr("t4");
    address internal t5 = makeAddr("t5");
    address internal t6 = makeAddr("t6");

    DemoUSDC internal usdc;
    MarketClock internal clock;
    MarketSchedule internal sched;

    // Separate oracle feeds and vaults for identical side-by-side comparison
    MockPriceFeed internal feedStandard;
    MockPriceFeed internal feedGuarded;

    FlatRiskPolicy internal policyStandard;
    MarketHoursRiskPolicy internal policyGuarded;

    LiquidityVault internal vaultStandard;
    LiquidityVault internal vaultGuarded;

    PerpMarket internal marketStandard;
    PerpMarket internal marketGuarded;

    uint256 internal constant INITIAL_PRICE = 4150 * 1e8; // 4,150.00 USD
    uint256 internal constant SEED_VAULT = 1_000_000 * 1e6; // 1,000,000 USDx
    uint256 internal constant BASE_OI = 2_000_000 * 1e6;
    uint256 internal constant BASE_POS = 500_000 * 1e6;

    // Friday 2026-10-16 reference timestamps
    uint256 internal constant FRI_OPEN = 1_792_161_000;
    uint256 internal constant FRI_CLOSE = 1_792_184_400;
    uint256 internal constant FRI_PRE_CLOSE_START = FRI_CLOSE - 3600; // 20:00 UTC

    function setUp() public {
        clock = new MarketClock(admin, true);
        sched = new MarketSchedule(admin, 3600, 900);

        // Warp clock to Friday afternoon: 2 hours before close (OPEN phase)
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE - 7200) - int256(block.timestamp)); // 19:00 UTC

        feedStandard = new MockPriceFeed(admin, address(clock), address(sched), INITIAL_PRICE);
        feedGuarded = new MockPriceFeed(admin, address(clock), address(sched), INITIAL_PRICE);

        policyStandard = new FlatRiskPolicy(BASE_OI, BASE_POS);
        policyGuarded = new MarketHoursRiskPolicy(address(sched), BASE_OI, BASE_POS);

        usdc = new DemoUSDC(admin);

        // Vault Standard & Guarded
        vaultStandard = new LiquidityVault(admin, address(usdc));
        vaultGuarded = new LiquidityVault(admin, address(usdc));

        // Markets
        marketStandard = new PerpMarket(
            admin,
            address(usdc),
            address(policyStandard),
            address(feedStandard),
            address(clock),
            address(sched),
            payable(address(vaultStandard))
        );

        marketGuarded = new PerpMarket(
            admin,
            address(usdc),
            address(policyGuarded),
            address(feedGuarded),
            address(clock),
            address(sched),
            payable(address(vaultGuarded))
        );

        vm.startPrank(admin);
        vaultStandard.setMarket(address(marketStandard));
        vaultGuarded.setMarket(address(marketGuarded));

        // Seed both vaults with identical 1M USDx liquidity
        usdc.mint(admin, SEED_VAULT * 2);
        usdc.approve(address(vaultStandard), SEED_VAULT);
        usdc.approve(address(vaultGuarded), SEED_VAULT);
        vaultStandard.deposit(SEED_VAULT);
        vaultGuarded.deposit(SEED_VAULT);
        vm.stopPrank();

        // Fund all demo traders
        address[6] memory traders = [t1, t2, t3, t4, t5, t6];
        for (uint256 i = 0; i < traders.length; i++) {
            vm.prank(admin);
            usdc.mint(traders[i], 100_000 * 1e6);

            vm.startPrank(traders[i]);
            usdc.approve(address(marketStandard), type(uint256).max);
            usdc.approve(address(marketGuarded), type(uint256).max);
            vm.stopPrank();
        }
    }

    function test_weekend_gap_scenario_deterministic() public {
        // ─────────────────────────────────────────────────────────────────────
        // Step 1: OPEN Phase — mirror trades on both markets
        // ─────────────────────────────────────────────────────────────────────
        // T1: Long 10k collateral @ 20x -> 200k notional
        vm.prank(t1);
        marketStandard.openPosition(true, 10_000 * 1e6, 2000);
        vm.prank(t1);
        marketGuarded.openPosition(true, 10_000 * 1e6, 2000);

        // T2: Long 5k collateral @ 20x -> 100k notional
        vm.prank(t2);
        marketStandard.openPosition(true, 5_000 * 1e6, 2000);
        vm.prank(t2);
        marketGuarded.openPosition(true, 5_000 * 1e6, 2000);

        // T3: Long 8k collateral @ 10x -> 80k notional
        vm.prank(t3);
        marketStandard.openPosition(true, 8_000 * 1e6, 1000);
        vm.prank(t3);
        marketGuarded.openPosition(true, 8_000 * 1e6, 1000);

        // T4: Short 6k collateral @ 10x -> 60k notional
        vm.prank(t4);
        marketStandard.openPosition(false, 6_000 * 1e6, 1000);
        vm.prank(t4);
        marketGuarded.openPosition(false, 6_000 * 1e6, 1000);

        // T5: Long 4k collateral @ 15x -> 60k notional
        vm.prank(t5);
        marketStandard.openPosition(true, 4_000 * 1e6, 1500);
        vm.prank(t5);
        marketGuarded.openPosition(true, 4_000 * 1e6, 1500);

        // ─────────────────────────────────────────────────────────────────────
        // Step 2: PRE_CLOSE Phase (T-30 min) — Rejected trade on Guarded
        // ─────────────────────────────────────────────────────────────────────
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE - 1800) - int256(block.timestamp)); // 20:30 UTC

        // Push fresh price quotes at T-30m
        vm.startPrank(admin);
        feedStandard.setPrice(INITIAL_PRICE);
        feedGuarded.setPrice(INITIAL_PRICE);
        vm.stopPrank();

        // T6 attempts to open a fresh 20x long
        // Standard (flat policy): accepted
        vm.prank(t6);
        marketStandard.openPosition(true, 5_000 * 1e6, 2000);
        assertTrue(marketStandard.getPosition(t6).active);

        // Guarded: rejected with ExcessiveLeverage (max leverage ramped down to 12.50x = 1250)
        vm.prank(t6);
        vm.expectRevert(abi.encodeWithSelector(PerpMarket.ExcessiveLeverage.selector, 2000, 1250));
        marketGuarded.openPosition(true, 5_000 * 1e6, 2000);
        assertFalse(marketGuarded.getPosition(t6).active);

        // ─────────────────────────────────────────────────────────────────────
        // Step 3: Final 10 Minutes (T-5 min) — Keeper Deleveraging on Guarded
        // ─────────────────────────────────────────────────────────────────────
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE - 300) - int256(block.timestamp)); // 20:55 UTC

        // Push fresh price right before deleveraging to ensure zero staleness
        vm.startPrank(admin);
        feedStandard.setPrice(INITIAL_PRICE);
        feedGuarded.setPrice(INITIAL_PRICE);
        vm.stopPrank();

        // Keeper deleverages all Guarded positions above 5x to 5x (T1, T2, T3, T4, T5)
        vm.prank(keeper);
        marketGuarded.deleverageToCap(t1);
        vm.prank(keeper);
        marketGuarded.deleverageToCap(t2);
        vm.prank(keeper);
        marketGuarded.deleverageToCap(t3);
        vm.prank(keeper);
        marketGuarded.deleverageToCap(t4);
        vm.prank(keeper);
        marketGuarded.deleverageToCap(t5);

        // Verify Guarded positions are safely cut to <= 5x leverage
        assertLe(marketGuarded.getLeverage(t1), 500);
        assertLe(marketGuarded.getLeverage(t2), 500);
        assertLe(marketGuarded.getLeverage(t3), 500);
        assertLe(marketGuarded.getLeverage(t4), 500);
        assertLe(marketGuarded.getLeverage(t5), 500);

        // Standard market does no deleveraging — high leverage remains exposed!

        // ─────────────────────────────────────────────────────────────────────
        // Step 4: CLOSED (Weekend) — Checkpoint Close Price
        // ─────────────────────────────────────────────────────────────────────
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE + 3600) - int256(block.timestamp)); // Saturday 22:00 UTC

        feedStandard.checkpointClose();
        feedGuarded.checkpointClose();

        assertEq(feedStandard.lastOfficialClosePrice(), INITIAL_PRICE);
        assertEq(feedGuarded.lastOfficialClosePrice(), INITIAL_PRICE);

        // ─────────────────────────────────────────────────────────────────────
        // Step 5: Monday Reopen with -8% Gap Shock (4,150 -> 3,818 USD)
        // ─────────────────────────────────────────────────────────────────────
        uint256 monOpen = FRI_OPEN + 3 * 86_400; // Monday 14:30 UTC
        vm.prank(admin);
        clock.setDemoOffset(int256(monOpen) - int256(block.timestamp));

        // Apply -8% shock to both feeds
        vm.prank(admin);
        feedStandard.queueShock(-800);
        vm.prank(admin);
        feedGuarded.queueShock(-800);

        (uint256 shockedPriceStandard,) = feedStandard.latestPrice();
        (uint256 shockedPriceGuarded,) = feedGuarded.latestPrice();
        assertEq(shockedPriceStandard, 3818 * 1e8);
        assertEq(shockedPriceGuarded, 3818 * 1e8);

        // ─────────────────────────────────────────────────────────────────────
        // Step 6: Liquidations & Outcome Assertions (-8% Gap)
        // ─────────────────────────────────────────────────────────────────────
        // Liquidate underwater long positions on Standard
        // T1: 200k notional, 10k margin -> loss 16,000 -> deficit 6,000
        // T2: 100k notional, 5k margin -> loss 8,000 -> deficit 3,000
        // T5: 60k notional, 4k margin -> loss 4,800 -> deficit 800
        // T6: 100k notional, 5k margin -> loss 8,000 -> deficit 3,000
        vm.prank(keeper);
        marketStandard.liquidate(t1);
        vm.prank(keeper);
        marketStandard.liquidate(t2);
        vm.prank(keeper);
        marketStandard.liquidate(t5);
        vm.prank(keeper);
        marketStandard.liquidate(t6);

        // On Standard: Total deficit = 6000 + 3000 + 800 + 3000 = 12,800 USDC
        // Plus keeper rewards & insurance penalties
        uint256 stdBadDebt = vaultStandard.badDebtTotal();
        assertGt(stdBadDebt, 10_000 * 1e6, "Standard market must accumulate > 10k bad debt");

        // On Guarded: Positions were capped at 5x. An 8% drop is only a 40% loss of collateral!
        // All positions remain healthy (> 6% maintenance margin)
        vm.prank(keeper);
        vm.expectRevert(PerpMarket.PositionHealthy.selector);
        marketGuarded.liquidate(t1);

        vm.prank(keeper);
        vm.expectRevert(PerpMarket.PositionHealthy.selector);
        marketGuarded.liquidate(t2);

        vm.prank(keeper);
        vm.expectRevert(PerpMarket.PositionHealthy.selector);
        marketGuarded.liquidate(t5);

        // Zero liquidations and ZERO BAD DEBT on Guarded market
        assertEq(vaultGuarded.badDebtTotal(), 0, "Guarded market must have ZERO bad debt on -8% gap");
    }

    /// @notice Demonstrates severe shock scenario (-25% gap shock):
    ///         Honest limitation: 5x leverage absorbs up to 20% gap without bad debt.
    ///         At -25%, Guarded accumulates bad debt, but vastly less than Standard.
    function test_weekend_gap_scenario_severeShockMinus25Percent() public {
        // Step 1: Open mirror positions
        vm.prank(t1);
        marketStandard.openPosition(true, 10_000 * 1e6, 2000);
        vm.prank(t1);
        marketGuarded.openPosition(true, 10_000 * 1e6, 2000);

        vm.prank(t2);
        marketStandard.openPosition(true, 5_000 * 1e6, 2000);
        vm.prank(t2);
        marketGuarded.openPosition(true, 5_000 * 1e6, 2000);

        vm.prank(t5);
        marketStandard.openPosition(true, 4_000 * 1e6, 1500);
        vm.prank(t5);
        marketGuarded.openPosition(true, 4_000 * 1e6, 1500);

        // Step 2: PRE_CLOSE keeper deleveraging on Guarded
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE - 300) - int256(block.timestamp));
        vm.startPrank(admin);
        feedStandard.setPrice(INITIAL_PRICE);
        feedGuarded.setPrice(INITIAL_PRICE);
        vm.stopPrank();

        vm.prank(keeper);
        marketGuarded.deleverageToCap(t1);
        vm.prank(keeper);
        marketGuarded.deleverageToCap(t2);
        vm.prank(keeper);
        marketGuarded.deleverageToCap(t5);

        // Step 3: CLOSED checkpoint
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE + 3600) - int256(block.timestamp));
        feedStandard.checkpointClose();
        feedGuarded.checkpointClose();

        // Step 4: Monday Reopen with -25% severe shock
        uint256 monOpen = FRI_OPEN + 3 * 86_400;
        vm.prank(admin);
        clock.setDemoOffset(int256(monOpen) - int256(block.timestamp));

        vm.prank(admin);
        feedStandard.queueShock(-2500);
        vm.prank(admin);
        feedGuarded.queueShock(-2500);

        // Step 5: Liquidate on both markets
        vm.prank(keeper);
        marketStandard.liquidate(t1);
        vm.prank(keeper);
        marketStandard.liquidate(t2);
        vm.prank(keeper);
        marketStandard.liquidate(t5);

        vm.prank(keeper);
        marketGuarded.liquidate(t1);
        vm.prank(keeper);
        marketGuarded.liquidate(t2);
        vm.prank(keeper);
        marketGuarded.liquidate(t5);

        uint256 stdBadDebt = vaultStandard.badDebtTotal();
        uint256 guardedBadDebt = vaultGuarded.badDebtTotal();

        // Standard bad debt is catastrophic (> 60,000 USDC)
        assertGt(stdBadDebt, 60_000 * 1e6, "Standard bad debt should be catastrophic");
        // Guarded accumulates bad debt because -25% exceeds the 20% tolerance of 5x leverage
        assertGt(guardedBadDebt, 0, "Guarded takes bad debt at -25% shock");
        // Guarded bad debt is dramatically lower than Standard (< 25% of Standard bad debt)
        assertLt(guardedBadDebt, stdBadDebt / 4, "Guarded bad debt must be < 25% of Standard bad debt");
    }
}
