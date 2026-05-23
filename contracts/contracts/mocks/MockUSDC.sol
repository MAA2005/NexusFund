// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Test-only ERC-20 token that mimics real USDC behaviour.
 *
 * KEY DIFFERENCE from real USDC: anyone can call mint().
 * Real USDC has a permissioned minter controlled by Circle.
 *
 * WHY 6 DECIMALS: Real USDC uses 6 decimal places, not the ERC-20 default
 * of 18. 1 USDC = 1_000_000 in base units. Our contracts use this precision.
 *
 * NEVER deploy this contract to mainnet or any production network.
 * Hardhat will refuse to deploy it outside of the local/test network if you
 * add the safeguard below, but the real protection is: don't put it in your
 * deploy script.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin (Mock)", "USDC") {}

    /**
     * @notice Override decimals to match real USDC (6 instead of 18).
     *         Without this, 1 ether worth of "USDC" would be 1e18 base units,
     *         which would not match real-world amounts in our tests.
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /**
     * @notice Mint tokens to any address. Used in tests to fund test accounts.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
