// Human-readable ABI format — ethers.js v6 parses these strings directly.
// Only include functions the frontend actually calls to keep bundle size small.
// These must exactly match the function signatures in the deployed Solidity contracts.

export const CAMPAIGN_FACTORY_ABI = [
    "function createCampaign(string title, uint256 goalAmount, uint256 deadline) external returns (address)",
    "function getAllCampaigns() external view returns (address[])",
    "function getCampaignsByCreator(address creator) external view returns (address[])",
    "function getCampaignCount() external view returns (uint256)",
    "function feeReceiver() external view returns (address)",
    "function usdcToken() external view returns (address)",
    "event CampaignCreated(address indexed campaignAddress, address indexed creator, string title, uint256 goalAmount, uint256 deadline)",
];

export const CAMPAIGN_ABI = [
    // Write functions
    "function donate(uint256 amount) external",
    "function withdraw() external",
    "function refund() external",
    // Read functions
    "function creator() external view returns (address)",
    "function title() external view returns (string)",
    "function goalAmount() external view returns (uint256)",
    "function deadline() external view returns (uint256)",
    "function totalRaised() external view returns (uint256)",
    "function donorCount() external view returns (uint256)",
    "function withdrawn() external view returns (bool)",
    "function feeReceiver() external view returns (address)",
    "function usdc() external view returns (address)",
    "function donations(address donor) external view returns (uint256)",
    "function isGoalMet() external view returns (bool)",
    "function isActive() external view returns (bool)",
    "function timeRemaining() external view returns (uint256)",
    // Events
    "event DonationReceived(address indexed donor, uint256 amount, uint256 totalRaised)",
    "event FundsWithdrawn(address indexed creator, uint256 creatorAmount, uint256 platformFee)",
    "event RefundIssued(address indexed donor, uint256 amount)",
];

// Only the ERC-20 functions needed for the USDC approval + balance check flow
export const USDC_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
];
