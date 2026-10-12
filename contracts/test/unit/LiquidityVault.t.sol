// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LiquidityVault} from "../../src/vault/LiquidityVault.sol";
import {DemoUSDC} from "../../src/core/DemoUSDC.sol";

contract LiquidityVaultTest is Test {
    address internal admin = makeAddr("admin");
    address internal market = makeAddr("market");
    address internal lp1 = makeAddr("lp1");
    address internal lp2 = makeAddr("lp2");

    DemoUSDC internal usdc;
    LiquidityVault internal vault;

    uint256 internal constant SEED_AMOUNT = 1_000_000 * 1e6; // 1M USDC

    function setUp() public {
        usdc = new DemoUSDC(admin);
        vault = new LiquidityVault(admin, address(usdc));

        vm.prank(admin);
        vault.setMarket(market);

        // Fund LPs
        vm.startPrank(admin);
        usdc.mint(lp1, SEED_AMOUNT);
        usdc.mint(lp2, SEED_AMOUNT);
        usdc.mint(market, SEED_AMOUNT);
        vm.stopPrank();

        vm.prank(lp1);
        usdc.approve(address(vault), type(uint256).max);

        vm.prank(lp2);
        usdc.approve(address(vault), type(uint256).max);

        vm.prank(market);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_initialDeposit() public {
        vm.prank(lp1);
        uint256 shares = vault.deposit(SEED_AMOUNT);

        assertEq(shares, SEED_AMOUNT);
        assertEq(vault.vaultAssets(), SEED_AMOUNT);
        assertEq(vault.totalShares(), SEED_AMOUNT);
        assertEq(vault.sharesOf(lp1), SEED_AMOUNT);
        assertEq(vault.totalAssets(), SEED_AMOUNT);
    }

    function test_subsequentDeposit_sharePricing() public {
        vm.prank(lp1);
        vault.deposit(SEED_AMOUNT);

        // Market pays in a fee to increase vault assets
        vm.prank(market);
        vault.receiveFee(100_000 * 1e6, 0); // 100k fee directly to vault assets

        // LP2 deposits 550k USDC, gets proportional shares
        // vaultAssets = 1.1M, totalShares = 1M
        // shares = 550k * 1M / 1.1M = 500k
        vm.prank(lp2);
        uint256 shares2 = vault.deposit(550_000 * 1e6);
        assertEq(shares2, 500_000 * 1e6);
    }

    function test_withdraw() public {
        vm.prank(lp1);
        uint256 shares = vault.deposit(SEED_AMOUNT);

        vm.prank(lp1);
        uint256 assetsOut = vault.withdraw(shares);

        assertEq(assetsOut, SEED_AMOUNT);
        assertEq(vault.vaultAssets(), 0);
        assertEq(vault.totalShares(), 0);
        assertEq(usdc.balanceOf(lp1), SEED_AMOUNT);
    }

    function test_receiveFee_splitsToInsurance() public {
        vm.prank(lp1);
        vault.deposit(SEED_AMOUNT);

        // 10,000 USDC fee, 20% (2000 bps) to insurance fund
        uint256 fee = 10_000 * 1e6;
        vm.prank(market);
        vault.receiveFee(fee, 2000);

        assertEq(vault.insuranceFund(), 2_000 * 1e6);
        assertEq(vault.vaultAssets(), SEED_AMOUNT + 8_000 * 1e6);
        assertEq(vault.totalAssets(), SEED_AMOUNT + fee);
    }

    function test_receiveInsuranceFundContribution() public {
        uint256 penalty = 5_000 * 1e6;
        vm.prank(market);
        vault.receiveInsuranceFundContribution(penalty);

        assertEq(vault.insuranceFund(), penalty);
    }

    function test_settleTraderPnl_traderLossIncreasesVault() public {
        vm.prank(lp1);
        vault.deposit(SEED_AMOUNT);

        int256 traderLoss = -50_000 * 1e6; // Trader lost 50k, paid to vault
        vm.prank(market);
        vault.settleTraderPnl(traderLoss);

        assertEq(vault.vaultAssets(), SEED_AMOUNT + 50_000 * 1e6);
        assertEq(vault.realizedTraderPnl(), traderLoss);
    }

    function test_settleTraderPnl_traderProfitPaidByVault() public {
        vm.prank(lp1);
        vault.deposit(SEED_AMOUNT);

        int256 traderProfit = 30_000 * 1e6; // Trader won 30k
        vm.prank(market);
        vault.settleTraderPnl(traderProfit);

        assertEq(vault.vaultAssets(), SEED_AMOUNT - 30_000 * 1e6);
        assertEq(usdc.balanceOf(market), SEED_AMOUNT + 30_000 * 1e6);
    }

    /// @notice Confirms exact payout and recorded bad debt when trader profit exceeds available vault assets
    function test_settleTraderPnl_profitExceedsVaultAssets() public {
        vm.prank(lp1);
        vault.deposit(100_000 * 1e6); // Vault holds only 100k USDC

        uint256 marketBalanceBefore = usdc.balanceOf(market);

        // Trader won 150k USDC (50k more than vault assets)
        int256 excessiveProfit = 150_000 * 1e6;
        vm.prank(market);
        vault.settleTraderPnl(excessiveProfit);

        // Payout to market is capped at 100k (all available vaultAssets)
        assertEq(usdc.balanceOf(market) - marketBalanceBefore, 100_000 * 1e6);
        // vaultAssets is depleted to 0
        assertEq(vault.vaultAssets(), 0);
        // Deficit of 50k is recorded in badDebtTotal
        assertEq(vault.badDebtTotal(), 50_000 * 1e6);
    }

    /// @notice Confirms recapitalization edge case where vaultAssets == 0 but totalShares > 0
    function test_deposit_recapitalizationWhenVaultAssetsZeroAndTotalSharesPositive() public {
        vm.prank(lp1);
        vault.deposit(100_000 * 1e6);

        // Insolvency event wipes all 100k vault assets
        vm.prank(market);
        vault.settleTraderPnl(100_000 * 1e6);

        assertEq(vault.vaultAssets(), 0);
        assertEq(vault.totalShares(), 100_000 * 1e6); // Existing shares are worthless

        // LP2 deposits 200k fresh capital to recapitalize
        vm.prank(lp2);
        uint256 freshShares = vault.deposit(200_000 * 1e6);

        // Reset: totalShares becomes 200k (1:1 with fresh capital), avoiding dilution
        assertEq(freshShares, 200_000 * 1e6);
        assertEq(vault.totalShares(), 200_000 * 1e6);
        assertEq(vault.vaultAssets(), 200_000 * 1e6);
        assertEq(vault.sharesOf(lp2), 200_000 * 1e6);
    }

    /// @notice Confirms that an insolvent epoch 1 LP cannot withdraw after epoch 2 recapitalization
    function test_oldLpCannotWithdrawAfterRecapitalization() public {
        vm.prank(lp1);
        vault.deposit(100_000 * 1e6);

        // Vault wiped out by market settlement
        vm.prank(market);
        vault.settleTraderPnl(100_000 * 1e6);

        // LP2 deposits 100k to recapitalize vault in epoch 2
        vm.prank(lp2);
        vault.deposit(100_000 * 1e6);

        // LP1 attempts to withdraw using obsolete epoch 1 shares -> reverts with InsufficientBalance
        vm.prank(lp1);
        vm.expectRevert(LiquidityVault.InsufficientBalance.selector);
        vault.withdraw(100_000 * 1e6);
    }

    function test_coverShortfall_fullyCoveredByInsurance() public {
        vm.prank(lp1);
        vault.deposit(SEED_AMOUNT);

        // Fund insurance with 50,000 USDC
        vm.prank(market);
        vault.receiveInsuranceFundContribution(50_000 * 1e6);

        // Shortfall of 20,000 USDC
        vm.prank(market);
        (uint256 fromIns, uint256 fromVault) = vault.coverShortfall(20_000 * 1e6);

        assertEq(fromIns, 20_000 * 1e6);
        assertEq(fromVault, 0);
        assertEq(vault.insuranceFund(), 30_000 * 1e6);
        assertEq(vault.badDebtTotal(), 0);
        assertEq(vault.vaultAssets(), SEED_AMOUNT); // LP equity untouched!
    }

    function test_coverShortfall_exceedsInsurance_createsBadDebt() public {
        vm.prank(lp1);
        vault.deposit(SEED_AMOUNT);

        // Fund insurance with 10,000 USDC
        vm.prank(market);
        vault.receiveInsuranceFundContribution(10_000 * 1e6);

        // Gap causes 40,000 USDC shortfall (e.g. Standard naive market)
        vm.prank(market);
        (uint256 fromIns, uint256 fromVault) = vault.coverShortfall(40_000 * 1e6);

        assertEq(fromIns, 10_000 * 1e6);
        assertEq(fromVault, 30_000 * 1e6);
        assertEq(vault.insuranceFund(), 0);
        assertEq(vault.badDebtTotal(), 30_000 * 1e6); // 30k bad debt recorded
        assertEq(vault.vaultAssets(), SEED_AMOUNT - 30_000 * 1e6); // LP assets reduced!
    }

    /// @notice Confirms LP share price uses vaultAssets only, NOT insuranceFund
    function test_lpCannotWithdrawInsuranceReserve() public {
        vm.prank(lp1);
        vault.deposit(SEED_AMOUNT);

        // Insurance fund receives 500,000 USDC
        uint256 insReserve = 500_000 * 1e6;
        vm.prank(market);
        vault.receiveInsuranceFundContribution(insReserve);

        assertEq(vault.insuranceFund(), insReserve);
        assertEq(vault.vaultAssets(), SEED_AMOUNT);
        assertEq(vault.totalAssets(), SEED_AMOUNT + insReserve);

        // LP1 withdraws 100% of their shares
        uint256 lpShares = vault.sharesOf(lp1);
        vm.prank(lp1);
        uint256 withdrawn = vault.withdraw(lpShares);

        // LP1 gets only their vaultAssets (1M), NOT the insurance reserve!
        assertEq(withdrawn, SEED_AMOUNT);
        assertEq(vault.vaultAssets(), 0);
        assertEq(vault.insuranceFund(), insReserve); // Insurance fund remains 100% intact!
        assertEq(usdc.balanceOf(address(vault)), insReserve);
    }

    /// @notice Confirms LP withdrawals are bounded by locked exposure from open positions
    function test_withdraw_blockedByExposure() public {
        vm.prank(lp1);
        vault.deposit(SEED_AMOUNT);

        // Market locks 800,000 USDC of exposure
        uint256 locked = 800_000 * 1e6;
        vm.prank(market);
        vault.setLockedExposure(locked);

        assertEq(vault.freeLiquidity(), 200_000 * 1e6);

        // LP attempts to withdraw 100% of shares (1M) -> must revert
        uint256 lpShares = vault.sharesOf(lp1);
        vm.prank(lp1);
        vm.expectRevert(LiquidityVault.InsufficientFreeLiquidity.selector);
        vault.withdraw(lpShares);

        // LP withdraws only 200,000 shares (free liquidity) -> succeeds
        uint256 freeShares = (200_000 * 1e6 * lpShares) / SEED_AMOUNT;
        vm.prank(lp1);
        uint256 withdrawn = vault.withdraw(freeShares);
        assertEq(withdrawn, 200_000 * 1e6);
        assertEq(vault.vaultAssets(), locked);
    }
}
