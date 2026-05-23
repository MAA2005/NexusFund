// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Campaign
 * @notice Holds USDC in escrow for a single crowdfunding campaign.
 *
 * Flow:
 *  1. Donors call donate() — funds held here until deadline
 *  2a. Goal met + deadline passed → creator calls withdraw() → 97.5% to creator, 2.5% to feeReceiver
 *  2b. Goal not met + deadline passed → each donor calls refund() → full amount returned
 *
 * This contract is deployed by CampaignFactory, never directly.
 */
contract Campaign is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Immutable state ──────────────────────────────────────────────────────
    // Set once at construction. Immutables cost zero gas to read (no SLOAD).
    address public immutable creator;
    address public immutable feeReceiver;
    IERC20  public immutable usdc;
    uint256 public immutable goalAmount; // in USDC base units (6 decimals), e.g. 1000 USDC = 1_000_000_000
    uint256 public immutable deadline;   // Unix timestamp

    // ─── Mutable state ────────────────────────────────────────────────────────
    string  public title;
    uint256 public totalRaised;
    uint256 public donorCount;
    bool    public withdrawn;

    // Per-donor donation amounts — used for refunds
    mapping(address => uint256) public donations;

    // ─── Events ───────────────────────────────────────────────────────────────
    event DonationReceived(address indexed donor,   uint256 amount,        uint256 totalRaised);
    event FundsWithdrawn  (address indexed creator, uint256 creatorAmount, uint256 platformFee);
    event RefundIssued    (address indexed donor,   uint256 amount);

    // ─── Fee constants ────────────────────────────────────────────────────────
    // 250 / 10_000 = 2.5% platform fee on successful withdrawals
    uint256 public constant PLATFORM_FEE_BPS = 250;
    uint256 public constant BPS_DENOMINATOR  = 10_000;

    // ─── Title length guard ───────────────────────────────────────────────────
    // Storing long strings on-chain is expensive. 200 chars ≈ 200 bytes ≈ 7 storage slots.
    uint256 public constant MAX_TITLE_LENGTH = 200;

    constructor(
        address       _creator,
        string memory _title,
        uint256       _goalAmount,
        uint256       _deadline,
        address       _usdc,
        address       _feeReceiver
    ) {
        require(_creator     != address(0),              "Invalid creator");
        require(_usdc        != address(0),              "Invalid USDC address");
        require(_feeReceiver != address(0),              "Invalid fee receiver");
        require(_goalAmount  >  0,                       "Goal must be greater than zero");
        require(_deadline    >  block.timestamp,         "Deadline must be in the future");
        require(bytes(_title).length > 0,                "Title cannot be empty");
        require(bytes(_title).length <= MAX_TITLE_LENGTH,"Title too long");

        creator     = _creator;
        title       = _title;
        goalAmount  = _goalAmount;
        deadline    = _deadline;
        usdc        = IERC20(_usdc);
        feeReceiver = _feeReceiver;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CORE FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Donate USDC to this campaign.
     * @dev Caller must call usdc.approve(campaignAddress, amount) before this.
     *      nonReentrant prevents a malicious ERC-20 token from re-entering.
     */
    function donate(uint256 amount) external nonReentrant {
        require(block.timestamp < deadline, "Campaign has ended");
        require(amount > 0,                 "Donation must be greater than zero");

        // Update state BEFORE external call (checks-effects-interactions pattern)
        if (donations[msg.sender] == 0) {
            donorCount++;
        }
        donations[msg.sender] += amount;
        totalRaised            += amount;

        // safeTransferFrom reverts if transfer fails — safer than checking bool return
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit DonationReceived(msg.sender, amount, totalRaised);
    }

    /**
     * @notice Campaign creator withdraws funds after a successful campaign.
     * @dev    Deadline must have passed AND goal must be met.
     *         2.5% platform fee sent to feeReceiver, remainder to creator.
     *         Can only be called once.
     */
    function withdraw() external nonReentrant {
        require(msg.sender == creator,       "Only the campaign creator can withdraw");
        require(block.timestamp >= deadline, "Cannot withdraw before deadline");
        require(totalRaised >= goalAmount,   "Funding goal was not met");
        require(!withdrawn,                  "Funds have already been withdrawn");

        // Mark withdrawn BEFORE transfers — even though nonReentrant is here,
        // this ensures the flag is correct if we ever remove nonReentrant in a future upgrade
        withdrawn = true;

        uint256 platformFee   = (totalRaised * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 creatorAmount = totalRaised - platformFee;

        // If either transfer reverts, the entire transaction reverts (Ethereum atomicity)
        // Both transfers happen or neither does — no partial state
        usdc.safeTransfer(feeReceiver, platformFee);
        usdc.safeTransfer(creator,     creatorAmount);

        emit FundsWithdrawn(creator, creatorAmount, platformFee);
    }

    /**
     * @notice Donor reclaims their donation when a campaign fails.
     * @dev    Deadline must have passed AND goal must NOT be met.
     *         Each donor can only refund their own donated amount.
     */
    function refund() external nonReentrant {
        require(block.timestamp >= deadline, "Campaign is still active");
        require(totalRaised < goalAmount,    "Campaign succeeded, no refunds");
        require(donations[msg.sender] > 0,  "You have no donation to refund");

        uint256 amount = donations[msg.sender];

        // Zero out BEFORE transfer — second line of defense against double-refund
        // (nonReentrant is the first line, but we never rely on a single guard)
        donations[msg.sender] = 0;

        usdc.safeTransfer(msg.sender, amount);

        emit RefundIssued(msg.sender, amount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    function isGoalMet() external view returns (bool) {
        return totalRaised >= goalAmount;
    }

    function isActive() external view returns (bool) {
        return block.timestamp < deadline;
    }

    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SAFETY
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Reject accidental ETH sends — this contract only holds USDC.
     *         Without this, ETH sent here would be permanently locked.
     */
    receive() external payable {
        revert("This contract does not accept ETH. Donate using USDC.");
    }
}
