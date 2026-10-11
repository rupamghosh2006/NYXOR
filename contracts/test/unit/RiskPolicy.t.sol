// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MarketSchedule} from "../../src/core/MarketSchedule.sol";
import {MarketClock} from "../../src/core/MarketClock.sol";
import {FlatRiskPolicy} from "../../src/policy/FlatRiskPolicy.sol";
import {MarketHoursRiskPolicy} from "../../src/policy/MarketHoursRiskPolicy.sol";
import {IRiskPolicy, RiskParams} from "../../src/interfaces/IRiskPolicy.sol";
import {Phase} from "../../src/interfaces/IMarketSchedule.sol";

contract RiskPolicyTest is Test {
    address internal admin = makeAddr("admin");
    MarketClock internal clock;
    MarketSchedule internal sched;

    FlatRiskPolicy internal flatPolicy;
    MarketHoursRiskPolicy internal guardedPolicy;

    uint256 internal constant BASE_OI = 1_000_000 * 1e6;   // 1M USDC
    uint256 internal constant BASE_POS = 100_000 * 1e6;    // 100k USDC

    // Monday 2026-10-12 reference
    uint256 internal constant MON_OPEN            = 1_791_815_400; // 14:30 UTC
    uint256 internal constant MON_PRE_CLOSE_START = 1_791_835_200; // 20:00 UTC (preCloseWindow=3600)
    uint256 internal constant MON_CLOSE           = 1_791_838_800; // 21:00 UTC

    function setUp() public {
        clock = new MarketClock(admin, true);
        sched = new MarketSchedule(admin, 3600, 900);

        flatPolicy = new FlatRiskPolicy(BASE_OI, BASE_POS);
        guardedPolicy = new MarketHoursRiskPolicy(address(sched), BASE_OI, BASE_POS);
    }

    // ─── FlatRiskPolicy Tests ─────────────────────────────────────────────────

    function test_flatPolicy_alwaysReturnsOpen() public view {
        // Test during OPEN
        RiskParams memory p1 = flatPolicy.getParams(MON_OPEN + 1000);
        assertEq(uint8(p1.phase), uint8(Phase.OPEN));
        assertEq(p1.maxLeverageX100, 2000);
        assertEq(p1.initialMarginBps, 500);
        assertEq(p1.maintenanceMarginBps, 250);
        assertEq(p1.maxOpenInterestUsd, BASE_OI);
        assertFalse(p1.reduceOnly);

        // Test during PRE_CLOSE
        RiskParams memory p2 = flatPolicy.getParams(MON_PRE_CLOSE_START + 1800);
        assertEq(p2.maxLeverageX100, 2000);
        assertFalse(p2.reduceOnly);

        // Test during CLOSED (weekend)
        RiskParams memory p3 = flatPolicy.getParams(MON_CLOSE + 86400);
        assertEq(p3.maxLeverageX100, 2000);
        assertFalse(p3.reduceOnly);
    }

    // ─── MarketHoursRiskPolicy Tests ──────────────────────────────────────────

    function test_guardedPolicy_openPhase() public view {
        RiskParams memory p = guardedPolicy.getParams(MON_OPEN + 1000);
        assertEq(uint8(p.phase), uint8(Phase.OPEN));
        assertEq(p.maxLeverageX100, 2000);
        assertEq(p.initialMarginBps, 500);
        assertEq(p.maintenanceMarginBps, 250);
        assertEq(p.maxOpenInterestUsd, BASE_OI);
        assertEq(p.fundingMultiplierBps, 10000);
        assertFalse(p.reduceOnly);
        assertEq(p.deleverageTargetX100, 500);
    }

    function test_guardedPolicy_preCloseStart() public view {
        // At exact start of PRE_CLOSE (secondsToClose = 3600)
        RiskParams memory p = guardedPolicy.getParams(MON_PRE_CLOSE_START);
        assertEq(uint8(p.phase), uint8(Phase.PRE_CLOSE));
        assertEq(p.maxLeverageX100, 2000); // 20x at start of window
        assertEq(p.initialMarginBps, 500);
        assertEq(p.maxOpenInterestUsd, BASE_OI);
        assertEq(p.fundingMultiplierBps, 10000);
        assertFalse(p.reduceOnly);
    }

    function test_guardedPolicy_preCloseMidpoint() public view {
        // Halfway through 1-hour pre-close window (elapsed = 1800s, toClose = 1800s)
        RiskParams memory p = guardedPolicy.getParams(MON_PRE_CLOSE_START + 1800);
        assertEq(uint8(p.phase), uint8(Phase.PRE_CLOSE));
        // Leverage halfway between 2000 and 500: 2000 - 750 = 1250 (12.50x)
        assertEq(p.maxLeverageX100, 1250);
        // IM = 1_000_000 / 1250 = 800 bps (8.00%)
        assertEq(p.initialMarginBps, 800);
        // MM = 250 + ((600 - 250) * 5000) / 10000 = 425 bps (4.25%)
        assertEq(p.maintenanceMarginBps, 425);
        // OI cap: 100% -> 40% halfway: 70% of base
        assertEq(p.maxOpenInterestUsd, (BASE_OI * 70) / 100);
        // Funding: 1x -> 2x halfway: 15000 bps (1.50x)
        assertEq(p.fundingMultiplierBps, 15000);
        assertFalse(p.reduceOnly);
    }

    /// @notice Test that no parameter jumps at OPEN -> PRE_CLOSE boundary
    function test_guardedPolicy_continuousAtOpenPreCloseBoundary() public view {
        RiskParams memory openP = guardedPolicy.getParams(MON_PRE_CLOSE_START - 1);
        RiskParams memory preP  = guardedPolicy.getParams(MON_PRE_CLOSE_START);

        assertEq(uint8(openP.phase), uint8(Phase.OPEN));
        assertEq(uint8(preP.phase),  uint8(Phase.PRE_CLOSE));

        // Exact match across boundary
        assertEq(preP.maxLeverageX100, openP.maxLeverageX100);
        assertEq(preP.initialMarginBps, openP.initialMarginBps);
        assertEq(preP.maintenanceMarginBps, openP.maintenanceMarginBps);
        assertEq(preP.maxOpenInterestUsd, openP.maxOpenInterestUsd);
        assertEq(preP.maxPositionUsd, openP.maxPositionUsd);
        assertEq(preP.fundingMultiplierBps, openP.fundingMultiplierBps);
        assertEq(preP.reduceOnly, openP.reduceOnly);
    }

    /// @notice Test that no parameter jumps at PRE_CLOSE -> CLOSED boundary except reduceOnly
    function test_guardedPolicy_continuousAtPreCloseClosedBoundary() public view {
        // Last second of PRE_CLOSE
        RiskParams memory preP    = guardedPolicy.getParams(MON_CLOSE - 1);
        // First second of CLOSED
        RiskParams memory closedP = guardedPolicy.getParams(MON_CLOSE);

        assertEq(uint8(preP.phase),    uint8(Phase.PRE_CLOSE));
        assertEq(uint8(closedP.phase), uint8(Phase.CLOSED));

        // Discrepancy bounded by 1 second discretization (at most 4-5 bps out of 3600 seconds)
        assertApproxEqAbs(preP.maxLeverageX100, closedP.maxLeverageX100, 2);
        assertApproxEqAbs(preP.initialMarginBps, closedP.initialMarginBps, 5);
        assertApproxEqAbs(preP.maintenanceMarginBps, closedP.maintenanceMarginBps, 2);
        assertApproxEqAbs(preP.maxOpenInterestUsd, closedP.maxOpenInterestUsd, 200 * 1e6); // <0.05% of 1M
        assertApproxEqAbs(preP.maxPositionUsd, closedP.maxPositionUsd, 20 * 1e6);
        assertApproxEqAbs(preP.fundingMultiplierBps, closedP.fundingMultiplierBps, 5);

        // ONLY reduceOnly switches from false to true
        assertFalse(preP.reduceOnly);
        assertTrue(closedP.reduceOnly);
    }

    function test_guardedPolicy_preCloseEnd() public view {
        // Last second before close (toClose = 1)
        RiskParams memory p = guardedPolicy.getParams(MON_CLOSE - 1);
        assertEq(uint8(p.phase), uint8(Phase.PRE_CLOSE));
        // Just about 500 (5.00x)
        assertLe(p.maxLeverageX100, 501);
        assertGe(p.maxLeverageX100, 500);
    }

    function test_guardedPolicy_closedPhase() public view {
        // Exactly at close -> CLOSED
        RiskParams memory p = guardedPolicy.getParams(MON_CLOSE);
        assertEq(uint8(p.phase), uint8(Phase.CLOSED));
        assertEq(p.maxLeverageX100, 500);
        assertEq(p.initialMarginBps, 2000);
        assertEq(p.maintenanceMarginBps, 600);
        assertEq(p.maxOpenInterestUsd, (BASE_OI * 40) / 100);
        assertEq(p.fundingMultiplierBps, 20000);
        assertTrue(p.reduceOnly);
        assertEq(p.deleverageTargetX100, 500);
    }

    function test_guardedPolicy_reopenCooldown() public view {
        // During 900s reopen cooldown at open
        RiskParams memory p = guardedPolicy.getParams(MON_OPEN + 100);
        assertEq(uint8(p.phase), uint8(Phase.REOPEN_COOLDOWN));
        assertEq(p.maxLeverageX100, 500);
        assertEq(p.initialMarginBps, 2000);
        assertEq(p.maintenanceMarginBps, 600);
        assertEq(p.maxOpenInterestUsd, (BASE_OI * 40) / 100);
        assertEq(p.fundingMultiplierBps, 20000);
        assertTrue(p.reduceOnly);
    }
}
