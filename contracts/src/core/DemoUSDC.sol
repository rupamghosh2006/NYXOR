// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/// @title DemoUSDC
/// @notice 6-decimal ERC-20 stablecoin mock for Nyxor testing and demonstration.
contract DemoUSDC is ERC20, Ownable {
    constructor(address initialOwner) ERC20("Nyxor Test USD", "USDx") Ownable(initialOwner) {
        _mint(initialOwner, 100_000_000 * 1e6); // 100M USDC initial supply
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Anyone can mint in demo/test mode
    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
