// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {IMarketSchedule, Phase} from "../interfaces/IMarketSchedule.sol";
import {IMarketClock} from "../interfaces/IMarketClock.sol";

/// @title MarketSchedule
/// @notice Determines which Phase a market is in at any given timestamp.
///
/// @dev SCHEDULE MODEL
///      The week is modelled as seconds-since-start-of-Monday-UTC.
///      Each weekday (0 = Monday … 4 = Friday) has an openSecondsUTC and
///      closeSecondsUTC measured from 00:00 UTC of that day.
///      Days 5–6 (Saturday, Sunday) are always CLOSED.
///
///      Default session (US equity proxy): 14:30–21:00 UTC Mon–Fri.
///      preCloseWindow = 3600 s (1 hour) → PRE_CLOSE from 20:00.
///      reopenCooldown = 900 s  (15 min) → REOPEN_COOLDOWN from 14:30.
///
/// DST LIMITATION: schedule is fixed UTC. Real deployments need a
/// maintained calendar or a DST-aware keeper. Documented in LIMITATIONS.md.
///
/// @dev HOLIDAY SUPPORT
///      Holidays are stored as (year, month, day) packed into a uint32
///      (year*10000 + month*100 + day).  The admin can add/remove them.
///      When a day is a holiday the phase is CLOSED all day.
contract MarketSchedule is IMarketSchedule, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ─── Session config ───────────────────────────────────────────────────────

    struct DaySession {
        bool    tradingDay;       // false for always-CLOSED days
        uint32  openSecondsUTC;   // seconds from 00:00 UTC of that weekday
        uint32  closeSecondsUTC;  // seconds from 00:00 UTC of that weekday
    }

    /// @notice Sessions indexed by weekday: 0 = Monday … 6 = Sunday
    DaySession[7] public sessions;

    /// @notice Seconds before the session close in which PRE_CLOSE begins
    uint32 public preCloseWindow;

    /// @notice Seconds after the session open in which REOPEN_COOLDOWN applies
    uint32 public reopenCooldown;

    // ─── Holidays ─────────────────────────────────────────────────────────────

    /// @dev Set of packed date keys: year * 10000 + month * 100 + day
    mapping(uint32 => bool) public holidays;

    // ─── Events ───────────────────────────────────────────────────────────────
    event SessionUpdated(uint8 weekday, bool tradingDay, uint32 openS, uint32 closeS);
    event WindowsUpdated(uint32 preCloseWindow, uint32 reopenCooldown);
    event HolidayAdded(uint32 packed);
    event HolidayRemoved(uint32 packed);

    // ─── Errors ───────────────────────────────────────────────────────────────
    error InvalidWeekday(uint8 weekday);
    error InvalidSession(uint32 open, uint32 close);
    error InvalidWindow();

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @param admin             Address that may update the schedule
    /// @param preCloseWindow_   Seconds before close to enter PRE_CLOSE (default 3600)
    /// @param reopenCooldown_   Seconds after open to stay in REOPEN_COOLDOWN (default 900)
    constructor(address admin, uint32 preCloseWindow_, uint32 reopenCooldown_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);

        preCloseWindow = preCloseWindow_;
        reopenCooldown = reopenCooldown_;

        // Default: Mon–Fri 14:30–21:00 UTC
        // 14:30 UTC = 14*3600 + 30*60 = 52200 s
        // 21:00 UTC = 21*3600          = 75600 s
        uint32 open_  = 52_200;
        uint32 close_ = 75_600;
        for (uint8 d = 0; d < 5; d++) {          // Mon–Fri
            sessions[d] = DaySession(true, open_, close_);
        }
        // Sat & Sun — non-trading (values don't matter when tradingDay = false)
        sessions[5] = DaySession(false, 0, 0);
        sessions[6] = DaySession(false, 0, 0);

        emit WindowsUpdated(preCloseWindow_, reopenCooldown_);
    }

    // ─── IMarketSchedule ──────────────────────────────────────────────────────

    /// @inheritdoc IMarketSchedule
    /// @dev Gas note: pure date arithmetic, no storage reads except `sessions`,
    ///      `preCloseWindow`, `reopenCooldown`, and the holiday mapping.
    function phaseAt(uint256 ts)
        external
        view
        override
        returns (Phase phase, uint256 secondsToClose, uint256 secondsSinceOpen)
    {
        // 1. Convert timestamp to (weekday, secondsInDay, packed date for holiday check)
        (uint8 weekday, uint32 secInDay, uint32 packedDate) = _decomposeTs(ts);

        // 2. Holiday check first — entire day is CLOSED
        if (holidays[packedDate]) {
            return (Phase.CLOSED, 0, 0);
        }

        DaySession memory sess = sessions[weekday];

        // 3. Non-trading day
        if (!sess.tradingDay) {
            return (Phase.CLOSED, 0, 0);
        }

        // 4. Before open
        if (secInDay < sess.openSecondsUTC) {
            return (Phase.CLOSED, 0, 0);
        }

        // 5. After close
        if (secInDay >= sess.closeSecondsUTC) {
            return (Phase.CLOSED, 0, 0);
        }

        // secInDay is within [open, close)
        uint32 sinceOpen = secInDay - sess.openSecondsUTC;
        uint32 toClose   = sess.closeSecondsUTC - secInDay;

        // 6. REOPEN_COOLDOWN: first `reopenCooldown` seconds of the session
        if (sinceOpen < reopenCooldown) {
            return (Phase.REOPEN_COOLDOWN, toClose, sinceOpen);
        }

        // 7. PRE_CLOSE: last `preCloseWindow` seconds before close
        if (toClose <= preCloseWindow) {
            return (Phase.PRE_CLOSE, toClose, sinceOpen);
        }

        // 8. OPEN
        return (Phase.OPEN, toClose, sinceOpen);
    }

    /// @inheritdoc IMarketSchedule
    function getPreviousCloseTs(uint256 ts) external view override returns (uint256) {
        uint256 daysSinceEpoch = ts / 86_400;
        uint32 secInDay = uint32(ts % 86_400);

        for (uint256 lookback = 0; lookback < 7; lookback++) {
            uint256 currentDay = daysSinceEpoch - lookback;
            uint8 wday = uint8((currentDay + 3) % 7);
            uint32 packedDate = _dayToPackedDate(currentDay);

            if (!holidays[packedDate] && sessions[wday].tradingDay) {
                // If checking today (lookback == 0), session close must have occurred on or before ts
                if (lookback == 0) {
                    if (secInDay >= sessions[wday].closeSecondsUTC) {
                        return currentDay * 86_400 + sessions[wday].closeSecondsUTC;
                    }
                } else {
                    return currentDay * 86_400 + sessions[wday].closeSecondsUTC;
                }
            }
        }
        return 0;
    }

    // ─── Admin functions ──────────────────────────────────────────────────────

    function setSession(
        uint8  weekday,
        bool   tradingDay,
        uint32 openSecondsUTC,
        uint32 closeSecondsUTC
    ) external onlyRole(ADMIN_ROLE) {
        if (weekday > 6) revert InvalidWeekday(weekday);
        if (tradingDay && openSecondsUTC >= closeSecondsUTC) {
            revert InvalidSession(openSecondsUTC, closeSecondsUTC);
        }
        sessions[weekday] = DaySession(tradingDay, openSecondsUTC, closeSecondsUTC);
        emit SessionUpdated(weekday, tradingDay, openSecondsUTC, closeSecondsUTC);
    }

    function setWindows(uint32 preCloseWindow_, uint32 reopenCooldown_) external onlyRole(ADMIN_ROLE) {
        if (preCloseWindow_ == 0 || reopenCooldown_ == 0) revert InvalidWindow();
        preCloseWindow = preCloseWindow_;
        reopenCooldown = reopenCooldown_;
        emit WindowsUpdated(preCloseWindow_, reopenCooldown_);
    }

    function addHoliday(uint16 year, uint8 month, uint8 day) external onlyRole(ADMIN_ROLE) {
        uint32 packed = _pack(year, month, day);
        holidays[packed] = true;
        emit HolidayAdded(packed);
    }

    function removeHoliday(uint16 year, uint8 month, uint8 day) external onlyRole(ADMIN_ROLE) {
        uint32 packed = _pack(year, month, day);
        holidays[packed] = false;
        emit HolidayRemoved(packed);
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    /// @dev Returns (weekday 0–6, secondsIntoDay, packed YYYYMMDD) for a Unix ts.
    ///      Unix epoch (1970-01-01) was a Thursday, so weekday = (ts/86400 + 3) % 7.
    ///      The +3 makes Monday = 0, ..., Sunday = 6.
    function _decomposeTs(uint256 ts)
        internal
        pure
        returns (uint8 weekday, uint32 secInDay, uint32 packedDate)
    {
        uint256 daysSinceEpoch = ts / 86_400;
        // ts % 86400 is in [0,86399] — fits uint32 safely
        // forge-lint: disable-next-line(unsafe-typecast)
        secInDay = uint32(ts % 86_400);
        // (n+3)%7 is in [0,6] — fits uint8 safely
        // forge-lint: disable-next-line(unsafe-typecast)
        weekday = uint8((daysSinceEpoch + 3) % 7);
        packedDate = _dayToPackedDate(daysSinceEpoch);
    }

    /// @dev Converts days-since-epoch to a packed uint32 YYYYMMDD.
    ///      Uses the Proleptic Gregorian Calendar algorithm from:
    ///      https://howardhinnant.github.io/date_algorithms.html#civil_from_days
    ///      (civil_from_days, public domain)
    ///      The div-before-mul patterns below are intentional; they implement
    ///      the standard Gregorian algorithm exactly.
    // forge-lint: disable(divide-before-multiply)
    function _dayToPackedDate(uint256 z) internal pure returns (uint32) {
        z += 719_468;
        uint256 era   = z / 146_097;
        uint256 doe   = z - era * 146_097;
        uint256 yoe   = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 y     = yoe + era * 400;
        uint256 doy   = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp    = (5 * doy + 2) / 153;
        uint256 d     = doy - (153 * mp + 2) / 5 + 1;
        uint256 m     = mp < 10 ? mp + 3 : mp - 9;
        if (m <= 2) y++;
        // max value: 9999*10000+12*100+31 = 100_001_231 < 2^32 — safe
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint32(y * 10_000 + m * 100 + d);
    }

    function _pack(uint16 year, uint8 month, uint8 day) internal pure returns (uint32) {
        return uint32(year) * 10_000 + uint32(month) * 100 + uint32(day);
    }
}
