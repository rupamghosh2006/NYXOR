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

    uint256 public maxStaleness = 300; // 5 minutes max price staleness

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
    error ExceedsMaxOpenInterest();
    error ExceedsMaxPosition();
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
    }

    function setMaxStaleness(uint256 staleness) external onlyRole(ADMIN_ROLE) {
        maxStaleness = staleness;
    }

    /// @inheritdoc IPerpMarket
    function openPosition(bool isLong, uint256 collateral, uint16 leverageX100) external override nonReentrant {
        if (positions[msg.sender].active) revert PositionAlreadyActive();
        if (collateral == 0) revert ZeroAmount();

        uint256 currentTs = clock.effectiveNow();
        (uint256 price1e8, uint256 priceTs) = priceFeed.latestPrice();
        if (currentTs > priceTs && (currentTs - priceTs) > maxStaleness) revert StalePrice();

        RiskParams memory params = riskPolicy.getParams(currentTs);
        if (params.reduceOnly) revert ReduceOnlyMode();
        if (leverageX100 > params.maxLeverageX100) revert ExcessiveLeverage(leverageX100, params.maxLeverageX100);

        // notional = collateral * leverageX100 / 100
        uint256 sizeUsd = (collateral * leverageX100) / 100;
        if (sizeUsd > params.maxPositionUsd) revert ExceedsMaxPosition();

        if (isLong) {
            if (totalOiLongUsd + sizeUsd > params.maxOpenInterestUsd) revert ExceedsMaxOpenInterest();
            totalOiLongUsd += sizeUsd;
        } else {
            if (totalOiShortUsd + sizeUsd > params.maxOpenInterestUsd) revert ExceedsMaxOpenInterest();
            totalOiShortUsd += sizeUsd;
        }

        // Taker fee on open: 6 bps of notional
        uint256 openFee = (sizeUsd * TAKER_FEE_BPS) / 10000;
        if (openFee >= collateral) revert InsufficientCollateral();
        uint256 netCollateral = collateral - openFee;

        // Verify deposited collateral meets initial margin: collateral >= sizeUsd * initialMarginBps / 10000
        if (collateral < (sizeUsd * params.initialMarginBps) / 10000) revert InsufficientCollateral();
        // Verify net collateral after fee remains safely above maintenance margin
        if (netCollateral < (sizeUsd * params.maintenanceMarginBps) / 10000) revert InsufficientCollateral();

        // Transfer collateral from trader: collateral stays in this contract, fee is sent to vault
        collateralToken.safeTransferFrom(msg.sender, address(this), collateral);

        collateralToken.forceApprove(address(vault), openFee);
        vault.receiveFee(openFee, INSURANCE_FEE_SHARE_BPS);

        positions[msg.sender] = Position({
            active: true,
            isLong: isLong,
            sizeUsd: sizeUsd,
            collateral: netCollateral,
            entryPrice: price1e8,
            fundingIndexSnapshot: 0,
            openedAt: currentTs
        });

        _syncVaultLockedExposure();
        emit PositionOpened(msg.sender, isLong, sizeUsd, netCollateral, price1e8, leverageX100);
    }

    /// @inheritdoc IPerpMarket
    function closePosition() external override nonReentrant {
        Position memory pos = positions[msg.sender];
        if (!pos.active) revert NoActivePosition();

        uint256 currentTs = clock.effectiveNow();
        (uint256 currentPrice, uint256 priceTs) = priceFeed.latestPrice();
        if (currentTs > priceTs && (currentTs - priceTs) > maxStaleness) revert StalePrice();

        int256 pnl = _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
        uint256 closeFee = (pos.sizeUsd * TAKER_FEE_BPS) / 10000;

        if (pos.isLong) {
            totalOiLongUsd -= pos.sizeUsd;
        } else {
            totalOiShortUsd -= pos.sizeUsd;
        }
        delete positions[msg.sender];
        _syncVaultLockedExposure();

        // Settle PnL with vault
        if (pnl > 0) {
            // Vault transfers profit to this contract
            vault.settleTraderPnl(pnl);
        } else if (pnl < 0) {
            uint256 loss = uint256(-pnl);
            // Cap loss to trader collateral
            if (loss > pos.collateral) {
                loss = pos.collateral;
            }
            collateralToken.forceApprove(address(vault), loss);
            vault.settleTraderPnl(-int256(loss));
        }

        // Net payout to trader: collateral + pnl - closeFee
        int256 netPayout = int256(pos.collateral) + pnl - int256(closeFee);
        uint256 payout = netPayout > 0 ? uint256(netPayout) : 0;

        // Pay fee to vault
        if (closeFee > 0) {
            collateralToken.forceApprove(address(vault), closeFee);
            vault.receiveFee(closeFee, INSURANCE_FEE_SHARE_BPS);
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

        uint256 currentTs = clock.effectiveNow();
        (uint256 currentPrice, uint256 priceTs) = priceFeed.latestPrice();
        if (currentTs > priceTs && (currentTs - priceTs) > maxStaleness) revert StalePrice();

        RiskParams memory params = riskPolicy.getParams(currentTs);
        uint256 remainingCollateral = pos.collateral - amount;

        int256 pnl = _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
        int256 equity = int256(remainingCollateral) + pnl;
        if (equity <= 0) revert InsufficientCollateral();

        // Must still satisfy IM at current policy params
        uint256 requiredIm = (pos.sizeUsd * params.initialMarginBps) / 10000;
        if (uint256(equity) < requiredIm) revert InsufficientCollateral();

        pos.collateral = remainingCollateral;
        collateralToken.safeTransfer(msg.sender, amount);
        emit MarginRemoved(msg.sender, amount, pos.collateral);
    }

    /// @inheritdoc IPerpMarket
    function liquidate(address trader) external override nonReentrant {
        Position memory pos = positions[trader];
        if (!pos.active) revert NoActivePosition();

        uint256 currentTs = clock.effectiveNow();
        (uint256 currentPrice,) = priceFeed.latestPrice();

        RiskParams memory params = riskPolicy.getParams(currentTs);
        int256 pnl = _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
        int256 equity = int256(pos.collateral) + pnl;

        uint256 mmUsd = (pos.sizeUsd * params.maintenanceMarginBps) / 10000;
        if (equity >= int256(mmUsd)) revert PositionHealthy();

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

        uint256 shortfall = 0;
        if (equity <= 0) {
            // Bad debt case: trader losses exceed collateral!
            uint256 deficit = uint256(-equity);
            shortfall = deficit + keeperReward + insuranceContrib;

            // Trader collateral transferred to vault to offset loss
            if (pos.collateral > 0) {
                collateralToken.forceApprove(address(vault), pos.collateral);
                vault.settleTraderPnl(-int256(pos.collateral));
            }

            // Vault covers the shortfall (from insurance fund first, then vault LP bad debt)
            vault.coverShortfall(shortfall);

            // Pay keeper reward
            collateralToken.safeTransfer(msg.sender, keeperReward);
            // Pay insurance contribution back into insurance fund
            collateralToken.forceApprove(address(vault), insuranceContrib);
            vault.receiveInsuranceFundContribution(insuranceContrib);
        } else {
            // Partial equity remains (> 0 but < MM)
            uint256 remainingEquity = uint256(equity);
            uint256 penalty = keeperReward + insuranceContrib;

            if (remainingEquity >= penalty) {
                collateralToken.safeTransfer(msg.sender, keeperReward);
                collateralToken.forceApprove(address(vault), insuranceContrib);
                vault.receiveInsuranceFundContribution(insuranceContrib);

                // Send remaining collateral to vault to settle trader loss
                uint256 traderLoss = pos.collateral > remainingEquity ? pos.collateral - remainingEquity : 0;
                if (traderLoss > 0) {
                    collateralToken.forceApprove(address(vault), traderLoss);
                    vault.settleTraderPnl(-int256(traderLoss));
                }
            } else {
                // Equity does not fully cover penalty
                uint256 shortfallDeficit = penalty - remainingEquity;
                vault.coverShortfall(shortfallDeficit);
                collateralToken.safeTransfer(msg.sender, keeperReward);
            }
        }

        emit Liquidated(trader, msg.sender, currentPrice, equity, shortfall);
    }

    /// @inheritdoc IPerpMarket
    /// @notice Deleveraging callable in PRE_CLOSE within DELEVERAGE_WINDOW (600s) at open-market price
    function deleverageToCap(address trader) external override nonReentrant {
        Position storage pos = positions[trader];
        if (!pos.active) revert NoActivePosition();

        uint256 currentTs = clock.effectiveNow();
        (Phase phase, uint256 toClose,) = schedule.phaseAt(currentTs);
        if (phase != Phase.PRE_CLOSE || toClose > DELEVERAGE_WINDOW) revert NotDeleverageWindow();

        (uint256 currentPrice, uint256 priceTs) = priceFeed.latestPrice();
        if (currentTs > priceTs && (currentTs - priceTs) > maxStaleness) revert StalePrice();

        RiskParams memory params = riskPolicy.getParams(currentTs);
        int256 pnl = _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
        int256 equity = int256(pos.collateral) + pnl;
        if (equity <= 0) revert InsufficientCollateral();

        uint256 currentLeverageX100 = (pos.sizeUsd * 100) / uint256(equity);
        if (currentLeverageX100 <= params.deleverageTargetX100) revert PositionAlreadyWithinCap();

        uint256 oldSizeUsd = pos.sizeUsd;
        // targetSize = equity * deleverageTargetX100 / 100 (e.g. 5x of equity)
        uint256 targetSizeUsd = (uint256(equity) * params.deleverageTargetX100) / 100;
        uint256 reducedSizeUsd = oldSizeUsd - targetSizeUsd;

        // Realize proportional PnL on reduced portion at the open-market price
        int256 reducedPnl = (pnl * int256(reducedSizeUsd)) / int256(oldSizeUsd);
        if (pos.isLong) {
            totalOiLongUsd -= reducedSizeUsd;
        } else {
            totalOiShortUsd -= reducedSizeUsd;
        }

        pos.sizeUsd = targetSizeUsd;
        // Adjust collateral by realized portion: collateral += reducedPnl
        if (reducedPnl > 0) {
            vault.settleTraderPnl(reducedPnl);
            pos.collateral += uint256(reducedPnl);
        } else if (reducedPnl < 0) {
            uint256 loss = uint256(-reducedPnl);
            pos.collateral = pos.collateral > loss ? pos.collateral - loss : 0;
            collateralToken.forceApprove(address(vault), loss);
            vault.settleTraderPnl(-int256(loss));
        }

        _syncVaultLockedExposure();
        emit Deleveraged(trader, oldSizeUsd, targetSizeUsd, params.deleverageTargetX100);
    }

    // ─── Views ─────────────────────────────────────────────────────────────────

    function getPosition(address trader) external view override returns (Position memory) {
        return positions[trader];
    }

    function getEquity(address trader) external view override returns (int256) {
        Position memory pos = positions[trader];
        if (!pos.active) return 0;
        (uint256 currentPrice,) = priceFeed.latestPrice();
        return int256(pos.collateral) + _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
    }

    function getLeverage(address trader) external view override returns (uint16) {
        Position memory pos = positions[trader];
        if (!pos.active) return 0;
        (uint256 currentPrice,) = priceFeed.latestPrice();
        int256 equity = int256(pos.collateral) + _calculatePnl(pos.isLong, pos.sizeUsd, pos.entryPrice, currentPrice);
        if (equity <= 0) return type(uint16).max;
        return uint16((pos.sizeUsd * 100) / uint256(equity));
    }

    function getLiquidationPrice(address trader) external view override returns (uint256) {
        Position memory pos = positions[trader];
        if (!pos.active) return 0;
        RiskParams memory params = riskPolicy.getParams(clock.effectiveNow());
        uint256 mmUsd = (pos.sizeUsd * params.maintenanceMarginBps) / 10000;

        if (pos.isLong) {
            // Long liq: P0 * (1 - (C - MM) / N)
            if (pos.collateral <= mmUsd) return pos.entryPrice;
            uint256 buffer = pos.collateral - mmUsd;
            uint256 priceDrop = (pos.entryPrice * buffer) / pos.sizeUsd;
            return pos.entryPrice > priceDrop ? pos.entryPrice - priceDrop : 0;
        } else {
            // Short liq: P0 * (1 + (C - MM) / N)
            if (pos.collateral <= mmUsd) return pos.entryPrice;
            uint256 buffer = pos.collateral - mmUsd;
            uint256 priceRise = (pos.entryPrice * buffer) / pos.sizeUsd;
            return pos.entryPrice + priceRise;
        }
    }

    // ─── Internal helpers ─────────────────────────────────────────────────────

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

    function _syncVaultLockedExposure() internal {
        uint256 netExposure = totalOiLongUsd > totalOiShortUsd ? totalOiLongUsd - totalOiShortUsd : totalOiShortUsd - totalOiLongUsd;
        vault.setLockedExposure(netExposure);
    }
}
