// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IMarketClock
/// @notice Returns a time value that can be offset in demo mode for time-travel.
///         In production, `now()` would simply return block.timestamp.
interface IMarketClock {
    /// @notice Returns the effective current timestamp.
    ///         In demo mode this equals block.timestamp + demoOffset.
    function effectiveNow() external view returns (uint256);

    /// @notice Returns true when demo time-travel is enabled.
    function demoMode() external view returns (bool);
}
