// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MarketSchedule} from "../../src/core/MarketSchedule.sol";
import {MarketClock} from "../../src/core/MarketClock.sol";
import {MockPriceFeed} from "../../src/oracle/MockPriceFeed.sol";
import {Phase} from "../../src/interfaces/IMarketSchedule.sol";

contract MockPriceFeedTest is Test {
    address internal admin = makeAddr("admin");
    address internal stranger = makeAddr("stranger");

    MarketClock internal clock;
    MarketSchedule internal sched;
    MockPriceFeed internal feed;

    uint256 internal constant INITIAL_PRICE = 4150 * 1e8; // 4,150.00 USD

    // Friday 2026-10-16 close
    uint256 internal constant FRI_CLOSE = 1_792_184_400;

    function setUp() public {
        clock = new MarketClock(admin, true);
        sched = new MarketSchedule(admin, 3600, 900);
        feed = new MockPriceFeed(admin, address(clock), address(sched), INITIAL_PRICE);
    }

    function test_initialPrice() public view {
        (uint256 price, uint256 updated) = feed.latestPrice();
        assertEq(price, INITIAL_PRICE);
        assertEq(updated, clock.effectiveNow());
    }

    function test_setPrice_admin() public {
        vm.prank(admin);
        clock.advance(100);

        uint256 newPrice = 4200 * 1e8;
        vm.prank(admin);
        feed.setPrice(newPrice);

        (uint256 price, uint256 updated) = feed.latestPrice();
        assertEq(price, newPrice);
        assertEq(updated, clock.effectiveNow());
    }

    function test_setPrice_strangerReverts() public {
        vm.prank(stranger);
        vm.expectRevert();
        feed.setPrice(4200 * 1e8);
    }

    function test_queueShock_negative8Percent() public {
        // -8.00% = -800 bps
        // 4150 * (1 - 0.08) = 3818.00 USD
        vm.prank(admin);
        feed.queueShock(-800);

        (uint256 price,) = feed.latestPrice();
        assertEq(price, 3818 * 1e8);
    }

    function test_queueShock_negative25Percent() public {
        // -25.00% = -2500 bps
        // 4150 * 0.75 = 3112.50 USD
        vm.prank(admin);
        feed.queueShock(-2500);

        (uint256 price,) = feed.latestPrice();
        assertEq(price, 311250000000); // 3,112.50 * 1e8
    }

    function test_queueShock_positive5Percent() public {
        // +5.00% = +500 bps
        // 4150 * 1.05 = 4357.50 USD
        vm.prank(admin);
        feed.queueShock(500);

        (uint256 price,) = feed.latestPrice();
        assertEq(price, 435750000000);
    }

    function test_checkpointClose_revertsWhenNotClosed() public {
        // Open time
        vm.prank(admin);
        clock.setDemoOffset(int256(1_791_815_400 + 1000) - int256(block.timestamp));

        vm.expectRevert(MockPriceFeed.NotClosedPhase.selector);
        feed.checkpointClose();
    }

    function test_checkpointClose_recordsWhenClosed() public {
        // Warp clock to Friday after close (e.g. 100 seconds past close)
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE + 100) - int256(block.timestamp));

        feed.checkpointClose();
        assertEq(feed.lastOfficialClosePrice(), INITIAL_PRICE);
        // Semantics: must record the scheduled close time (FRI_CLOSE), NEVER the call time
        assertEq(feed.lastCloseTimestamp(), FRI_CLOSE);
    }

    function test_checkpointClose_revertsIfCalledTwiceInSameClosedSession() public {
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE + 100) - int256(block.timestamp));

        feed.checkpointClose();

        // Second call in the same closed weekend session must revert
        vm.expectRevert(MockPriceFeed.AlreadyCheckpointedForSession.selector);
        feed.checkpointClose();
    }

    function test_closedPhase_doesNotOverwriteOfficialClosePrice() public {
        // 1. Establish an official close price while in PRE_CLOSE (e.g. 4150.00)
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE - 100) - int256(block.timestamp)); // PRE_CLOSE
        vm.prank(admin);
        feed.setPrice(4150 * 1e8);
        assertEq(feed.lastOfficialClosePrice(), 4150 * 1e8);

        // 2. Advance time into CLOSED (weekend)
        vm.prank(admin);
        clock.setDemoOffset(int256(FRI_CLOSE + 3600) - int256(block.timestamp)); // CLOSED

        // 3. Admin/Keeper applies a gap shock during the weekend
        vm.prank(admin);
        feed.queueShock(-800); // -8% shock to simulate Monday gap

        (uint256 currentPrice,) = feed.latestPrice();
        assertEq(currentPrice, 3818 * 1e8); // current price changed
        // BUT lastOfficialClosePrice must remain frozen at 4150.00!
        assertEq(feed.lastOfficialClosePrice(), 4150 * 1e8);

        // 4. Admin/Keeper calls setPrice directly during CLOSED
        vm.prank(admin);
        feed.setPrice(3700 * 1e8);

        (currentPrice,) = feed.latestPrice();
        assertEq(currentPrice, 3700 * 1e8);
        // lastOfficialClosePrice STILL strictly frozen
        assertEq(feed.lastOfficialClosePrice(), 4150 * 1e8);
    }

    function test_isStale() public {
        // Current age is 0
        assertFalse(feed.isStale(60));

        // Advance clock by 120 seconds
        vm.prank(admin);
        clock.advance(120);

        assertTrue(feed.isStale(60));
        assertFalse(feed.isStale(180));
    }
}
