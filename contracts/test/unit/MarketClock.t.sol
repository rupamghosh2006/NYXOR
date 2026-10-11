// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MarketClock} from "../../src/core/MarketClock.sol";

/// @title MarketClockTest
/// @notice Unit tests for MarketClock.
///         Scenarios: demo vs production mode, offset arithmetic, access control.
contract MarketClockTest is Test {
    address internal admin = makeAddr("admin");
    address internal stranger = makeAddr("stranger");

    MarketClock internal clock;
    MarketClock internal prodClock;

    function setUp() public {
        clock     = new MarketClock(admin, true);   // demo mode ON
        prodClock = new MarketClock(admin, false);  // demo mode OFF
    }

    // ─── Basic operation ──────────────────────────────────────────────────────

    function test_demoModeFlag() public view {
        assertTrue(clock.demoMode());
        assertFalse(prodClock.demoMode());
    }

    function test_nowReturnsTimestamp_noOffset() public view {
        // With no offset, now() == block.timestamp
        assertEq(clock.effectiveNow(), block.timestamp);
    }

    function test_nowAdvancedByOffset() public {
        vm.prank(admin);
        clock.setDemoOffset(3600);
        assertEq(clock.effectiveNow(), block.timestamp + 3600);
    }

    function test_nowWithNegativeOffset() public {
        // Push block.timestamp forward first so we don't underflow
        vm.warp(block.timestamp + 7200);
        vm.prank(admin);
        clock.setDemoOffset(-3600);
        assertEq(clock.effectiveNow(), block.timestamp - 3600);
    }

    function test_advance_accumulatesOffset() public {
        vm.startPrank(admin);
        clock.advance(600);
        clock.advance(600);
        vm.stopPrank();
        assertEq(clock.effectiveNow(), block.timestamp + 1200);
    }

    // ─── Access control ───────────────────────────────────────────────────────

    function test_setDemoOffset_revertIfNotAdmin() public {
        vm.prank(stranger);
        vm.expectRevert();
        clock.setDemoOffset(100);
    }

    function test_advance_revertIfNotAdmin() public {
        vm.prank(stranger);
        vm.expectRevert();
        clock.advance(100);
    }

    function test_advance_revertIfZero() public {
        vm.prank(admin);
        vm.expectRevert(MarketClock.AdvanceZero.selector);
        clock.advance(0);
    }

    // ─── Production mode guards ───────────────────────────────────────────────

    function test_setDemoOffset_revertInProdMode() public {
        vm.prank(admin);
        vm.expectRevert(MarketClock.DemoModeNotEnabled.selector);
        prodClock.setDemoOffset(100);
    }

    function test_advance_revertInProdMode() public {
        vm.prank(admin);
        vm.expectRevert(MarketClock.DemoModeNotEnabled.selector);
        prodClock.advance(100);
    }

    // ─── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_advance_monotonicWithPositiveOffset(uint32 delta) public {
        vm.assume(delta > 0);
        uint256 before = clock.effectiveNow();
        vm.prank(admin);
        clock.advance(delta);
        assertGe(clock.effectiveNow(), before + delta);
    }

    function testFuzz_setOffset_effectiveNowCorrect(int64 offset) public {
        // Only test non-underflow cases
        vm.assume(int256(block.timestamp) + int256(offset) >= 0);
        vm.prank(admin);
        clock.setDemoOffset(offset);
        uint256 expected = offset >= 0
            ? block.timestamp + uint256(int256(offset))
            : block.timestamp - uint256(-int256(offset));
        assertEq(clock.effectiveNow(), expected);
    }
}
