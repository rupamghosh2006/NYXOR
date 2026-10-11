// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {IMarketClock} from "../interfaces/IMarketClock.sol";

/// @title MarketClock
/// @notice Provides the effective current timestamp for the Nyxor risk engine.
///
/// @dev    In normal operation `effectiveNow()` returns `block.timestamp`.
///         When `demoMode` is true (set at construction time and immutable),
///         an admin can shift the effective time forward or backward so that
///         the demo console can time-travel through market phases without
///         waiting for real time to pass.
///
///         SECURITY: `setDemoOffset` and `advance` revert when `demoMode` is
///         false, so these functions are dead code on a production deploy.
///
///         UI must display a persistent "SIMULATED CLOCK" banner whenever
///         `demoMode() == true`.
contract MarketClock is IMarketClock, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice When true, time-travel functions are enabled.
    ///         Set at deployment and never changed — immutable behaviour enforced
    ///         by a runtime guard rather than the `immutable` keyword so the
    ///         value can be read from the interface.
    bool private immutable _demoMode;

    /// @notice Additive offset applied to block.timestamp (seconds, may be negative).
    ///         Only meaningful when demoMode is true.
    int256 public demoOffset;

    // ─── Events ──────────────────────────────────────────────────────────────
    event DemoModeEnabled(bool enabled);
    event DemoOffsetSet(int256 offset, uint256 effectiveNow_);
    event DemoAdvanced(uint256 seconds_, uint256 effectiveNow_);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error DemoModeNotEnabled();
    error AdvanceZero();

    // ─── Constructor ─────────────────────────────────────────────────────────
    constructor(address admin, bool demoMode_) {
        _demoMode = demoMode_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        emit DemoModeEnabled(demoMode_);
    }

    // ─── IMarketClock ─────────────────────────────────────────────────────────

    /// @inheritdoc IMarketClock
    function effectiveNow() external view override returns (uint256) {
        return _effectiveNow();
    }

    /// @inheritdoc IMarketClock
    function demoMode() external view override returns (bool) {
        return _demoMode;
    }

    // ─── Admin: demo time-travel ──────────────────────────────────────────────

    /// @notice Set the absolute demo offset (positive or negative seconds).
    /// @dev    Reverts when demoMode is false to prevent accidental time manipulation
    ///         on a production deployment.
    function setDemoOffset(int256 offset) external onlyRole(ADMIN_ROLE) {
        if (!_demoMode) revert DemoModeNotEnabled();
        demoOffset = offset;
        emit DemoOffsetSet(offset, _effectiveNow());
    }

    /// @notice Advance the simulated clock by `seconds_` seconds.
    /// @dev    Equivalent to setDemoOffset(demoOffset + seconds_).
    ///         Only call from the demo console.
    function advance(uint256 seconds_) external onlyRole(ADMIN_ROLE) {
        if (!_demoMode) revert DemoModeNotEnabled();
        if (seconds_ == 0) revert AdvanceZero();
        // casting to int256 is safe: seconds_ is bounded to realistic demo values
        // (the demo UI won't pass values anywhere near int256 overflow)
        // forge-lint: disable-next-line(unsafe-typecast)
        demoOffset += int256(seconds_);
        emit DemoAdvanced(seconds_, _effectiveNow());
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _effectiveNow() internal view returns (uint256) {
        // Casting block.timestamp to int256: block.timestamp fits in int256
        // for all practical blockchain timestamps (max ~year 2554 for int256).
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 t = int256(block.timestamp) + demoOffset;
        // t > 0 guard handles the theoretical case where a huge negative offset
        // is set; casting a positive int256 to uint256 is always safe.
        // forge-lint: disable-next-line(unsafe-typecast)
        return t > 0 ? uint256(t) : 0;
    }
}
