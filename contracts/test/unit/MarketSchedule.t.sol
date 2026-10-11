// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {MarketSchedule} from "../../src/core/MarketSchedule.sol";
import {Phase} from "../../src/interfaces/IMarketSchedule.sol";

/// @title MarketScheduleTest
/// @notice Full test suite for MarketSchedule phase logic.
///
/// ─── TIMESTAMP REFERENCE (all UTC, computed with PowerShell DateTimeOffset) ───
///
/// Monday 2026-10-12 00:00 UTC  = 1791763200
///   open  14:30 UTC            = 1791815400  (1791763200 + 52200)
///   close 21:00 UTC            = 1791838800  (1791763200 + 75600)
///   preClose start 20:00 UTC   = 1791835200  (close - 3600)
///   cooldown end 14:45 UTC     = 1791816300  (open  + 900)
///
/// Friday 2026-10-16 00:00 UTC  = 1792108800
///   open  14:30 UTC            = 1792161000
///   close 21:00 UTC            = 1792184400
///
/// Monday 2026-10-19 14:30 UTC  = 1792420200  (first open after weekend)
///
/// ─── LEGEND FOR BOUNDARY NAMES ───────────────────────────────────────────────
///   open-1   = open - 1 second   → CLOSED
///   open+0   = exactly at open   → REOPEN_COOLDOWN
///   open+RC-1= open + cooldown - 1 → REOPEN_COOLDOWN (last second of cooldown)
///   open+RC  = open + cooldown   → OPEN (first moment after cooldown)
///   close-W-1= close - preCloseWindow - 1 → OPEN (last moment before PRE_CLOSE)
///   close-W  = close - preCloseWindow   → PRE_CLOSE (first moment)
///   close-1  = close - 1 second → PRE_CLOSE (last moment)
///   close+0  = exactly at close → CLOSED
///
/// The Hinnant algorithm is needed ONLY to convert a Unix timestamp to a
/// (year, month, day) tuple for holiday lookup. Phase logic itself only uses
/// secInDay and weekday (pure modular arithmetic). The tests below exercise
/// specific real dates to validate the Gregorian conversion is correct.
contract MarketScheduleTest is Test {
    address internal admin = makeAddr("admin");
    MarketSchedule internal sched;

    // ── Real Monday 2026-10-12 (PowerShell-verified) ──────────────────────────
    uint256 internal constant MON_2026_10_12      = 1_791_763_200; // 00:00 UTC
    uint256 internal constant MON_OPEN            = 1_791_815_400; // 14:30 UTC
    uint256 internal constant MON_CLOSE           = 1_791_838_800; // 21:00 UTC
    uint256 internal constant MON_PRE_CLOSE_START = 1_791_835_200; // 20:00 UTC (close-3600)
    uint256 internal constant MON_COOLDOWN_END    = 1_791_816_300; // 14:45 UTC (open+900)

    // ── Real Friday 2026-10-16 ────────────────────────────────────────────────
    uint256 internal constant FRI_2026_10_16  = 1_792_108_800; // 00:00 UTC
    uint256 internal constant FRI_OPEN        = 1_792_161_000; // 14:30 UTC
    uint256 internal constant FRI_CLOSE       = 1_792_184_400; // 21:00 UTC

    // ── Monday 2026-10-19: first open after the Oct 16 weekend close ──────────
    uint256 internal constant MON2_OPEN = 1_792_420_200; // 14:30 UTC

    // ── Legacy epoch reference (kept for fuzz base alignment) ─────────────────
    // Monday 2024-01-08 00:00 UTC = 1704672000
    uint256 internal constant MON_EPOCH = 1_704_672_000;
    uint256 internal constant OPEN_TS   = MON_EPOCH + 52_200; // 14:30
    uint256 internal constant CLOSE_TS  = MON_EPOCH + 75_600; // 21:00

    function setUp() public {
        sched = new MarketSchedule(admin, 3600, 900);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _phase(uint256 ts) internal view returns (Phase) {
        (Phase p,,) = sched.phaseAt(ts);
        return p;
    }
    function _toClose(uint256 ts) internal view returns (uint256) {
        (, uint256 s,) = sched.phaseAt(ts);
        return s;
    }
    function _sinceOpen(uint256 ts) internal view returns (uint256) {
        (,, uint256 s) = sched.phaseAt(ts);
        return s;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION A: Eight canonical boundary points (real Monday 2026-10-12)
    // ═══════════════════════════════════════════════════════════════════════════

    /// open-1 → CLOSED (one second before session opens)
    function test_boundary_open_minus1() public view {
        assertEq(uint8(_phase(MON_OPEN - 1)), uint8(Phase.CLOSED));
    }

    /// open+0 → REOPEN_COOLDOWN (exactly at session open)
    function test_boundary_open_exact() public view {
        assertEq(uint8(_phase(MON_OPEN)), uint8(Phase.REOPEN_COOLDOWN));
    }

    /// open+cooldown-1 → REOPEN_COOLDOWN (last second of cooldown)
    function test_boundary_open_cooldown_minus1() public view {
        assertEq(uint8(_phase(MON_COOLDOWN_END - 1)), uint8(Phase.REOPEN_COOLDOWN));
    }

    /// open+cooldown → OPEN (first second after cooldown ends)
    function test_boundary_open_cooldown_exact() public view {
        assertEq(uint8(_phase(MON_COOLDOWN_END)), uint8(Phase.OPEN));
    }

    /// close-preCloseWindow-1 → OPEN (last second before PRE_CLOSE)
    function test_boundary_preclose_minus1() public view {
        assertEq(uint8(_phase(MON_PRE_CLOSE_START - 1)), uint8(Phase.OPEN));
    }

    /// close-preCloseWindow → PRE_CLOSE (first second of PRE_CLOSE)
    function test_boundary_preclose_exact() public view {
        assertEq(uint8(_phase(MON_PRE_CLOSE_START)), uint8(Phase.PRE_CLOSE));
    }

    /// close-1 → PRE_CLOSE (last second before close)
    function test_boundary_close_minus1() public view {
        assertEq(uint8(_phase(MON_CLOSE - 1)), uint8(Phase.PRE_CLOSE));
    }

    /// close+0 → CLOSED (exactly at session close)
    function test_boundary_close_exact() public view {
        assertEq(uint8(_phase(MON_CLOSE)), uint8(Phase.CLOSED));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION B: Friday close → weekend → Monday open (real dates 2026-10-16/19)
    // ═══════════════════════════════════════════════════════════════════════════

    /// Friday last trading second
    function test_friday_lastTradingSecond_isPreClose() public view {
        assertEq(uint8(_phase(FRI_CLOSE - 1)), uint8(Phase.PRE_CLOSE));
    }

    /// Friday exactly at close → CLOSED
    function test_friday_close_isClosed() public view {
        assertEq(uint8(_phase(FRI_CLOSE)), uint8(Phase.CLOSED));
    }

    /// Saturday midday → CLOSED
    function test_saturday_midday_isClosed() public view {
        uint256 satMidday = FRI_2026_10_16 + 86_400 + 43_200; // Sat 12:00 UTC
        assertEq(uint8(_phase(satMidday)), uint8(Phase.CLOSED));
    }

    /// Sunday midday → CLOSED
    function test_sunday_midday_isClosed() public view {
        uint256 sunMidday = FRI_2026_10_16 + 2 * 86_400 + 43_200; // Sun 12:00 UTC
        assertEq(uint8(_phase(sunMidday)), uint8(Phase.CLOSED));
    }

    /// One second before the next Monday open → CLOSED
    function test_friday_to_monday_bridgeIsClosed() public view {
        assertEq(uint8(_phase(MON2_OPEN - 1)), uint8(Phase.CLOSED));
    }

    /// Monday 2026-10-19 14:30 UTC → REOPEN_COOLDOWN (first open after weekend)
    function test_monday_after_weekend_isReopenCooldown() public view {
        assertEq(uint8(_phase(MON2_OPEN)), uint8(Phase.REOPEN_COOLDOWN));
    }

    /// Monday 2026-10-19 14:45 UTC → OPEN (cooldown ended)
    function test_monday_after_weekend_cooldownEnded_isOpen() public view {
        assertEq(uint8(_phase(MON2_OPEN + 900)), uint8(Phase.OPEN));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION C: Holiday override (Hinnant algorithm — real date 2026-10-12)
    // ═══════════════════════════════════════════════════════════════════════════
    // The Hinnant algorithm is used only to convert a Unix ts to (year,month,day)
    // for the holiday lookup. Section C validates it produces the correct date
    // for known real timestamps.

    /// Holiday on a real trading day → entire day CLOSED
    function test_holiday_realDate_2026_10_12_isClosed() public {
        vm.prank(admin);
        sched.addHoliday(2026, 10, 12); // Monday 2026-10-12
        // Mid-session should be closed
        assertEq(uint8(_phase(MON_OPEN + 3600)), uint8(Phase.CLOSED));
        // Before open should also be closed (was already closed, still closed)
        assertEq(uint8(_phase(MON_OPEN - 1)),    uint8(Phase.CLOSED));
    }

    /// Hinnant: Friday 2026-10-16 maps to YYYYMMDD = 20261016
    function test_hinnant_friday_2026_10_16() public {
        vm.prank(admin);
        sched.addHoliday(2026, 10, 16); // Friday 2026-10-16
        assertEq(uint8(_phase(FRI_OPEN + 3600)), uint8(Phase.CLOSED));
    }

    /// Hinnant: removing a holiday restores the correct phase
    function test_hinnant_removeHoliday_restores() public {
        vm.startPrank(admin);
        sched.addHoliday(2026, 10, 12);
        sched.removeHoliday(2026, 10, 12);
        vm.stopPrank();
        assertEq(uint8(_phase(MON_COOLDOWN_END)), uint8(Phase.OPEN));
    }

    /// Hinnant: a holiday on a Saturday has no observable effect (already CLOSED)
    function test_hinnant_holiday_on_saturday_noEffect() public {
        uint256 satMidday = FRI_2026_10_16 + 86_400 + 43_200;
        vm.prank(admin);
        sched.addHoliday(2026, 10, 17); // Saturday 2026-10-17
        assertEq(uint8(_phase(satMidday)), uint8(Phase.CLOSED)); // same as before
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION D: secondsToClose and secondsSinceOpen return values
    // ═══════════════════════════════════════════════════════════════════════════

    /// CLOSED periods must return (0, 0) for both fields
    function test_closed_returnsZeroFields() public view {
        (, uint256 toClose, uint256 sinceOpen) = sched.phaseAt(MON_OPEN - 1);
        assertEq(toClose,   0, "CLOSED: toClose must be 0");
        assertEq(sinceOpen, 0, "CLOSED: sinceOpen must be 0");
    }

    /// At the exact open: sinceOpen == 0, toClose == session length
    function test_open_sinceOpenIsZero() public view {
        assertEq(_sinceOpen(MON_OPEN), 0);
        assertEq(_toClose(MON_OPEN), 75_600 - 52_200); // 23400
    }

    /// One second before close: toClose == 1
    function test_closeMinusOne_toCloseIsOne() public view {
        assertEq(_toClose(MON_CLOSE - 1), 1);
    }

    /// At the first PRE_CLOSE second: toClose == preCloseWindow
    function test_preCloseStart_toCloseEqualsWindow() public view {
        assertEq(_toClose(MON_PRE_CLOSE_START), 3600);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION E: Admin updates
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setWindows_wider_preCloseWindow() public {
        vm.prank(admin);
        sched.setWindows(7200, 900); // 2h pre-close
        // 90 min before close should now be PRE_CLOSE
        assertEq(uint8(_phase(MON_CLOSE - 5400)), uint8(Phase.PRE_CLOSE));
    }

    function test_setSession_disablesMonday() public {
        vm.prank(admin);
        sched.setSession(0, false, 0, 0);
        assertEq(uint8(_phase(MON_OPEN + 3600)), uint8(Phase.CLOSED));
    }

    function test_setSession_unauthorized_reverts() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert();
        sched.setSession(0, false, 0, 0);
    }

    function test_setWindows_zeroReopenReverts() public {
        vm.prank(admin);
        vm.expectRevert(MarketSchedule.InvalidWindow.selector);
        sched.setWindows(3600, 0);
    }

    function test_setWindows_zeroPreCloseReverts() public {
        vm.prank(admin);
        vm.expectRevert(MarketSchedule.InvalidWindow.selector);
        sched.setWindows(0, 900);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SECTION F: Fuzz tests
    // ═══════════════════════════════════════════════════════════════════════════

    /// Phase must be one of the four valid enum values at any timestamp.
    function testFuzz_phaseAlwaysValid(uint256 ts) public view {
        ts = bound(ts, 1_000_000_000, 2_000_000_000);
        (Phase p,,) = sched.phaseAt(ts);
        assertTrue(
            p == Phase.OPEN          ||
            p == Phase.PRE_CLOSE     ||
            p == Phase.CLOSED        ||
            p == Phase.REOPEN_COOLDOWN,
            "unexpected phase value"
        );
    }

    /// On Saturday timestamps, phase is always CLOSED and fields are 0.
    function testFuzz_saturdayAlwaysClosed(uint256 offset) public view {
        // Any second during Sat 2026-10-17 (a fixed known Saturday)
        uint256 satStart = FRI_2026_10_16 + 86_400; // Sat 00:00 UTC
        uint256 ts = satStart + (offset % 86_400);
        (Phase p, uint256 toClose, uint256 sinceOpen) = sched.phaseAt(ts);
        assertEq(uint8(p), uint8(Phase.CLOSED), "Saturday must be CLOSED");
        assertEq(toClose,   0);
        assertEq(sinceOpen, 0);
    }

    /// During OPEN: toClose + sinceOpen == session length (constant invariant).
    ///
    /// WHY THIS ASSERTION: toClose = closeSecondsUTC - secInDay,
    ///                     sinceOpen = secInDay - openSecondsUTC.
    ///                     Their sum = closeSecondsUTC - openSecondsUTC = session length.
    ///                     This is a constant (23400s for the default schedule),
    ///                     independent of which second within OPEN we're at.
    ///
    /// THE ORIGINAL ASSERTION `assertEq(toClose+sinceOpen, CLOSE_TS - OPEN_TS - off)`
    ///   was wrong because CLOSE_TS - OPEN_TS - off = sessionLen - off ≠ sessionLen.
    ///   Counterexample: off=2100 → expected 21300, actual 23400 (always).
    function testFuzz_open_sumInvariant(uint32 offset) public view {
        // sessionLen=23400, cooldown=900, preClose=3600; OPEN window=[900,19800)
        uint32 sessionLen  = 75_600 - 52_200;  // 23400
        uint32 openWinLen  = sessionLen - 3600 - 900; // 18900
        uint32 off = 900 + (offset % openWinLen); // off ∈ [900, 19799]
        uint256 ts = OPEN_TS + off;
        (Phase p, uint256 toClose, uint256 sinceOpen) = sched.phaseAt(ts);
        assertEq(uint8(p), uint8(Phase.OPEN), "should be OPEN");
        assertEq(
            toClose + sinceOpen,
            uint256(sessionLen),
            "toClose+sinceOpen must equal session length"
        );
    }
}
