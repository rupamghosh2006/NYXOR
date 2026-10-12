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

/// @title DeployDemoScript
/// @notice Deploys a fresh, seeded demo instance of the Nyxor Protocol
///         and writes the resulting contract addresses to deployments/demo-latest.json.
///         Leaves deployments/fuji.json untouched as the permanent recorded benchmark run.
contract DeployDemoScript is Script {
    uint256 internal constant INITIAL_PRICE = 4150 * 1e8; // 4,150.00 USD (8 decimals)
    uint256 internal constant BASE_OI = 2_000_000 * 1e6;   // 2,000,000 USDx
    uint256 internal constant BASE_POS = 500_000 * 1e6;    // 500,000 USDx
    uint256 internal constant SEED_VAULT = 500_000 * 1e6;  // 500,000 USDx per vault

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("=== Deploying Fresh Nyxor Demo Instance ===");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        DemoUSDC usdc = new DemoUSDC(deployer);
        MarketClock clock = new MarketClock(deployer, true);
        MarketSchedule schedule = new MarketSchedule(deployer, 3600, 900);

        MockPriceFeed feedStandard = new MockPriceFeed(deployer, address(clock), address(schedule), INITIAL_PRICE);
        MockPriceFeed feedGuarded = new MockPriceFeed(deployer, address(clock), address(schedule), INITIAL_PRICE);

        FlatRiskPolicy policyStandard = new FlatRiskPolicy(BASE_OI, BASE_POS);
        MarketHoursRiskPolicy policyGuarded = new MarketHoursRiskPolicy(address(schedule), BASE_OI, BASE_POS);

        LiquidityVault vaultStandard = new LiquidityVault(deployer, address(usdc));
        LiquidityVault vaultGuarded = new LiquidityVault(deployer, address(usdc));

        PerpMarket marketStandard = new PerpMarket(
            deployer,
            address(usdc),
            address(policyStandard),
            address(feedStandard),
            address(clock),
            address(schedule),
            payable(address(vaultStandard))
        );

        PerpMarket marketGuarded = new PerpMarket(
            deployer,
            address(usdc),
            address(policyGuarded),
            address(feedGuarded),
            address(clock),
            address(schedule),
            payable(address(vaultGuarded))
        );

        vaultStandard.setMarket(address(marketStandard));
        vaultGuarded.setMarket(address(marketGuarded));

        marketStandard.grantRole(marketStandard.KEEPER_ROLE(), deployer);
        marketGuarded.grantRole(marketGuarded.KEEPER_ROLE(), deployer);
        feedStandard.grantRole(feedStandard.KEEPER_ROLE(), deployer);
        feedGuarded.grantRole(feedGuarded.KEEPER_ROLE(), deployer);

        usdc.mint(deployer, SEED_VAULT * 2);
        usdc.approve(address(vaultStandard), SEED_VAULT);
        usdc.approve(address(vaultGuarded), SEED_VAULT);
        vaultStandard.deposit(SEED_VAULT);
        vaultGuarded.deposit(SEED_VAULT);

        vm.stopBroadcast();

        // Serialize and save to deployments/demo-latest.json
        string memory json = "demo_export";
        vm.serializeString(json, "_comment", "Fresh demo deployment instance for interactive demo resets");
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

        string memory exportPath = vm.envOr("DEPLOY_TARGET_PATH", string("../deployments/demo-latest.json"));
        vm.writeJson(finalJson, exportPath);
        console2.log("Wrote deployment to:", exportPath);
    }
}
