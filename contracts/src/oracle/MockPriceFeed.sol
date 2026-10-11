// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {IPriceFeed} from "../interfaces/IPriceFeed.sol";
import {IMarketClock} from "../interfaces/IMarketClock.sol";
import {IMarketSchedule, Phase} from "../interfaces/IMarketSchedule.sol";

/// @title MockPriceFeed
/// @notice Deterministic, simulated oracle feed for the Nyxor risk engine demonstration.
///         Price has 8 decimals (e.g. 4150.00 USD = 415_000_000_000).
///         Updates timestamp using IMarketClock.effectiveNow().
///
///         HONESTY LABEL: This is a simulated oracle for hackathon demonstration.
///         It exposes queueShock() and setPrice() to execute predictable weekend gaps.
contract MockPriceFeed is IPriceFeed, AccessControl {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IMarketClock public immutable clock;
    IMarketSchedule public immutable schedule;

    uint256 public price1e8;
    uint256 public updatedAt;

    /// @notice Official price recorded at session close, used to compute reopen gaps and liquidations
    uint256 public lastOfficialClosePrice;
    uint256 public lastCloseTimestamp;

    event PriceUpdated(uint256 newPrice1e8, uint256 updatedAt);
    event ShockApplied(int256 bps, uint256 oldPrice1e8, uint256 newPrice1e8);
    event CloseCheckpointed(uint256 closePrice1e8, uint256 timestamp);

    error PriceZero();
    error NotClosedPhase();
    error InvalidPriceMove();
    error AlreadyCheckpointedForSession();

    constructor(
        address admin,
        address clock_,
        address schedule_,
        uint256 initialPrice1e8
    ) {
        if (initialPrice1e8 == 0) revert PriceZero();
        clock = IMarketClock(clock_);
        schedule = IMarketSchedule(schedule_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(KEEPER_ROLE, admin);

        price1e8 = initialPrice1e8;
        updatedAt = IMarketClock(clock_).effectiveNow();
        lastOfficialClosePrice = initialPrice1e8;
        lastCloseTimestamp = 0; // Uncheckpointed initially

        emit PriceUpdated(initialPrice1e8, updatedAt);
    }

    /// @inheritdoc IPriceFeed
    function latestPrice() external view override returns (uint256, uint256) {
        return (price1e8, updatedAt);
    }

    /// @notice Update price directly
    function setPrice(uint256 newPrice1e8) external {
        _checkRole(KEEPER_ROLE);
        if (newPrice1e8 == 0) revert PriceZero();
        price1e8 = newPrice1e8;
        updatedAt = clock.effectiveNow();

        _updateOfficialCloseIfOpen();
        emit PriceUpdated(newPrice1e8, updatedAt);
    }

    /// @notice Apply a percentage price shock in basis points (+/- bps, 10000 = 100%)
    ///         e.g. -800 = -8.00%
    function queueShock(int256 bps) external {
        _checkRole(KEEPER_ROLE);
        int256 current = int256(price1e8);
        int256 delta = (current * bps) / 10000;
        int256 target = current + delta;
        if (target <= 0) revert InvalidPriceMove();

        uint256 oldPrice = price1e8;
        price1e8 = uint256(target);
        updatedAt = clock.effectiveNow();

        _updateOfficialCloseIfOpen();
        emit ShockApplied(bps, oldPrice, price1e8);
        emit PriceUpdated(price1e8, updatedAt);
    }

    /// @dev Only updates lastOfficialClosePrice if market is actively OPEN or in PRE_CLOSE.
    ///      Once CLOSED, lastOfficialClosePrice remains strictly frozen.
    function _updateOfficialCloseIfOpen() internal {
        (Phase phase,,) = schedule.phaseAt(clock.effectiveNow());
        if (phase == Phase.OPEN || phase == Phase.PRE_CLOSE) {
            lastOfficialClosePrice = price1e8;
            lastCloseTimestamp = clock.effectiveNow();
        }
    }

    /// @notice Permissionless checkpoint of close price once the market enters CLOSED phase.
    ///         Callable once per closed session. Sets timestamp to scheduled session close time.
    function checkpointClose() external {
        (Phase phase,,) = schedule.phaseAt(clock.effectiveNow());
        if (phase != Phase.CLOSED) revert NotClosedPhase();

        uint256 sessionCloseTs = schedule.getPreviousCloseTs(clock.effectiveNow());
        if (sessionCloseTs == lastCloseTimestamp) revert AlreadyCheckpointedForSession();

        lastCloseTimestamp = sessionCloseTs;
        emit CloseCheckpointed(lastOfficialClosePrice, lastCloseTimestamp);
    }

    /// @notice Checks if the current price feed is stale given a maximum allowable age
    function isStale(uint256 maxStaleness) external view returns (bool) {
        uint256 currentTs = clock.effectiveNow();
        if (currentTs < updatedAt) return false;
        return (currentTs - updatedAt) > maxStaleness;
    }
}
