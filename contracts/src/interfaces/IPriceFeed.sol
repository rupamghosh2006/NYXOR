// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPriceFeed
/// @notice Minimal oracle interface. Everything that touches price goes through here
///         so a real feed adapter can replace MockPriceFeed without changing the market.
/// @dev    price1e8 uses 8-decimal fixed-point (e.g. 415_000_000_000 = 4150.00).
interface IPriceFeed {
    /// @return price1e8  Current price with 8 decimal places
    /// @return updatedAt Unix timestamp of the last price update (from IMarketClock.now())
    function latestPrice() external view returns (uint256 price1e8, uint256 updatedAt);

    /// @notice Official price recorded at session close, used during CLOSED phase and reopen gap calculation
    function lastOfficialClosePrice() external view returns (uint256);
}
