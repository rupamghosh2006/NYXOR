// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Phase} from "./IMarketSchedule.sol";

/// @notice Risk parameters for a given phase.
/// @dev    All basis-point fields use 1e4 = 100%.
///         Leverage fields use X100 encoding: 2000 = 20.00x.
struct RiskParams {
    Phase   phase;
    /// @dev 2000 = 20.00x max leverage allowed to open or maintain
    uint16  maxLeverageX100;
    /// @dev Initial margin requirement in bps (500 = 5.00%)
    uint16  initialMarginBps;
    /// @dev Maintenance margin in bps; liquidation below this (250 = 2.50%)
    uint16  maintenanceMarginBps;
    /// @dev Maximum open interest per side, 6-decimal USDC units
    uint256 maxOpenInterestUsd;
    /// @dev Maximum single-position notional, 6-decimal USDC units
    uint256 maxPositionUsd;
    /// @dev Funding rate multiplier in bps (10000 = 1x baseline)
    uint16  fundingMultiplierBps;
    /// @dev When true, no new positions and no size increases are permitted
    bool    reduceOnly;
    /// @dev Keeper target leverage when deleveraging (500 = 5.00x)
    uint16  deleverageTargetX100;
}

/// @title IRiskPolicy
/// @notice Returns the risk parameters applicable at a given timestamp.
///         Two implementations: FlatRiskPolicy (naive baseline) and
///         MarketHoursRiskPolicy (the guarded engine).
interface IRiskPolicy {
    function getParams(uint256 ts) external view returns (RiskParams memory);
}
