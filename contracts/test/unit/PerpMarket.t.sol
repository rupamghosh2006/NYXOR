// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DemoUSDC} from "../../src/core/DemoUSDC.sol";
import {MarketClock} from "../../src/core/MarketClock.sol";
import {MarketSchedule} from "../../src/core/MarketSchedule.sol";
import {MockPriceFeed} from "../../src/oracle/MockPriceFeed.sol";
import {MarketHoursRiskPolicy} from "../../src/policy/MarketHoursRiskPolicy.sol";
import {LiquidityVault} from "../../src/vault/LiquidityVault.sol";
import {PerpMarket} from "../../src/core/PerpMarket.sol";
import {IPerpMarket} from "../../src/interfaces/IPerpMarket.sol";
import {Phase} from "../../src/interfaces/IMarketSchedule.sol";

contract PerpMarketTest is Test {
    address internal admin = makeAddr("admin");
    address internal trader1 = makeAddr("trader1");
    address internal trader2 = makeAddr("trader2");
    address internal keeper = makeAddr("keeper");

    DemoUSDC internal usdc;
    MarketClock internal clock;
    MarketSchedule internal sched;
    MockPriceFeed internal feed;
    MarketHoursRiskPolicy internal policy;
    LiquidityVault internal vault;
    PerpMarket internal market;

    uint256 internal constant INITIAL_PRICE = 4150 * 1e8; // 4,150.00 USD
    uint256 internal constant SEED_VAULT = 1_000_000 * 1e6; // 1M USDC
    uint256 internal constant BASE_OI = 1_000_000 * 1e6;
    uint256 internal constant BASE_POS = 200_000 * 1e6;

    // Friday 2026-10-16 reference
    uint256 internal constant FRI_OPEN = 1_792_161_000;
    uint256 internal constant FRI_CLOSE = 1_792_184_400;
    uint256 internal constant FRI_PRE_CLOSE_START = FRI_CLOSE - 3600;

    function setUp() public {
        clock = new MarketClock(admin, true);
        sched = new MarketSchedule(admin, 3600, 900);

        // Warp clock to Friday afternoon (OPEN)
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_OPEN + 7200) - int256(block.timestamp)); // 16:30 UTC

        feed = new MockPriceFeed(admin, address(clock), address(sched), INITIAL_PRICE);
        policy = new MarketHoursRiskPolicy(address(sched), BASE_OI, BASE_POS);

        usdc = new DemoUSDC(admin);
        vault = new LiquidityVault(admin, address(usdc));

        market = new PerpMarket(
            admin,
            address(usdc),
            address(policy),
            address(feed),
            address(clock),
            address(sched),
            payable(address(vault))
        );

        vm.prank(admin);
        vault.setMarket(address(market));

        // Seed vault with LP funds
        vm.prank(admin);
        usdc.mint(admin, SEED_VAULT);
        vm.startPrank(admin);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit(SEED_VAULT);
        vm.stopPrank();

        // Fund traders
        vm.startPrank(admin);
        usdc.mint(trader1, 100_000 * 1e6);
        usdc.mint(trader2, 100_000 * 1e6);
        vm.stopPrank();

        vm.prank(trader1);
        usdc.approve(address(market), type(uint256).max);

        vm.prank(trader2);
        usdc.approve(address(market), type(uint256).max);
    }

    // ─── Task 2: Effective Leverage Invariant Tests ─────────────────────────────

    function test_effectiveLeverage_neverExceedsCapAtOpen() public {
        // 1. OPEN Phase: 20x cap
        uint256 margin = 10_000 * 1e6;
        uint256 traderBalanceBefore = usdc.balanceOf(trader1);

        vm.prank(trader1);
        market.openPosition(true, margin, 2000); // 20.00x

        IPerpMarket.Position memory pos = market.getPosition(trader1);
        assertEq(pos.collateral, margin); // full margin stored
        assertEq(pos.sizeUsd, 200_000 * 1e6);
        // Effective leverage strictly == 20.00x
        assertEq(market.getLeverage(trader1), 2000);
        // Fee (120 USDC) was charged on top of margin
        assertEq(traderBalanceBefore - usdc.balanceOf(trader1), margin + 120 * 1e6);

        // Close position
        vm.prank(trader1);
        market.closePosition();

        // 2. PRE_CLOSE Phase ramp checks (T-30m and T-10m)
        // At T-30m: maxLev is ~1250 (12.50x)
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE - 1800) - int256(block.timestamp));
        vm.prank(admin);
        feed.setPrice(INITIAL_PRICE);

        uint16 maxLevMid = policy.getParams(clock.effectiveNow()).maxLeverageX100;
        vm.prank(trader1);
        market.openPosition(true, margin, maxLevMid);
        assertLe(market.getLeverage(trader1), maxLevMid);

        vm.prank(trader1);
        market.closePosition();

        // At T-10m: maxLev is ~750 (7.50x)
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE - 600) - int256(block.timestamp));
        vm.prank(admin);
        feed.setPrice(INITIAL_PRICE);

        uint16 maxLevLate = policy.getParams(clock.effectiveNow()).maxLeverageX100;
        vm.prank(trader1);
        market.openPosition(true, margin, maxLevLate);
        assertLe(market.getLeverage(trader1), maxLevLate);
    }

    // ─── Task 5: openPosition Revert Paths ─────────────────────────────────────

    function test_openPosition_revertExcessiveLeverage() public {
        vm.prank(trader1);
        vm.expectRevert(abi.encodeWithSelector(PerpMarket.ExcessiveLeverage.selector, 2500, 2000));
        market.openPosition(true, 10_000 * 1e6, 2500); // 25x > 20x max
    }

    function test_openPosition_revertZeroAmount() public {
        vm.prank(trader1);
        vm.expectRevert(PerpMarket.ZeroAmount.selector);
        market.openPosition(true, 0, 1000);
    }

    function test_openPosition_revertPositionAlreadyActive() public {
        vm.prank(trader1);
        market.openPosition(true, 10_000 * 1e6, 1000);

        vm.prank(trader1);
        vm.expectRevert(PerpMarket.PositionAlreadyActive.selector);
        market.openPosition(true, 5_000 * 1e6, 1000);
    }

    function test_openPosition_revertReduceOnlyMode() public {
        // Warp to weekend (CLOSED phase)
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE + 3600) - int256(block.timestamp));

        vm.prank(trader1);
        vm.expectRevert(PerpMarket.ReduceOnlyMode.selector);
        market.openPosition(true, 10_000 * 1e6, 500);
    }

    function test_openPosition_revertExceedsMaxPosition() public {
        // BASE_POS = 200,000 USD
        // 15,000 collateral @ 20x = 300,000 USD > 200,000 USD
        vm.prank(trader1);
        vm.expectRevert(abi.encodeWithSelector(PerpMarket.ExceedsMaxPosition.selector, 300_000 * 1e6, BASE_POS));
        market.openPosition(true, 15_000 * 1e6, 2000);
    }

    function test_openPosition_revertExceedsMaxOpenInterest() public {
        // Trader1 opens 10,000 @ 20x = 200k
        // BASE_OI = 1,000,000 USD. Let's fill up trader1 and trader2 up to cap
        // Trader2 opens 10,000 @ 20x = 200k until OI fills up
        // Set small OI cap for this test
        // Test OI limit rejection:
        vm.prank(trader1);
        market.openPosition(true, 10_000 * 1e6, 2000); // 200k OI

        // Warp to PRE_CLOSE close where OI cap ramps down to 40% (400k)
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE - 1) - int256(block.timestamp));
        vm.prank(admin);
        feed.setPrice(INITIAL_PRICE);

        // At close boundary, OI cap is 400k. Trader2 tries to open 50k margin @ 5x = 250k notional (200k + 250k = 450k > 400k)
        vm.prank(trader2);
        vm.expectRevert();
        market.openPosition(true, 50_000 * 1e6, 500);
    }

    function test_openPosition_revertStalePrice() public {
        // Advance clock by 10 minutes without updating price feed (maxStaleness = 5m)
        vm.prank(admin);
        clock.advance(600);

        vm.prank(trader1);
        vm.expectRevert(PerpMarket.StalePrice.selector);
        market.openPosition(true, 10_000 * 1e6, 1000);
    }

    // ─── Task 4: CLOSED/REOPEN Pricing & Non-Trapped Positions ──────────────────

    function test_closePosition_duringClosedPhaseUsesOfficialClosePrice() public {
        // Trader1 opens 10k collateral @ 10x long on Friday afternoon
        vm.prank(trader1);
        market.openPosition(true, 10_000 * 1e6, 1000); // 100k notional

        // Weekend arrives (CLOSED phase). Checkpoint close price at 4150.00
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE + 7200) - int256(block.timestamp)); // Saturday

        feed.checkpointClose();

        // Trader1 calls closePosition on Saturday!
        // Staleness check is bypassed and official close price (4150.00) is used
        uint256 balBefore = usdc.balanceOf(trader1);
        vm.prank(trader1);
        market.closePosition();

        assertFalse(market.getPosition(trader1).active);
        // Trader is not trapped: received collateral back minus close fee
        assertGt(usdc.balanceOf(trader1), balBefore);
    }

    // ─── Task 3: Funding Rate Settlement ───────────────────────────────────────

    function test_funding_accrualAndSettlement() public {
        // Trader1 opens 10k long @ 10x = 100k notional
        // Trader2 opens 2k short @ 10x = 20k notional
        // Net skew = 80k long skew
        vm.prank(trader1);
        market.openPosition(true, 10_000 * 1e6, 1000);

        vm.prank(trader2);
        market.openPosition(false, 2_000 * 1e6, 1000);

        // Advance 2 hours in OPEN phase
        vm.prank(admin);
        clock.advance(7200);
        vm.prank(admin);
        feed.setPrice(INITIAL_PRICE);

        // Settle funding
        market.settleFunding();

        // Long cumulative rate should be positive (longs owe funding)
        assertGt(market.cumulativeFundingRateLong(), 0);
        // Short cumulative rate should be negative (shorts receive funding)
        assertLt(market.cumulativeFundingRateShort(), 0);

        // Check equity: trader1's equity decreased due to accrued funding
        int256 eq1 = market.getEquity(trader1);
        assertLt(eq1, int256(10_000 * 1e6));
    }

    // ─── Task 5: Margin Management Tests ──────────────────────────────────────

    function test_removeMargin_revertIfEquityBelowInitialMargin() public {
        uint256 col = 10_000 * 1e6;
        vm.prank(trader1);
        market.openPosition(true, col, 2000); // 20x: exactly at initial margin

        // Removing even 1 USDC margin drops below IM -> revert
        vm.prank(trader1);
        vm.expectRevert(PerpMarket.InsufficientCollateral.selector);
        market.removeMargin(100 * 1e6);
    }

    // ─── Task 5: Liquidation Tests (Healthy, Partial, Negative Equity) ─────────

    function test_liquidate_revertIfPositionHealthy() public {
        vm.prank(trader1);
        market.openPosition(true, 10_000 * 1e6, 1000);

        vm.prank(keeper);
        vm.expectRevert(PerpMarket.PositionHealthy.selector);
        market.liquidate(trader1);
    }

    function test_liquidate_partialEquityRemaining() public {
        uint256 col = 10_000 * 1e6;
        vm.prank(trader1);
        market.openPosition(true, col, 1000); // 10x long -> 100k notional

        // Price drops -8%: 100k * 8% = 8,000 loss. Collateral remaining = 2,000 (2% < 2.5% MM)
        // Equity is +2,000 > 0, so partial equity remains
        vm.prank(admin);
        feed.queueShock(-800);

        uint256 keeperBalBefore = usdc.balanceOf(keeper);
        vm.prank(keeper);
        market.liquidate(trader1);

        assertFalse(market.getPosition(trader1).active);
        // Keeper receives 50 bps reward (500 USDC)
        assertEq(usdc.balanceOf(keeper) - keeperBalBefore, 500 * 1e6);
        // No bad debt created since equity was positive
        assertEq(vault.badDebtTotal(), 0);
    }

    function test_liquidate_negativeEquityShortfall() public {
        uint256 col = 10_000 * 1e6;
        vm.prank(trader1);
        market.openPosition(true, col, 2000); // 20x long -> 200k notional

        // Price drops -6%: 200k * 6% = 12,000 loss > 10,000 collateral -> negative equity!
        vm.prank(admin);
        feed.queueShock(-600);

        uint256 keeperBalBefore = usdc.balanceOf(keeper);
        vm.prank(keeper);
        market.liquidate(trader1);

        assertFalse(market.getPosition(trader1).active);
        assertEq(usdc.balanceOf(keeper) - keeperBalBefore, 1_000 * 1e6);
        assertGt(vault.badDebtTotal(), 0);
    }

    // ─── Task 5: Deleverage Reverts ───────────────────────────────────────────

    function test_deleverageToCap_revertIfNotDeleverageWindow() public {
        vm.prank(trader1);
        market.openPosition(true, 10_000 * 1e6, 2000);

        // Still in OPEN phase (not PRE_CLOSE)
        vm.prank(keeper);
        vm.expectRevert(PerpMarket.NotDeleverageWindow.selector);
        market.deleverageToCap(trader1);
    }

    function test_deleverageToCap_revertIfAlreadyWithinCap() public {
        // Trader opens 4x position (safely within 5x cap even after funding accrual)
        vm.prank(trader1);
        market.openPosition(true, 10_000 * 1e6, 400);

        // Warp to T-5m in PRE_CLOSE
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE - 300) - int256(block.timestamp));
        vm.prank(admin);
        feed.setPrice(INITIAL_PRICE);

        vm.prank(keeper);
        vm.expectRevert(PerpMarket.PositionAlreadyWithinCap.selector);
        market.deleverageToCap(trader1);
    }

    // ─── Task 5: Fuzz Test: Round-Trip Open and Close ──────────────────────────

    function testFuzz_openAndClose_roundTrip(uint32 marginRaw, uint16 leverageX100, int16 priceMoveBps) public {
        // Constrain margin between 1,000 USDC and 10,000 USDC to stay within BASE_POS (200k)
        uint256 margin = bound(uint256(marginRaw), 1_000, 10_000) * 1e6;
        // Constrain leverage between 2x and 20x
        leverageX100 = uint16(bound(leverageX100, 200, 2000));
        // Bound price move between -2% and +2% so position stays healthy across all leverages
        priceMoveBps = int16(bound(priceMoveBps, -200, 200));

        // Fund trader with margin + fee buffer
        vm.prank(admin);
        usdc.mint(trader1, margin * 2);

        vm.prank(trader1);
        market.openPosition(true, margin, leverageX100);

        if (priceMoveBps != 0) {
            vm.prank(admin);
            feed.queueShock(int256(priceMoveBps));
        }

        vm.prank(trader1);
        market.closePosition();

        assertFalse(market.getPosition(trader1).active);
        // Position was completely closed without stranded state
        assertGt(usdc.balanceOf(trader1), 0);
    }
}
