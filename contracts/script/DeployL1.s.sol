// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DemoUSDC} from "../src/core/DemoUSDC.sol";
import {MarketClock} from "../src/core/MarketClock.sol";
import {MarketSchedule} from "../src/core/MarketSchedule.sol";
import {MockPriceFeed} from "../src/oracle/MockPriceFeed.sol";
import {FlatRiskPolicy} from "../src/policy/FlatRiskPolicy.sol";
import {MarketHoursRiskPolicy} from "../src/policy/MarketHoursRiskPolicy.sol";
import {LiquidityVault} from "../src/vault/LiquidityVault.sol";
import {PerpMarket} from "../src/core/PerpMarket.sol";

/// @title DeployL1Script
/// @notice Deploys the complete Nyxor Protocol architecture to Nyxor Sovereign L1 (Chain ID: 98421):
///         - DemoUSDC (USDx)
///         - MarketClock (with demoMode enabled)
///         - MarketSchedule (weekday equity schedule)
///         - MockPriceFeed (Standard & Guarded)
///         - Risk Policies (Flat & MarketHours)
///         - Liquidity Vaults (Standard & Guarded)
///         - Perp Markets (Standard & Guarded)
///         Configures roles, links vaults, seeds demo LP liquidity,
///         and writes the resulting contract addresses to deployments/l1.json and apps/web/src/deployments/l1.json.
contract DeployL1Script is Script {
    uint256 internal constant INITIAL_PRICE = 4150 * 1e8; // 4,150.00 USD (8 decimals)
    uint256 internal constant BASE_OI = 2_000_000 * 1e6;   // 2,000,000 USDx
    uint256 internal constant BASE_POS = 500_000 * 1e6;    // 500,000 USDx
    uint256 internal constant SEED_VAULT = 500_000 * 1e6;  // 500,000 USDx per vault

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=== Nyxor Protocol Sovereign L1 Deployment ===");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy DemoUSDC (USDx)
        DemoUSDC usdc = new DemoUSDC(deployer);
        console2.log("DemoUSDC:", address(usdc));

        // 2. Deploy MarketClock (demoMode = true)
        MarketClock clock = new MarketClock(deployer, true);
        console2.log("MarketClock:", address(clock));

        // 3. Deploy MarketSchedule (preCloseWindow = 3600s, reopenCooldown = 900s)
        MarketSchedule schedule = new MarketSchedule(deployer, 3600, 900);
        console2.log("MarketSchedule:", address(schedule));

        // 4. Deploy MockPriceFeeds
        MockPriceFeed feedStandard = new MockPriceFeed(deployer, address(clock), address(schedule), INITIAL_PRICE);
        console2.log("MockPriceFeedStandard:", address(feedStandard));

        MockPriceFeed feedGuarded = new MockPriceFeed(deployer, address(clock), address(schedule), INITIAL_PRICE);
        console2.log("MockPriceFeedGuarded:", address(feedGuarded));

        // 5. Deploy Risk Policies
        FlatRiskPolicy policyStandard = new FlatRiskPolicy(BASE_OI, BASE_POS);
        console2.log("FlatRiskPolicy:", address(policyStandard));

        MarketHoursRiskPolicy policyGuarded = new MarketHoursRiskPolicy(address(schedule), BASE_OI, BASE_POS);
        console2.log("MarketHoursRiskPolicy:", address(policyGuarded));

        // 6. Deploy Liquidity Vaults
        LiquidityVault vaultStandard = new LiquidityVault(deployer, address(usdc));
        console2.log("LiquidityVaultStandard:", address(vaultStandard));

        LiquidityVault vaultGuarded = new LiquidityVault(deployer, address(usdc));
        console2.log("LiquidityVaultGuarded:", address(vaultGuarded));

        // 7. Deploy Perp Markets
        PerpMarket marketStandard = new PerpMarket(
            deployer,
            address(usdc),
            address(policyStandard),
            address(feedStandard),
            address(clock),
            address(schedule),
            payable(address(vaultStandard))
        );
        console2.log("PerpMarketStandard:", address(marketStandard));

        PerpMarket marketGuarded = new PerpMarket(
            deployer,
            address(usdc),
            address(policyGuarded),
            address(feedGuarded),
            address(clock),
            address(schedule),
            payable(address(vaultGuarded))
        );
        console2.log("PerpMarketGuarded:", address(marketGuarded));

        // 8. Configure roles and link vaults
        vaultStandard.setMarket(address(marketStandard));
        vaultGuarded.setMarket(address(marketGuarded));

        marketStandard.grantRole(marketStandard.KEEPER_ROLE(), deployer);
        marketGuarded.grantRole(marketGuarded.KEEPER_ROLE(), deployer);
        feedStandard.grantRole(feedStandard.KEEPER_ROLE(), deployer);
        feedGuarded.grantRole(feedGuarded.KEEPER_ROLE(), deployer);

        // 9. Seed demo liquidity
        usdc.mint(deployer, SEED_VAULT * 2);
        usdc.approve(address(vaultStandard), SEED_VAULT);
        usdc.approve(address(vaultGuarded), SEED_VAULT);
        vaultStandard.deposit(SEED_VAULT);
        vaultGuarded.deposit(SEED_VAULT);

        vm.stopBroadcast();

        // 10. Serialize and save to deployments/l1.json & apps/web/src/deployments/l1.json
        string memory json = "l1_export";
        vm.serializeString(json, "_comment", "Nyxor Protocol Sovereign L1 live deployment on Avalanche Fuji Subnet (Chain ID 98421)");
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "Deployer", deployer);
        vm.serializeAddress(json, "DemoUSDC", address(usdc));
        vm.serializeAddress(json, "MarketClock", address(clock));
        vm.serializeAddress(json, "MarketSchedule", address(schedule));
        vm.serializeAddress(json, "MockPriceFeedStandard", address(feedStandard));
        vm.serializeAddress(json, "MockPriceFeedGuarded", address(feedGuarded));
        vm.serializeAddress(json, "FlatRiskPolicy", address(policyStandard));
        vm.serializeAddress(json, "MarketHoursRiskPolicy", address(policyGuarded));
        vm.serializeAddress(json, "LiquidityVaultStandard", address(vaultStandard));
        vm.serializeAddress(json, "LiquidityVaultGuarded", address(vaultGuarded));
        vm.serializeAddress(json, "PerpMarketStandard", address(marketStandard));
        string memory finalJson = vm.serializeAddress(json, "PerpMarketGuarded", address(marketGuarded));

        vm.writeJson(finalJson, "../deployments/l1.json");
        vm.writeJson(finalJson, "../apps/web/src/deployments/l1.json");

        console2.log("=== Sovereign L1 Deployment Successfully Saved ===");
    }
}
