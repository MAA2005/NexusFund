// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Campaign.sol";

/**
 * @title CampaignFactory
 * @notice Deploys and tracks all NexusFund Campaign contracts.
 *
 * The owner of this contract controls:
 *  - The feeReceiver address (wallet that gets the 2.5% platform fee)
 *  - Ability to transfer ownership to a new address
 *
 * The feeReceiver is passed to each Campaign at deployment time, so changing
 * it here only affects campaigns created AFTER the update — not existing ones.
 */
contract CampaignFactory is Ownable {
    // usdcToken is immutable — the stablecoin we accept can never change after deployment.
    // This is intentional: changing the accepted token would break all existing campaigns.
    address public immutable usdcToken;

    // feeReceiver can be updated by the owner (e.g., to rotate a payout wallet).
    // IMPORTANT: Must always be an EOA (regular wallet), not a smart contract.
    // If set to a contract that rejects ERC-20 transfers, creators cannot withdraw.
    address public feeReceiver;

    // Registry of all deployed campaign contracts
    address[] public allCampaigns;
    mapping(address => address[]) private campaignsByCreator;

    // ─── Events ───────────────────────────────────────────────────────────────
    event CampaignCreated(
        address indexed campaignAddress,
        address indexed creator,
        string  title,
        uint256 goalAmount,
        uint256 deadline
    );

    constructor(address _usdcToken, address _feeReceiver) Ownable(msg.sender) {
        require(_usdcToken   != address(0), "Invalid USDC address");
        require(_feeReceiver != address(0), "Invalid fee receiver");
        usdcToken   = _usdcToken;
        feeReceiver = _feeReceiver;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Deploy a new Campaign and register it in the factory.
     * @param  title       Campaign title (1–200 characters)
     * @param  goalAmount  Funding goal in USDC base units (6 decimals).
     *                     Example: 500 USDC = 500_000_000
     * @param  deadline    Unix timestamp of campaign end. Must be in the future.
     * @return             Address of the newly deployed Campaign contract.
     */
    function createCampaign(
        string  memory title,
        uint256        goalAmount,
        uint256        deadline
    ) external returns (address) {
        // Validate here for clear error messages — Campaign constructor re-validates too
        require(bytes(title).length > 0,    "Title cannot be empty");
        require(bytes(title).length <= 200, "Title too long");
        require(goalAmount > 0,             "Goal must be greater than zero");
        require(deadline > block.timestamp, "Deadline must be in the future");

        Campaign campaign = new Campaign(
            msg.sender,
            title,
            goalAmount,
            deadline,
            usdcToken,
            feeReceiver  // snapshot current feeReceiver — changing it later won't affect this campaign
        );

        address campaignAddress = address(campaign);
        allCampaigns.push(campaignAddress);
        campaignsByCreator[msg.sender].push(campaignAddress);

        emit CampaignCreated(campaignAddress, msg.sender, title, goalAmount, deadline);

        return campaignAddress;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OWNER FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the wallet that receives the 2.5% platform fee.
     * @dev    Only affects campaigns created AFTER this call.
     *         Must be an EOA — a contract feeReceiver risks blocking withdrawals.
     */
    function updateFeeReceiver(address newReceiver) external onlyOwner {
        require(newReceiver != address(0), "Invalid address");
        feeReceiver = newReceiver;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    function getCampaignCount() external view returns (uint256) {
        return allCampaigns.length;
    }

    function getAllCampaigns() external view returns (address[] memory) {
        return allCampaigns;
    }

    function getCampaignsByCreator(address creator) external view returns (address[] memory) {
        return campaignsByCreator[creator];
    }
}
