// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PerpMarket} from "../../src/core/PerpMarket.sol";
import {LiquidityVault} from "../../src/vault/LiquidityVault.sol";
import {DemoUSDC} from "../../src/core/DemoUSDC.sol";
import {MockPriceFeed} from "../../src/oracle/MockPriceFeed.sol";
import {MarketClock} from "../../src/core/MarketClock.sol";
import {MarketSchedule} from "../../src/core/MarketSchedule.sol";
import {IRiskPolicy, RiskParams} from "../../src/interfaces/IRiskPolicy.sol";
import {IPerpMarket} from "../../src/interfaces/IPerpMarket.sol";
import {Phase} from "../../src/interfaces/IMarketSchedule.sol";

contract Handler is Test {
    PerpMarket public immutable market;
    LiquidityVault public immutable vault;
    DemoUSDC public immutable usdc;
    MockPriceFeed public immutable feed;
    MarketClock public immutable clock;
    MarketSchedule public immutable schedule;
    IRiskPolicy public immutable policy;

    address internal admin;
    address[] public traders;

    uint256 public constant INITIAL_PRICE = 4150_00000000; // 4150.00 (8 decimals)

    constructor(
        address admin_,
        address market_,
        address vault_,
        address usdc_,
        address feed_,
        address clock_,
        address schedule_,
        address policy_
    ) {
        admin = admin_;
        market = PerpMarket(payable(market_));
        vault = LiquidityVault(payable(vault_));
        usdc = DemoUSDC(usdc_);
        feed = MockPriceFeed(feed_);
        clock = MarketClock(clock_);
        schedule = MarketSchedule(schedule_);
        policy = IRiskPolicy(policy_);

        // Setup 4 distinct traders
        for (uint256 i = 0; i < 4; i++) {
            address trader = makeAddr(string(abi.encodePacked("invariant_trader_", i)));
            traders.push(trader);

            vm.prank(admin);
            usdc.mint(trader, 1_000_000 * 1e6); // 1M USDC each

            vm.prank(trader);
            usdc.approve(address(market), type(uint256).max);
        }
    }

    function openPosition(
        uint256 traderSeed,
        bool isLong,
        uint256 marginRaw,
        uint256 leverageRaw
    ) external {
        address trader = traders[traderSeed % traders.length];
        IPerpMarket.Position memory existing = market.getPosition(trader);
        if (existing.active) return;

        uint256 currentTs = clock.effectiveNow();
        (Phase phase,,) = schedule.phaseAt(currentTs);
        if (phase != Phase.OPEN) return;

        RiskParams memory params = policy.getParams(currentTs);
        if (params.reduceOnly) return;

        uint256 margin = bound(marginRaw, 1_000, 10_000) * 1e6;
        uint16 leverageX100 = uint16(bound(leverageRaw, 200, params.maxLeverageX100));

        uint256 sizeUsd = (margin * leverageX100) / 100;
        if (sizeUsd > params.maxPositionUsd) return;

        if (isLong) {
            if (market.totalOiLongUsd() + sizeUsd > params.maxOpenInterestUsd) return;
        } else {
            if (market.totalOiShortUsd() + sizeUsd > params.maxOpenInterestUsd) return;
        }

        vm.prank(trader);
        try market.openPosition(isLong, margin, leverageX100) {} catch {}
    }

    function addMargin(uint256 traderSeed, uint256 amountRaw) external {
        address trader = traders[traderSeed % traders.length];
        IPerpMarket.Position memory pos = market.getPosition(trader);
        if (!pos.active) return;

        uint256 amount = bound(amountRaw, 100, 2_000) * 1e6;

        vm.prank(trader);
        try market.addMargin(amount) {} catch {}
    }

    function removeMargin(uint256 traderSeed, uint256 amountRaw) external {
        address trader = traders[traderSeed % traders.length];
        IPerpMarket.Position memory pos = market.getPosition(trader);
        if (!pos.active) return;

        uint256 amount = bound(amountRaw, 10, pos.collateral / 4);
        if (amount == 0) return;

        vm.prank(trader);
        try market.removeMargin(amount) {} catch {}
    }

    function closePosition(uint256 traderSeed) external {
        address trader = traders[traderSeed % traders.length];
        IPerpMarket.Position memory pos = market.getPosition(trader);
        if (!pos.active) return;

        vm.prank(trader);
        try market.closePosition() {} catch {}
    }

    function settleFunding() external {
        try market.settleFunding() {} catch {}
    }

    function advanceTime(uint256 secondsRaw) external {
        uint256 secs = bound(secondsRaw, 60, 1800);
        vm.prank(admin);
        clock.advance(secs);

        (uint256 currentPrice,) = feed.latestPrice();
        vm.prank(admin);
        feed.setPrice(currentPrice);
    }

    function liquidateTrader(uint256 traderSeed) external {
        address trader = traders[traderSeed % traders.length];
        IPerpMarket.Position memory pos = market.getPosition(trader);
        if (!pos.active) return;

        address keeper = makeAddr("random_keeper");
        vm.prank(keeper);
        try market.liquidate(trader) {} catch {}
    }

    function changePrice(int256 shockBpsRaw) external {
        int256 shockBps = bound(shockBpsRaw, -1500, 1500); // +/- 15% shock
        vm.prank(admin);
        feed.queueShock(shockBps);
    }

    function getTraders() external view returns (address[] memory) {
        return traders;
    }
}
