// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title LiquidityVault
/// @notice Manages LP liquidity and the dedicated insurance fund for a PerpMarket instance.
///         Acts as counterparty to traders at the oracle price.
///         Tracks LP equity, insurance fund reserves, and accumulated bad debt.
contract LiquidityVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MARKET_ROLE = keccak256("MARKET_ROLE");

    IERC20 public immutable asset; // 6-decimal USDC

    // LP Share tracking
    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;

    // Accounting buckets (6-decimal units)
    uint256 public vaultAssets;       // LP principal + LP profits/losses
    uint256 public insuranceFund;      // Reserved buffer for liquidations/gaps
    uint256 public badDebtTotal;      // Cumulative shortfall that eroded LP equity
    int256 public realizedTraderPnl;  // Net cumulative trader PnL realized against vault
    uint256 public lockedExposure;    // Liquidity reserved as counterparty for open positions

    // Events
    event Deposited(address indexed lp, uint256 assets, uint256 shares);
    event Withdrawn(address indexed lp, uint256 assets, uint256 shares);
    event FeeReceived(uint256 totalFee, uint256 insurancePortion, uint256 vaultPortion);
    event ShortfallCovered(uint256 totalShortfall, uint256 paidByInsurance, uint256 paidByVaultBadDebt);
    event TraderPnlSettled(int256 pnl, uint256 newVaultAssets);
    event LockedExposureUpdated(uint256 newLockedExposure);

    // Errors
    error ZeroAmount();
    error ZeroShares();
    error InsufficientBalance();
    error InsufficientFreeLiquidity();
    error Unauthorized();

    constructor(address admin, address asset_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        asset = IERC20(asset_);
    }

    /// @notice Set the authorized PerpMarket instance
    function setMarket(address market) external onlyRole(ADMIN_ROLE) {
        _grantRole(MARKET_ROLE, market);
    }

    /// @notice Updates the locked exposure required to cover open trader positions
    function setLockedExposure(uint256 exposure) external onlyRole(MARKET_ROLE) {
        lockedExposure = exposure;
        emit LockedExposureUpdated(exposure);
    }

    /// @notice Total assets held by the vault (LP assets + Insurance fund)
    function totalAssets() external view returns (uint256) {
        return vaultAssets + insuranceFund;
    }

    /// @notice Free liquidity available for LP withdrawal (vaultAssets - lockedExposure)
    function freeLiquidity() external view returns (uint256) {
        return vaultAssets > lockedExposure ? vaultAssets - lockedExposure : 0;
    }

    /// @notice LP deposits collateral and receives proportional shares
    function deposit(uint256 amount) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        if (totalShares == 0 || vaultAssets == 0) {
            shares = amount;
        } else {
            shares = (amount * totalShares) / vaultAssets;
        }
        if (shares == 0) revert ZeroShares();

        totalShares += shares;
        sharesOf[msg.sender] += shares;
        vaultAssets += amount;

        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, shares);
    }

    /// @notice LP redeems shares for underlying assets. Limited by free liquidity.
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assetsOut) {
        if (shares == 0) revert ZeroShares();
        if (sharesOf[msg.sender] < shares) revert InsufficientBalance();

        assetsOut = (shares * vaultAssets) / totalShares;
        if (assetsOut == 0) revert ZeroAmount();
        if (vaultAssets - assetsOut < lockedExposure) revert InsufficientFreeLiquidity();

        sharesOf[msg.sender] -= shares;
        totalShares -= shares;
        vaultAssets -= assetsOut;

        asset.safeTransfer(msg.sender, assetsOut);
        emit Withdrawn(msg.sender, assetsOut, shares);
    }

    /// @notice Receives trading fee from PerpMarket, splitting between vault assets and insurance fund
    function receiveFee(uint256 totalFee, uint256 insuranceShareBps) external onlyRole(MARKET_ROLE) {
        if (totalFee == 0) return;

        uint256 toInsurance = (totalFee * insuranceShareBps) / 10000;
        uint256 toVault = totalFee - toInsurance;

        insuranceFund += toInsurance;
        vaultAssets += toVault;

        asset.safeTransferFrom(msg.sender, address(this), totalFee);
        emit FeeReceived(totalFee, toInsurance, toVault);
    }

    /// @notice Directly funds the insurance fund (e.g. from keeper liquidation penalty share)
    function receiveInsuranceFundContribution(uint256 amount) external onlyRole(MARKET_ROLE) {
        if (amount == 0) return;
        insuranceFund += amount;
        asset.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Settle realized trader PnL against vault assets
    /// @dev Called by PerpMarket when a position is closed or decreased.
    ///      pnl > 0: trader won, vault pays out to market contract
    ///      pnl < 0: trader lost, market contract pays into vault
    function settleTraderPnl(int256 pnl) external onlyRole(MARKET_ROLE) {
        realizedTraderPnl += pnl;

        if (pnl > 0) {
            uint256 payout = uint256(pnl);
            // If vault equity is insufficient, payout is capped or absorbed
            if (payout > vaultAssets) {
                uint256 deficit = payout - vaultAssets;
                badDebtTotal += deficit;
                vaultAssets = 0;
            } else {
                vaultAssets -= payout;
            }
            asset.safeTransfer(msg.sender, payout);
        } else if (pnl < 0) {
            uint256 loss = uint256(-pnl);
            vaultAssets += loss;
            asset.safeTransferFrom(msg.sender, address(this), loss);
        }

        emit TraderPnlSettled(pnl, vaultAssets);
    }

    /// @notice Covers bad debt shortfall from liquidations
    /// @dev First drains the insurance fund; any remaining deficit reduces vault assets
    ///      and accumulates in badDebtTotal.
    function coverShortfall(uint256 shortfallAmount) external onlyRole(MARKET_ROLE) returns (uint256 paidByInsurance, uint256 paidByVault) {
        if (shortfallAmount == 0) return (0, 0);

        if (insuranceFund >= shortfallAmount) {
            insuranceFund -= shortfallAmount;
            paidByInsurance = shortfallAmount;
            paidByVault = 0;
        } else {
            paidByInsurance = insuranceFund;
            paidByVault = shortfallAmount - insuranceFund;
            insuranceFund = 0;

            badDebtTotal += paidByVault;
            if (vaultAssets >= paidByVault) {
                vaultAssets -= paidByVault;
            } else {
                vaultAssets = 0;
            }
        }

        // Transfer needed shortfall funds from vault to market so market can clear balances
        asset.safeTransfer(msg.sender, shortfallAmount);

        emit ShortfallCovered(shortfallAmount, paidByInsurance, paidByVault);
    }
}
