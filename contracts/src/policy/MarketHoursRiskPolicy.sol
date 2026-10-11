// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRiskPolicy, RiskParams} from "../interfaces/IRiskPolicy.sol";
import {IMarketSchedule, Phase} from "../interfaces/IMarketSchedule.sol";

/// @title MarketHoursRiskPolicy
/// @notice The market-hours-aware risk engine.
///         Reads current market phase from MarketSchedule and computes dynamic risk parameters:
///         - OPEN: Normal full-leverage mode (20x, 5% IM, 2.5% MM, 100% OI cap, 1x funding)
///         - PRE_CLOSE: Deterministic linear ramp-down (20x -> 5x leverage, 100% -> 40% OI cap, 1x -> 2x funding)
///         - CLOSED: Defensive weekend/overnight limits (5x leverage, 20% IM, 6% MM, 40% OI cap, 2x funding, reduce-only)
///         - REOPEN_COOLDOWN: Defensive cooldown after open (5x leverage, 20% IM, 6% MM, 40% OI cap, 2x funding, reduce-only)
contract MarketHoursRiskPolicy is IRiskPolicy {
    IMarketSchedule public immutable schedule;
    uint256 public immutable baseMaxOpenInterestUsd;
    uint256 public immutable baseMaxPositionUsd;

    // Phase parameter constants
    uint16 public constant OPEN_MAX_LEVERAGE_X100 = 2000;       // 20.00x
    uint16 public constant OPEN_INITIAL_MARGIN_BPS = 500;       // 5.00%
    uint16 public constant OPEN_MAINTENANCE_MARGIN_BPS = 250;   // 2.50%
    uint16 public constant OPEN_FUNDING_MULT_BPS = 10000;       // 1.00x

    uint16 public constant CLOSED_MAX_LEVERAGE_X100 = 500;      // 5.00x
    uint16 public constant CLOSED_INITIAL_MARGIN_BPS = 2000;    // 20.00%
    uint16 public constant CLOSED_MAINTENANCE_MARGIN_BPS = 600; // 6.00%
    uint16 public constant CLOSED_FUNDING_MULT_BPS = 20000;     // 2.00x

    uint16 public constant DELEVERAGE_TARGET_X100 = 500;        // 5.00x

    error InvalidSchedule();

    constructor(
        address schedule_,
        uint256 baseMaxOpenInterestUsd_,
        uint256 baseMaxPositionUsd_
    ) {
        if (schedule_ == address(0)) revert InvalidSchedule();
        schedule = IMarketSchedule(schedule_);
        baseMaxOpenInterestUsd = baseMaxOpenInterestUsd_;
        baseMaxPositionUsd = baseMaxPositionUsd_;
    }

    /// @inheritdoc IRiskPolicy
    function getParams(uint256 ts) external view override returns (RiskParams memory) {
        (Phase phase, uint256 secondsToClose,) = schedule.phaseAt(ts);

        if (phase == Phase.OPEN) {
            return RiskParams({
                phase: Phase.OPEN,
                maxLeverageX100: OPEN_MAX_LEVERAGE_X100,
                initialMarginBps: OPEN_INITIAL_MARGIN_BPS,
                maintenanceMarginBps: OPEN_MAINTENANCE_MARGIN_BPS,
                maxOpenInterestUsd: baseMaxOpenInterestUsd,
                maxPositionUsd: baseMaxPositionUsd,
                fundingMultiplierBps: OPEN_FUNDING_MULT_BPS,
                reduceOnly: false,
                deleverageTargetX100: DELEVERAGE_TARGET_X100
            });
        }

        if (phase == Phase.PRE_CLOSE) {
            return _computePreCloseParams(secondsToClose);
        }

        // CLOSED and REOPEN_COOLDOWN share the defensive closed regime limits
        return RiskParams({
            phase: phase,
            maxLeverageX100: CLOSED_MAX_LEVERAGE_X100,
            initialMarginBps: CLOSED_INITIAL_MARGIN_BPS,
            maintenanceMarginBps: CLOSED_MAINTENANCE_MARGIN_BPS,
            maxOpenInterestUsd: (baseMaxOpenInterestUsd * 40) / 100,
            maxPositionUsd: (baseMaxPositionUsd * 40) / 100,
            fundingMultiplierBps: CLOSED_FUNDING_MULT_BPS,
            reduceOnly: true,
            deleverageTargetX100: DELEVERAGE_TARGET_X100
        });
    }

    /// @dev Linearly interpolates parameters over the pre-close window from OPEN to CLOSED values.
    function _computePreCloseParams(uint256 secondsToClose) internal view returns (RiskParams memory) {
        uint256 window = schedule.preCloseWindow();
        if (window == 0) {
            window = 1; // safety against div-by-zero
        }

        // secondsToClose goes from window down to 0
        uint256 effectiveToClose = secondsToClose > window ? window : secondsToClose;
        uint256 elapsed = window - effectiveToClose;

        // progress: 0 at start of PRE_CLOSE -> 10000 at exact close
        uint256 progressBps = (elapsed * 10000) / window;

        // Conservative rounding:
        // 1. Max leverage rounded DOWN (floor) by ceiling the subtracted reduction
        uint256 levReduction = ((uint256(OPEN_MAX_LEVERAGE_X100 - CLOSED_MAX_LEVERAGE_X100) * progressBps) + 9999) / 10000;
        uint16 maxLev = uint16(OPEN_MAX_LEVERAGE_X100 - levReduction);

        // 2. Initial margin rounded UP (ceil): imBps = ceil(1e6 / maxLev)
        uint16 imBps = uint16((1_000_000 + maxLev - 1) / maxLev);

        // 3. Maintenance margin stays at OPEN value (2.50%) throughout all of PRE_CLOSE.
        //    Rationale: Ramping MM during PRE_CLOSE would make 20x positions (~4.94% equity)
        //    liquidatable before the T-10m deleveraging window opens.
        //    MM steps to 6.00% strictly upon entering CLOSED.
        uint16 mmBps = OPEN_MAINTENANCE_MARGIN_BPS;

        // 4. OI and Position caps rounded DOWN (floor) by ceiling the discount
        uint256 oiDiscount = (baseMaxOpenInterestUsd * 60 * progressBps + (100 * 10000 - 1)) / (100 * 10000);
        uint256 maxOi = baseMaxOpenInterestUsd - oiDiscount;

        uint256 posDiscount = (baseMaxPositionUsd * 60 * progressBps + (100 * 10000 - 1)) / (100 * 10000);
        uint256 maxPos = baseMaxPositionUsd - posDiscount;

        // 5. Funding multiplier rounded UP (ceil)
        uint16 fundingMult = uint16(OPEN_FUNDING_MULT_BPS + (((uint256(CLOSED_FUNDING_MULT_BPS - OPEN_FUNDING_MULT_BPS) * progressBps) + 9999) / 10000));

        return RiskParams({
            phase: Phase.PRE_CLOSE,
            maxLeverageX100: maxLev,
            initialMarginBps: imBps,
            maintenanceMarginBps: mmBps,
            maxOpenInterestUsd: maxOi,
            maxPositionUsd: maxPos,
            fundingMultiplierBps: fundingMult,
            reduceOnly: false, // in PRE_CLOSE, trades are allowed up to the ramped cap
            deleverageTargetX100: DELEVERAGE_TARGET_X100
        });
    }
}
