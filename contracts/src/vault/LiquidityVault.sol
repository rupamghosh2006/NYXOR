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

    // LP Share tracking with Epoch separation
    uint256 public epoch = 1;
    mapping(uint256 => uint256) public totalSharesByEpoch;
    mapping(uint256 => mapping(address => uint256)) public sharesOfByEpoch;

    // Accounting buckets (6-decimal units)
    uint256 public vaultAssets;       // LP principal + LP profits/losses
    uint256 public insuranceFund;      // Reserved buffer for liquidations/gaps
    uint256 public badDebtTotal;      // Cumulative shortfall that eroded LP equity
    int256 public realizedTraderPnl;  // Net cumulative trader PnL realized against vault
    uint256 public lockedExposure;    // Liquidity reserved as counterparty for open positions

    // Events
    event Deposited(address indexed lp, uint256 assets, uint256 shares, uint256 epoch);
    event Withdrawn(address indexed lp, uint256 assets, uint256 shares, uint256 epoch);
    event FeeReceived(uint256 totalFee, uint256 insurancePortion, uint256 vaultPortion);
    event ShortfallCovered(uint256 totalShortfall, uint256 paidByInsurance, uint256 paidByVaultBadDebt);
    event TraderPnlSettled(int256 pnl, uint256 newVaultAssets);
    event LockedExposureUpdated(uint256 newLockedExposure);
    event EpochAdvanced(uint256 newEpoch);

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

    /// @notice Total active shares in current epoch
    function totalShares() external view returns (uint256) {
        return totalSharesByEpoch[epoch];
    }

    /// @notice Active shares of an LP in current epoch
    function sharesOf(address lp) external view returns (uint256) {
        return sharesOfByEpoch[epoch][lp];
    }

    /// @notice Total assets held by the vault (LP assets + Insurance fund)
    function totalAssets() external view returns (uint256) {
        return vaultAssets + insuranceFund;
    }

    /// @notice Free liquidity available for LP withdrawal (vaultAssets - lockedExposure)
    function freeLiquidity() external view returns (uint256) {
        return vaultAssets > lockedExposure ? vaultAssets - lockedExposure : 0;
    }

    /// @notice LP deposits collateral and receives proportional shares in current epoch
    function deposit(uint256 amount) external nonReentrant returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        if (vaultAssets == 0 && totalSharesByEpoch[epoch] > 0) {
            // Vault was completely insolvent (assets wiped while shares existed).
            // Advance to next epoch so old insolvent LPs cannot claim fresh recapitalized capital.
            epoch++;
            emit EpochAdvanced(epoch);
        }

        if (totalSharesByEpoch[epoch] == 0 || vaultAssets == 0) {
            shares = amount;
        } else {
            shares = (amount * totalSharesByEpoch[epoch]) / vaultAssets;
        }
        if (shares == 0) revert ZeroShares();

        totalSharesByEpoch[epoch] += shares;
        sharesOfByEpoch[epoch][msg.sender] += shares;
        vaultAssets += amount;

        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, shares, epoch);
    }

    /// @notice LP redeems shares for underlying assets in current epoch. Limited by free liquidity.
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assetsOut) {
        if (shares == 0) revert ZeroShares();
        if (sharesOfByEpoch[epoch][msg.sender] < shares) revert InsufficientBalance();

        assetsOut = (shares * vaultAssets) / totalSharesByEpoch[epoch];
        if (assetsOut == 0) revert ZeroAmount();
        if (vaultAssets - assetsOut < lockedExposure) revert InsufficientFreeLiquidity();

        sharesOfByEpoch[epoch][msg.sender] -= shares;
        totalSharesByEpoch[epoch] -= shares;
        vaultAssets -= assetsOut;

        asset.safeTransfer(msg.sender, assetsOut);
        emit Withdrawn(msg.sender, assetsOut, shares, epoch);
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
    ///      pnl > 0: trader won, vault pays out up to available vaultAssets (deficit recorded as bad debt)
    ///      pnl < 0: trader lost, market contract pays into vault
    function settleTraderPnl(int256 pnl) external onlyRole(MARKET_ROLE) {
        realizedTraderPnl += pnl;

        if (pnl > 0) {
            uint256 requestedPayout = uint256(pnl);
            uint256 actualPayout = requestedPayout;
            if (requestedPayout > vaultAssets) {
                uint256 deficit = requestedPayout - vaultAssets;
                badDebtTotal += deficit;
                actualPayout = vaultAssets;
                vaultAssets = 0;
            } else {
                vaultAssets -= requestedPayout;
            }
            if (actualPayout > 0) {
                asset.safeTransfer(msg.sender, actualPayout);
            }
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
