// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

import {IPerpMarket} from "../interfaces/IPerpMarket.sol";
import {IRiskPolicy, RiskParams} from "../interfaces/IRiskPolicy.sol";
import {IPriceFeed} from "../interfaces/IPriceFeed.sol";
import {IMarketClock} from "../interfaces/IMarketClock.sol";
import {IMarketSchedule, Phase} from "../interfaces/IMarketSchedule.sol";
import {LiquidityVault} from "../vault/LiquidityVault.sol";

/// @title PerpMarket
/// @notice Isolated-margin perpetual futures market driven by injected IRiskPolicy.
///         Holds trader margin collateral. Settles realized PnL and shortfalls with LiquidityVault.
contract PerpMarket is IPerpMarket, ReentrancyGuard, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    IERC20 public immutable collateralToken;     // 6 decimals (USDx)
    IRiskPolicy public immutable riskPolicy;     // Injected policy (Flat or MarketHours)
    IPriceFeed public immutable priceFeed;       // Oracle feed (8 decimals)
    IMarketClock public immutable clock;         // Effective timestamp provider
    IMarketSchedule public immutable schedule;   // Market session schedule
    LiquidityVault public immutable vault;       // Counterparty vault

    // Configuration constants (basis points, 1e4 = 100%)
    uint16 public constant TAKER_FEE_BPS = 6;                // 0.06%
    uint16 public constant LIQUIDATION_PENALTY_BPS = 100;    // 1.00%
    uint16 public constant KEEPER_REWARD_BPS = 50;           // 0.50% (half of penalty)
    uint16 public constant INSURANCE_PENALTY_BPS = 50;       // 0.50% (half of penalty)
    uint16 public constant INSURANCE_FEE_SHARE_BPS = 2000;   // 20% of taker fee to insurance
    uint256 public constant DELEVERAGE_WINDOW = 600;         // Final 10 minutes of PRE_CLOSE

    // Funding constants per AGENTS.md §8.4
    int256 public constant K_BPS = 10;                       // Slope constant k
    int256 public constant MAX_FUNDING_RATE_PER_HOUR_BPS = 25;// Clamp at ±0.25% per hour

    uint256 public maxStaleness = 300; // 5 minutes max price staleness

    // Funding state (1e18 precision cumulative rates)
    int256 public cumulativeFundingRateLong;
    int256 public cumulativeFundingRateShort;
    uint256 public lastFundingSettledAt;

    // Positions mapping
    mapping(address => Position) public positions;

    // Market aggregates (6 decimals)
    uint256 public totalOiLongUsd;
    uint256 public totalOiShortUsd;

    // Errors
    error PositionAlreadyActive();
    error NoActivePosition();
    error StalePrice();
    error ReduceOnlyMode();
    error ExcessiveLeverage(uint16 requested, uint16 maxAllowed);
    error InsufficientCollateral();
    error ExceedsMaxOpenInterest(uint256 requested, uint256 maxAllowed);
    error ExceedsMaxPosition(uint256 requested, uint256 maxAllowed);
    error PositionHealthy();
    error NotDeleverageWindow();
    error PositionAlreadyWithinCap();
    error ZeroAmount();

    constructor(
        address admin,
        address collateralToken_,
        address riskPolicy_,
        address priceFeed_,
        address clock_,
        address schedule_,
        address payable vault_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(KEEPER_ROLE, admin);

        collateralToken = IERC20(collateralToken_);
        riskPolicy = IRiskPolicy(riskPolicy_);
        priceFeed = IPriceFeed(priceFeed_);
        clock = IMarketClock(clock_);
        schedule = IMarketSchedule(schedule_);
        vault = LiquidityVault(vault_);
        lastFundingSettledAt = IMarketClock(clock_).effectiveNow();
    }

    function setMaxStaleness(uint256 staleness) external onlyRole(ADMIN_ROLE) {
        maxStaleness = staleness;
    }

    /// @inheritdoc IPerpMarket
    /// @dev Charges taker fee on top of margin so effective leverage strictly matches leverageX100
    ///      and never exceeds the policy cap.
    function openPosition(bool isLong, uint256 margin, uint16 leverageX100) external override nonReentrant {
        if (positions[msg.sender].active) revert PositionAlreadyActive();
        if (margin == 0) revert ZeroAmount();

        settleFunding();

        uint256 currentTs = clock.effectiveNow();
        (Phase phase,,) = schedule.phaseAt(currentTs);
        uint256 currentPrice = _getExecutionPrice(phase);

        RiskParams memory params = riskPolicy.getParams(currentTs);
        if (params.reduceOnly) revert ReduceOnlyMode();
        if (leverageX100 > params.maxLeverageX100) revert ExcessiveLeverage(leverageX100, params.maxLeverageX100);

        // size = margin * leverageX100 / 100
        uint256 sizeUsd = (margin * leverageX100) / 100;
        if (sizeUsd > params.maxPositionUsd) revert ExceedsMaxPosition(sizeUsd, params.maxPositionUsd);

        if (isLong) {
            if (totalOiLongUsd + sizeUsd > params.maxOpenInterestUsd) {
                revert ExceedsMaxOpenInterest(totalOiLongUsd + sizeUsd, params.maxOpenInterestUsd);
            }
            totalOiLongUsd += sizeUsd;
        } else {
            if (totalOiShortUsd + sizeUsd > params.maxOpenInterestUsd) {
                revert ExceedsMaxOpenInterest(totalOiShortUsd + sizeUsd, params.maxOpenInterestUsd);
            }
            totalOiShortUsd += sizeUsd;
        }

        // Taker fee on open charged on top of margin
        uint256 openFee = (sizeUsd * TAKER_FEE_BPS) / 10000;
        uint256 totalRequired = margin + openFee;

        // Transfer margin + fee from trader
        collateralToken.safeTransferFrom(msg.sender, address(this), totalRequired);

        // Send open fee to vault
        collateralToken.forceApprove(address(vault), openFee);
        vault.receiveFee(openFee, INSURANCE_FEE_SHARE_BPS);

        int256 initialFundingIndex = isLong ? cumulativeFundingRateLong : cumulativeFundingRateShort;

        positions[msg.sender] = Position({
            active: true,
            isLong: isLong,
            sizeUsd: sizeUsd,
            collateral: margin, // Full margin preserved in position
            entryPrice: currentPrice,
            fundingIndexSnapshot: initialFundingIndex,
            openedAt: currentTs
        });

        _syncVaultLockedExposure();
        emit PositionOpened(msg.sender, isLong, sizeUsd, margin, currentPrice, leverageX100);
    }

    /// @inheritdoc IPerpMarket
    /// @dev Closes position. In CLOSED phase, executes against lastOfficialClosePrice so traders are never trapped.
    function closePosition() external override nonReentrant {
        Position memory pos = positions[msg.sender];
        if (!pos.active) revert NoActivePosition();

        settleFunding();

        (Phase phase,,) = schedule.phaseAt(clock.effectiveNow());
        uint256 currentPrice = _getExecutionPrice(phase);

        int256 pnl = _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
        int256 fundingPaid = _calculateAccruedFunding(pos);

        uint256 closeFee = (pos.sizeUsd * TAKER_FEE_BPS) / 10000;

        if (pos.isLong) {
            totalOiLongUsd -= pos.sizeUsd;
        } else {
            totalOiShortUsd -= pos.sizeUsd;
        }
        delete positions[msg.sender];
        _syncVaultLockedExposure();

        // Net PnL realized against the vault: trader profit/loss after funding
        int256 netPnlToVault = pnl - fundingPaid;

        if (netPnlToVault > 0) {
            vault.settleTraderPnl(netPnlToVault);
        } else if (netPnlToVault < 0) {
            uint256 loss = uint256(-netPnlToVault);
            if (loss > pos.collateral) {
                loss = pos.collateral;
            }
            collateralToken.forceApprove(address(vault), loss);
            vault.settleTraderPnl(-int256(loss));
        }

        // Available balance for trader from their collateral + pnl
        int256 netEquity = int256(pos.collateral) + pnl - fundingPaid;
        uint256 available = netEquity > 0 ? uint256(netEquity) : 0;
        uint256 actualFee = closeFee > available ? available : closeFee;
        uint256 payout = available - actualFee;

        if (actualFee > 0) {
            collateralToken.forceApprove(address(vault), actualFee);
            vault.receiveFee(actualFee, INSURANCE_FEE_SHARE_BPS);
        }

        if (payout > 0) {
            collateralToken.safeTransfer(msg.sender, payout);
        }

        emit PositionClosed(msg.sender, currentPrice, pnl, payout);
    }

    /// @inheritdoc IPerpMarket
    function addMargin(uint256 amount) external override nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Position storage pos = positions[msg.sender];
        if (!pos.active) revert NoActivePosition();

        pos.collateral += amount;
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        emit MarginAdded(msg.sender, amount, pos.collateral);
    }

    /// @inheritdoc IPerpMarket
    function removeMargin(uint256 amount) external override nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Position storage pos = positions[msg.sender];
        if (!pos.active) revert NoActivePosition();
        if (amount >= pos.collateral) revert InsufficientCollateral();

        settleFunding();

        uint256 currentTs = clock.effectiveNow();
        (Phase phase,,) = schedule.phaseAt(currentTs);
        uint256 currentPrice = _getExecutionPrice(phase);

        RiskParams memory params = riskPolicy.getParams(currentTs);
        uint256 remainingCollateral = pos.collateral - amount;

        int256 pnl = _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
        int256 fundingPaid = _calculateAccruedFunding(pos);
        int256 equity = int256(remainingCollateral) + pnl - fundingPaid;
        if (equity <= 0) revert InsufficientCollateral();

        // Must still satisfy IM at current policy params
        uint256 requiredIm = (pos.sizeUsd * params.initialMarginBps) / 10000;
        if (uint256(equity) < requiredIm) revert InsufficientCollateral();

        pos.collateral = remainingCollateral;
        collateralToken.safeTransfer(msg.sender, amount);
        emit MarginRemoved(msg.sender, amount, pos.collateral);
    }

    /// @inheritdoc IPerpMarket
    /// @dev Permissionless liquidation. In CLOSED phase, uses official close price against 6% MM.
    function liquidate(address trader) external override nonReentrant {
        Position memory pos = positions[trader];
        if (!pos.active) revert NoActivePosition();

        settleFunding();

        uint256 currentPrice;
        int256 equity;
        {
            uint256 currentTs = clock.effectiveNow();
            (Phase phase,,) = schedule.phaseAt(currentTs);
            currentPrice = _getExecutionPrice(phase);

            RiskParams memory params = riskPolicy.getParams(currentTs);
            int256 pnl = _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
            int256 fundingPaid = _calculateAccruedFunding(pos);
            equity = int256(pos.collateral) + pnl - fundingPaid;

            uint256 mmUsd = (pos.sizeUsd * params.maintenanceMarginBps) / 10000;
            if (equity >= int256(mmUsd)) revert PositionHealthy();
        }

        // Position is liquidatable
        if (pos.isLong) {
            totalOiLongUsd -= pos.sizeUsd;
        } else {
            totalOiShortUsd -= pos.sizeUsd;
        }
        delete positions[trader];
        _syncVaultLockedExposure();

        uint256 keeperReward = (pos.sizeUsd * KEEPER_REWARD_BPS) / 10000;
        uint256 insuranceContrib = (pos.sizeUsd * INSURANCE_PENALTY_BPS) / 10000;

        uint256 shortfall = _settleLiquidation(trader, pos, equity, keeperReward, insuranceContrib);

        emit Liquidated(trader, msg.sender, currentPrice, equity, shortfall);
    }

    function _settleLiquidation(
        address trader,
        Position memory pos,
        int256 equity,
        uint256 keeperReward,
        uint256 insuranceContrib
    ) internal returns (uint256 shortfall) {
        if (equity <= 0) {
            uint256 deficit = uint256(-equity);
            shortfall = deficit;

            if (pos.collateral > 0) {
                collateralToken.forceApprove(address(vault), pos.collateral);
                vault.settleTraderPnl(-int256(pos.collateral));
            }

            vault.recordBadDebt(trader, deficit);
            vault.payKeeperReward(msg.sender, keeperReward);
        } else {
            uint256 remainingEquity = uint256(equity);
            uint256 traderLoss = pos.collateral > remainingEquity ? pos.collateral - remainingEquity : 0;
            if (traderLoss > 0) {
                collateralToken.forceApprove(address(vault), traderLoss);
                vault.settleTraderPnl(-int256(traderLoss));
            }

            uint256 penalty = keeperReward + insuranceContrib;
            if (remainingEquity >= penalty) {
                collateralToken.safeTransfer(msg.sender, keeperReward);
                collateralToken.forceApprove(address(vault), insuranceContrib);
                vault.receiveInsuranceFundContribution(insuranceContrib);

                uint256 refund = remainingEquity - penalty;
                if (refund > 0) {
                    collateralToken.safeTransfer(trader, refund);
                }
            } else if (remainingEquity >= keeperReward) {
                collateralToken.safeTransfer(msg.sender, keeperReward);
                uint256 toInsurance = remainingEquity - keeperReward;
                if (toInsurance > 0) {
                    collateralToken.forceApprove(address(vault), toInsurance);
                    vault.receiveInsuranceFundContribution(toInsurance);
                }
            } else {
                if (remainingEquity > 0) {
                    collateralToken.safeTransfer(msg.sender, remainingEquity);
                }
                vault.payKeeperReward(msg.sender, keeperReward - remainingEquity);
            }
        }
    }

    /// @inheritdoc IPerpMarket
    /// @notice Deleveraging callable in PRE_CLOSE within DELEVERAGE_WINDOW (600s) at open-market price
    function deleverageToCap(address trader) external override nonReentrant {
        Position storage pos = positions[trader];
        if (!pos.active) revert NoActivePosition();

        uint256 currentTs = clock.effectiveNow();
        {
            (Phase phase, uint256 toClose,) = schedule.phaseAt(currentTs);
            if (phase != Phase.PRE_CLOSE || toClose > DELEVERAGE_WINDOW) revert NotDeleverageWindow();
        }

        settleFunding();

        uint256 currentPrice;
        {
            (uint256 p, uint256 priceTs) = priceFeed.latestPrice();
            if (currentTs > priceTs && (currentTs - priceTs) > maxStaleness) revert StalePrice();
            currentPrice = p;
        }

        RiskParams memory params = riskPolicy.getParams(currentTs);
        int256 pnl = _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
        int256 fundingPaid = _calculateAccruedFunding(pos);
        int256 equity = int256(pos.collateral) + pnl - fundingPaid;
        if (equity <= 0) revert InsufficientCollateral();

        uint256 currentLeverageX100 = (pos.sizeUsd * 100) / uint256(equity);
        if (currentLeverageX100 <= params.deleverageTargetX100) revert PositionAlreadyWithinCap();

        uint256 oldSizeUsd = pos.sizeUsd;
        uint256 targetSizeUsd = (uint256(equity) * params.deleverageTargetX100) / 100;
        uint256 reducedSizeUsd = oldSizeUsd - targetSizeUsd;

        int256 reducedPnl = (pnl * int256(reducedSizeUsd)) / int256(oldSizeUsd);
        if (pos.isLong) {
            totalOiLongUsd -= reducedSizeUsd;
        } else {
            totalOiShortUsd -= reducedSizeUsd;
        }

        pos.sizeUsd = targetSizeUsd;
        _applyDeleverageSettle(pos, reducedPnl, fundingPaid);

        _syncVaultLockedExposure();
        emit Deleveraged(trader, oldSizeUsd, targetSizeUsd, params.deleverageTargetX100);
    }

    function _applyDeleverageSettle(Position storage pos, int256 reducedPnl, int256 fundingPaid) internal {
        if (reducedPnl > 0) {
            vault.settleTraderPnl(reducedPnl);
            pos.collateral += uint256(reducedPnl);
        } else if (reducedPnl < 0) {
            uint256 loss = uint256(-reducedPnl);
            pos.collateral = pos.collateral > loss ? pos.collateral - loss : 0;
            collateralToken.forceApprove(address(vault), loss);
            vault.settleTraderPnl(-int256(loss));
        }

        if (fundingPaid > 0) {
            uint256 fp = uint256(fundingPaid);
            pos.collateral = pos.collateral > fp ? pos.collateral - fp : 0;
            collateralToken.forceApprove(address(vault), fp);
            vault.settleTraderPnl(-int256(fp));
        } else if (fundingPaid < 0) {
            uint256 fg = uint256(-fundingPaid);
            vault.settleTraderPnl(int256(fg));
            pos.collateral += fg;
        }

        pos.fundingIndexSnapshot = pos.isLong ? cumulativeFundingRateLong : cumulativeFundingRateShort;
    }

    /// @inheritdoc IPerpMarket
    /// @dev Updates cumulative funding rates according to market skew and policy fundingMultiplier
    function settleFunding() public override {
        uint256 currentTs = clock.effectiveNow();
        if (currentTs <= lastFundingSettledAt) return;

        uint256 elapsed = currentTs - lastFundingSettledAt;
        lastFundingSettledAt = currentTs;

        RiskParams memory params = riskPolicy.getParams(currentTs);
        if (params.maxOpenInterestUsd == 0) return;

        int256 netSkewUsd = int256(totalOiLongUsd) - int256(totalOiShortUsd);
        // skew in bps: (netSkew * 10000) / maxOI
        int256 skewBps = (netSkewUsd * 10000) / int256(params.maxOpenInterestUsd);

        // raw rate per hour in 1e18: (skewBps * K_BPS * 1e18) / 100_000_000
        int256 rawRatePerHour1e18 = (skewBps * K_BPS * 1e18) / 100_000_000;

        // clamp raw rate to ±MAX_FUNDING_RATE_PER_HOUR_BPS (25 bps / hr)
        int256 maxRate1e18 = (MAX_FUNDING_RATE_PER_HOUR_BPS * 1e18) / 10000;
        if (rawRatePerHour1e18 > maxRate1e18) {
            rawRatePerHour1e18 = maxRate1e18;
        } else if (rawRatePerHour1e18 < -maxRate1e18) {
            rawRatePerHour1e18 = -maxRate1e18;
        }

        // rate * fundingMultiplier
        int256 ratePerHour1e18 = (rawRatePerHour1e18 * int256(uint256(params.fundingMultiplierBps))) / 10000;

        // Convert to 1e18 rate delta for elapsed seconds: (ratePerHour1e18 * elapsed) / 3600
        int256 rateDelta1e18 = (ratePerHour1e18 * int256(elapsed)) / 3600;

        cumulativeFundingRateLong += rateDelta1e18;
        cumulativeFundingRateShort -= rateDelta1e18;

        int256 ratePerHourBps = (ratePerHour1e18 * 10000) / 1e18;
        emit FundingSettled(ratePerHourBps, cumulativeFundingRateLong);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function getPosition(address trader) external view override returns (Position memory) {
        return positions[trader];
    }

    function getEquity(address trader) external view override returns (int256) {
        Position memory pos = positions[trader];
        if (!pos.active) return 0;
        (Phase phase,,) = schedule.phaseAt(clock.effectiveNow());
        uint256 currentPrice = _getExecutionPrice(phase);
        int256 pnl = _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
        int256 fundingPaid = _calculateAccruedFunding(pos);
        return int256(pos.collateral) + pnl - fundingPaid;
    }

    function getLeverage(address trader) external view override returns (uint16) {
        Position memory pos = positions[trader];
        if (!pos.active) return 0;
        (Phase phase,,) = schedule.phaseAt(clock.effectiveNow());
        uint256 currentPrice = _getExecutionPrice(phase);
        int256 pnl = _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
        int256 fundingPaid = _calculateAccruedFunding(pos);
        int256 equity = int256(pos.collateral) + pnl - fundingPaid;
        if (equity <= 0) return type(uint16).max;
        return uint16((pos.sizeUsd * 100) / uint256(equity));
    }

    function getLiquidationPrice(address trader) external view override returns (uint256) {
        Position memory pos = positions[trader];
        if (!pos.active) return 0;
        RiskParams memory params = riskPolicy.getParams(clock.effectiveNow());
        uint256 mmUsd = (pos.sizeUsd * params.maintenanceMarginBps) / 10000;

        if (pos.isLong) {
            if (pos.collateral <= mmUsd) return pos.entryPrice;
            uint256 buffer = pos.collateral - mmUsd;
            uint256 priceDrop = (pos.entryPrice * buffer) / pos.sizeUsd;
            return pos.entryPrice > priceDrop ? pos.entryPrice - priceDrop : 0;
        } else {
            if (pos.collateral <= mmUsd) return pos.entryPrice;
            uint256 buffer = pos.collateral - mmUsd;
            uint256 priceRise = (pos.entryPrice * buffer) / pos.sizeUsd;
            return pos.entryPrice + priceRise;
        }
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

    /// @dev Retrieves valid execution price. During CLOSED, uses frozen lastOfficialClosePrice.
    function _getExecutionPrice(Phase phase) internal view returns (uint256 price) {
        if (phase == Phase.CLOSED) {
            price = priceFeed.lastOfficialClosePrice();
            if (price == 0) revert StalePrice();
        } else {
            uint256 currentTs = clock.effectiveNow();
            (uint256 latest, uint256 priceTs) = priceFeed.latestPrice();
            if (currentTs > priceTs && (currentTs - priceTs) > maxStaleness) revert StalePrice();
            price = latest;
        }
    }

    function _calculatePnl(bool isLong, uint256 sizeUsd, uint256 entryPrice, uint256 currentPrice) internal pure returns (int256) {
        if (isLong) {
            if (currentPrice >= entryPrice) {
                return int256((sizeUsd * (currentPrice - entryPrice)) / entryPrice);
            } else {
                return -int256((sizeUsd * (entryPrice - currentPrice)) / entryPrice);
            }
        } else {
            if (entryPrice >= currentPrice) {
                return int256((sizeUsd * (entryPrice - currentPrice)) / entryPrice);
            } else {
                return -int256((sizeUsd * (currentPrice - entryPrice)) / entryPrice);
            }
        }
    }

    function _calculateAccruedFunding(Position memory pos) internal view returns (int256) {
        int256 currentIndex = pos.isLong ? cumulativeFundingRateLong : cumulativeFundingRateShort;
        return (int256(pos.sizeUsd) * (currentIndex - pos.fundingIndexSnapshot)) / 1e18;
    }

    function _syncVaultLockedExposure() internal {
        uint256 netExposure = totalOiLongUsd > totalOiShortUsd ? totalOiLongUsd - totalOiShortUsd : totalOiShortUsd - totalOiLongUsd;
        vault.setLockedExposure(netExposure);
    }
}
