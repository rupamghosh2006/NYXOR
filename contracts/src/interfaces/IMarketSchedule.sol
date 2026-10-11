// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Phase
/// @notice The four market phases that drive risk parameters.
enum Phase {
    OPEN,             // Normal trading, full leverage
    PRE_CLOSE,        // Ramp-down window before close
    CLOSED,           // Reference market is closed; reduce-only
    REOPEN_COOLDOWN   // First N seconds after open; liquidations active, reduce-only
}

/// @title IMarketSchedule
/// @notice Determines which Phase the market is in at a given timestamp.
interface IMarketSchedule {
    /// @param ts  Unix timestamp to evaluate (use MarketClock.now())
    /// @return phase            Current phase
    /// @return secondsToClose   Seconds until the next close (0 when CLOSED)
    /// @return secondsSinceOpen Seconds since the last open (0 when CLOSED)
    function phaseAt(uint256 ts)
        external
        view
        returns (Phase phase, uint256 secondsToClose, uint256 secondsSinceOpen);

    /// @notice Returns the preCloseWindow duration in seconds
    function preCloseWindow() external view returns (uint32);

    /// @notice Returns the reopenCooldown duration in seconds
    function reopenCooldown() external view returns (uint32);

    /// @notice Returns the timestamp of the most recent session close on or before ts
    function getPreviousCloseTs(uint256 ts) external view returns (uint256);
}
