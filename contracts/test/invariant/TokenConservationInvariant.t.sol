// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Handler} from "./Handler.sol";
import {PerpMarket} from "../../src/core/PerpMarket.sol";
import {LiquidityVault} from "../../src/vault/LiquidityVault.sol";
import {DemoUSDC} from "../../src/core/DemoUSDC.sol";
import {MockPriceFeed} from "../../src/oracle/MockPriceFeed.sol";
import {MarketClock} from "../../src/core/MarketClock.sol";
import {MarketSchedule} from "../../src/core/MarketSchedule.sol";
import {MarketHoursRiskPolicy} from "../../src/policy/MarketHoursRiskPolicy.sol";
import {IPerpMarket} from "../../src/interfaces/IPerpMarket.sol";

contract TokenConservationInvariantTest is Test {
    address internal admin = makeAddr("admin");

    MarketClock internal clock;
    MarketSchedule internal schedule;
    MockPriceFeed internal feed;
    MarketHoursRiskPolicy internal policy;
    DemoUSDC internal usdc;
    LiquidityVault internal vault;
    PerpMarket internal market;
    Handler internal handler;

    uint256 internal constant INITIAL_PRICE = 4150_00000000;
    uint256 internal constant SEED_VAULT = 1_000_000 * 1e6;
    uint256 internal constant BASE_OI = 1_000_000 * 1e6;
    uint256 internal constant BASE_POS = 200_000 * 1e6;

    // Friday 2026-10-16 16:30 UTC
    uint256 internal constant FRI_OPEN = 1_792_161_000;

    function setUp() public {
        clock = new MarketClock(admin, true);
        schedule = new MarketSchedule(admin, 3600, 900);

        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_OPEN + 7200) - int256(block.timestamp));

        feed = new MockPriceFeed(admin, address(clock), address(schedule), INITIAL_PRICE);
        policy = new MarketHoursRiskPolicy(address(schedule), BASE_OI, BASE_POS);
        usdc = new DemoUSDC(admin);
        vault = new LiquidityVault(admin, address(usdc));

        market = new PerpMarket(
            admin,
            address(usdc),
            address(policy),
            address(feed),
            address(clock),
            address(schedule),
            payable(address(vault))
        );

        vm.startPrank(admin);
        vault.grantRole(vault.MARKET_ROLE(), address(market));
        market.grantRole(market.KEEPER_ROLE(), admin);

        // Seed vault with 1,000,000 USDx
        usdc.mint(admin, SEED_VAULT);
        usdc.approve(address(vault), SEED_VAULT);
        vault.deposit(SEED_VAULT);
        vm.stopPrank();

        handler = new Handler(
            admin,
            address(market),
            address(vault),
            address(usdc),
            address(feed),
            address(clock),
            address(schedule),
            address(policy)
        );

        targetContract(address(handler));
    }

    /// @notice Invariant 1: Market holds exactly the sum of collateral of all active open positions
    function invariant_marketCollateralConservation() public view {
        address[] memory traders = handler.getTraders();
        uint256 totalTraderCollateral = 0;
        for (uint256 i = 0; i < traders.length; i++) {
            IPerpMarket.Position memory pos = market.getPosition(traders[i]);
            if (pos.active) {
                totalTraderCollateral += pos.collateral;
            }
        }
        assertEq(
            usdc.balanceOf(address(market)),
            totalTraderCollateral,
            "Exact Market Collateral Invariant Violated: market balance != sum of open collateral"
        );
    }

    /// @notice Invariant 2: Vault holds exactly LP assets plus segregated insurance reserves
    function invariant_vaultReserveConservation() public view {
        assertEq(
            usdc.balanceOf(address(vault)),
            vault.vaultAssets() + vault.insuranceFund(),
            "Exact Vault Reserve Invariant Violated: vault balance != vaultAssets + insuranceFund"
        );
    }

    /// @notice Explicit liquidation test with negative equity asserting both two-sided invariants
    function test_liquidate_negativeEquity_exactConservationInvariants() public {
        address trader = handler.getTraders()[0];

        // Open 20x Long with 10,000 USDx margin (200k notional)
        vm.prank(trader);
        market.openPosition(true, 10_000 * 1e6, 2000);

        // Assert invariants immediately after open
        invariant_marketCollateralConservation();
        invariant_vaultReserveConservation();

        // Shock price by -8% (4150 -> 3818): gross loss = -16,000 USDx > 10,000 collateral -> negative equity!
        vm.prank(admin);
        feed.queueShock(-800);

        // Liquidate trader
        address liquidator = makeAddr("liquidator");
        vm.prank(liquidator);
        market.liquidate(trader);

        // Position is closed and trader wiped
        assertFalse(market.getPosition(trader).active);

        // Negative equity recorded in badDebtTotal
        assertGt(vault.badDebtTotal(), 0);
        // Liquidator received reward
        assertGt(usdc.balanceOf(liquidator), 0);

        // Both exact invariants hold with ZERO stranded tokens!
        invariant_marketCollateralConservation();
        invariant_vaultReserveConservation();
    }
}
