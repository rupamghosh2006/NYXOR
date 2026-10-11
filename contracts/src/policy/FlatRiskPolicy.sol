// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRiskPolicy, RiskParams} from "../interfaces/IRiskPolicy.sol";
import {Phase} from "../interfaces/IMarketSchedule.sol";

/// @title FlatRiskPolicy
/// @notice The naive risk baseline: always returns static OPEN-phase parameters.
///         Does not adjust leverage, margin, or position limits for market closures.
///         Used for the Standard market in the weekend-gap demonstration.
contract FlatRiskPolicy is IRiskPolicy {
    uint256 public immutable baseMaxOpenInterestUsd;
    uint256 public immutable baseMaxPositionUsd;

    constructor(uint256 baseMaxOpenInterestUsd_, uint256 baseMaxPositionUsd_) {
        baseMaxOpenInterestUsd = baseMaxOpenInterestUsd_;
        baseMaxPositionUsd = baseMaxPositionUsd_;
    }

    /// @inheritdoc IRiskPolicy
    /// @dev Always returns static 20x leverage parameters regardless of timestamp or market phase.
    function getParams(uint256 /* ts */) external view override returns (RiskParams memory) {
        return RiskParams({
            phase: Phase.OPEN,
            maxLeverageX100: 2000,          // 20.00x
            initialMarginBps: 500,          // 5.00%
            maintenanceMarginBps: 250,      // 2.50%
            maxOpenInterestUsd: baseMaxOpenInterestUsd,
            maxPositionUsd: baseMaxPositionUsd,
            fundingMultiplierBps: 10000,    // 1.00x
            reduceOnly: false,
            deleverageTargetX100: 500       // 5.00x
        });
    }
}
