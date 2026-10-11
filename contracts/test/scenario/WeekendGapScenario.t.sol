// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/// @title WeekendGapScenarioTest
/// @notice Deterministic reproduction of the weekend-gap scenario from AGENTS.md §13.
///         Compares Standard market (naive flat policy) vs Guarded market (market-hours risk policy).
///
///         TIMELINE:
///         1. Friday afternoon: T1-T5 open positions on both markets (identical entries).
///         2. Pre-close window (T-30m): T6 tries to open 20x long; rejected on Guarded, succeeds on Standard.
///         3. Pre-close final 10m: Keeper deleverages over-cap positions on Guarded to 5x at open-market price.
///         4. Weekend: Reference market closes. Close price check-pointed at 4,150.00 USD.
///         5. Monday Reopen: Reference market opens with an -8% gap (4,150 -> 3,818 USD).
///         6. Outcome assertion:
///            - Standard market accumulates BAD DEBT (losses exceed collateral).
///            - Guarded market has ZERO BAD DEBT (collateral fully buffers the 8% jump).
contract WeekendGapScenarioTest is Test {
    /// @dev Skipped until PerpMarket contract is implemented in Phase 3.
    function test_scenario_weekend_gap() public {
        vm.skip(true);
    }
}
