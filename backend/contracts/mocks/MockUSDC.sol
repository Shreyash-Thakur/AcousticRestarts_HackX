// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title  MockUSDC
 * @notice Fake USDC with public mint for local & testnet testing.
 *         6 decimals to match real USDC.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin (Mock)", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Anyone can mint — test only!
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
