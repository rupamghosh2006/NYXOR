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
        usdc.mint(trader1, 50_000 * 1e6);
        usdc.mint(trader2, 50_000 * 1e6);
        vm.stopPrank();

        vm.prank(trader1);
        usdc.approve(address(market), type(uint256).max);

        vm.prank(trader2);
        usdc.approve(address(market), type(uint256).max);
    }

    function test_openPosition_success() public {
        // Trader1 opens 10k collateral at 20x -> 200k notional
        uint256 col = 10_000 * 1e6;
        vm.prank(trader1);
        market.openPosition(true, col, 2000); // 20.00x

        IPerpMarket.Position memory pos = market.getPosition(trader1);
        assertTrue(pos.active);
        assertTrue(pos.isLong);
        assertEq(pos.sizeUsd, 200_000 * 1e6);
        assertEq(pos.entryPrice, INITIAL_PRICE);
        // Net collateral = 10k - 6 bps taker fee (120 USDC) = 9,880 USDC
        assertEq(pos.collateral, 9_880 * 1e6);
    }

    function test_openPosition_revertExcessiveLeverage() public {
        vm.prank(trader1);
        vm.expectRevert();
        market.openPosition(true, 10_000 * 1e6, 2500); // 25x > 20x max
    }

    function test_closePosition_profitSettled() public {
        uint256 col = 10_000 * 1e6;
        vm.prank(trader1);
        market.openPosition(true, col, 1000); // 10x long -> 100k notional

        // Price increases by +5%: 4150 -> 4357.50
        vm.prank(admin);
        feed.queueShock(500);

        uint256 balanceBefore = usdc.balanceOf(trader1);
        vm.prank(trader1);
        market.closePosition();

        uint256 balanceAfter = usdc.balanceOf(trader1);
        // Trader gained 5% on 100k notional = ~5,000 USDC profit minus close fees
        assertGt(balanceAfter - balanceBefore, col);
    }

    function test_addAndRemoveMargin() public {
        uint256 col = 10_000 * 1e6;
        vm.prank(trader1);
        market.openPosition(true, col, 1000); // 10x long

        // Add 2,000 margin
        vm.prank(trader1);
        market.addMargin(2_000 * 1e6);
        assertEq(market.getPosition(trader1).collateral, (col - 60 * 1e6) + 2_000 * 1e6);

        // Remove 1,000 margin
        vm.prank(trader1);
        market.removeMargin(1_000 * 1e6);
        assertEq(market.getPosition(trader1).collateral, (col - 60 * 1e6) + 1_000 * 1e6);
    }

    function test_liquidate_shortfallCoveredByInsuranceAndVault() public {
        uint256 col = 10_000 * 1e6;
        vm.prank(trader1);
        market.openPosition(true, col, 2000); // 20x long -> 200k notional

        // Price drops -6% (4150 -> 3901): 20x loss = 120% of collateral -> negative equity!
        vm.prank(admin);
        feed.queueShock(-600);

        uint256 keeperBalBefore = usdc.balanceOf(keeper);
        vm.prank(keeper);
        market.liquidate(trader1);

        // Position cleared
        assertFalse(market.getPosition(trader1).active);
        // Keeper received reward (50 bps of 200k = 1,000 USDC)
        assertEq(usdc.balanceOf(keeper) - keeperBalBefore, 1_000 * 1e6);
        // Vault covered shortfall and accumulated bad debt
        assertGt(vault.badDebtTotal(), 0);
    }

    function test_deleverageToCap_inPreCloseWindow() public {
        uint256 col = 10_000 * 1e6;
        vm.prank(trader1);
        market.openPosition(true, col, 2000); // 20x long -> 200k notional

        // Advance clock to final 10 minutes of PRE_CLOSE (e.g. 5 minutes before close)
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE - 300) - int256(block.timestamp));

        // Push fresh price quote at T-5m
        vm.prank(admin);
        feed.setPrice(INITIAL_PRICE);

        // Keeper deleverages trader1 to 5x
        vm.prank(keeper);
        market.deleverageToCap(trader1);

        IPerpMarket.Position memory pos = market.getPosition(trader1);
        // Position size reduced to 5x of equity: ~9,880 * 5 = ~49,400 USDC
        assertLe(pos.sizeUsd, 50_000 * 1e6);
        assertGe(pos.sizeUsd, 48_000 * 1e6);
    }

    /// @notice Conservation invariant: total tokens held by (market + vault) >= sum(collateral) + vaultAssets + insuranceFund
    function testInvariant_tokenConservation() public {
        uint256 col1 = 10_000 * 1e6;
        uint256 col2 = 5_000 * 1e6;

        vm.prank(trader1);
        market.openPosition(true, col1, 1000);

        vm.prank(trader2);
        market.openPosition(false, col2, 1000);

        uint256 totalMarketTokens = usdc.balanceOf(address(market));
        uint256 totalVaultTokens = usdc.balanceOf(address(vault));
        uint256 totalInSystem = totalMarketTokens + totalVaultTokens;

        uint256 totalClaimable = market.getPosition(trader1).collateral
            + market.getPosition(trader2).collateral
            + vault.vaultAssets()
            + vault.insuranceFund();

        assertGe(totalInSystem, totalClaimable, "Conservation invariant violated");
    }
}
