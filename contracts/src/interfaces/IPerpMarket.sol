// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPerpMarket {
    struct Position {
        bool active;
        bool isLong;
        uint256 sizeUsd;             // 6 decimals
        uint256 collateral;          // 6 decimals
        uint256 entryPrice;          // 8 decimals
        int256 fundingIndexSnapshot; // 18 decimals
        uint256 openedAt;            // timestamp
    }

    event PositionOpened(address indexed trader, bool isLong, uint256 sizeUsd, uint256 collateral, uint256 entryPrice, uint16 leverageX100);
    event PositionClosed(address indexed trader, uint256 closePrice, int256 realizedPnl, uint256 payout);
    event MarginAdded(address indexed trader, uint256 amount, uint256 newCollateral);
    event MarginRemoved(address indexed trader, uint256 amount, uint256 newCollateral);
    event Liquidated(address indexed trader, address indexed liquidator, uint256 price, int256 equity, uint256 shortfall);
    event Deleveraged(address indexed trader, uint256 oldSizeUsd, uint256 newSizeUsd, uint16 targetLeverageX100);
    event FundingSettled(int256 fundingRateBps, int256 newFundingIndex);

    function openPosition(bool isLong, uint256 collateral, uint16 leverageX100) external;
    function closePosition() external;
    function addMargin(uint256 amount) external;
    function removeMargin(uint256 amount) external;
    function liquidate(address trader) external;
    function deleverageToCap(address trader) external;

    function getPosition(address trader) external view returns (Position memory);
    function getEquity(address trader) external view returns (int256 equityUsd);
    function getLeverage(address trader) external view returns (uint16 leverageX100);
    function getLiquidationPrice(address trader) external view returns (uint256 liqPrice1e8);
}
