const { ethers } = require("ethers");

// Minimal ABIs — only the functions we actually call from the backend
const FACTORY_ABI = [
    "function createCampaign(string memory title, uint256 goalAmount, uint256 deadline) external returns (address)",
    "event CampaignCreated(address indexed campaignAddress, address indexed creator, string title, uint256 goalAmount, uint256 deadline)",
];

const CAMPAIGN_ABI = [
    "function donate(uint256 amount) external",
    "function withdraw() external",
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
];

// Returns true only when all required env vars are present and look valid.
// Callers use this to skip blockchain ops gracefully during early setup.
function isConfigured() {
    const key     = process.env.PLATFORM_PRIVATE_KEY;
    const rpc     = process.env.POLYGON_AMOY_RPC_URL;
    const factory = process.env.CAMPAIGN_FACTORY_ADDRESS;
    return !!(
        key && key.length >= 32 &&
        rpc &&
        factory && !factory.startsWith("fill") && factory.startsWith("0x")
    );
}

// Builds a fresh ethers.Wallet connected to Polygon Amoy on every call.
// Avoids stale provider state between retries.
function getSigner() {
    const privateKey = process.env.PLATFORM_PRIVATE_KEY;
    const rpcUrl     = process.env.POLYGON_AMOY_RPC_URL;
    if (!privateKey) throw new Error("PLATFORM_PRIVATE_KEY is not set");
    if (!rpcUrl)     throw new Error("POLYGON_AMOY_RPC_URL is not set");

    // NEVER log the private key — only the derived address is safe to show
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet   = new ethers.Wallet(privateKey, provider);
    console.log(`[platformWallet] signer: ${wallet.address}`);
    return wallet;
}

// ─── deployContract ───────────────────────────────────────────────────────────
// Calls CampaignFactory.createCampaign() and returns the new contract address.
// goalAmount is a human-readable number (e.g. 5000 = 5000 USDC).
async function deployContract({ title, goalAmount, deadline }) {
    const signer         = getSigner();
    const factoryAddress = process.env.CAMPAIGN_FACTORY_ADDRESS;
    if (!factoryAddress) throw new Error("CAMPAIGN_FACTORY_ADDRESS is not set");

    const factory         = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
    const goalInBaseUnits = ethers.parseUnits(String(goalAmount), 6);
    const deadlineUnix    = Math.floor(new Date(deadline).getTime() / 1000);

    const tx      = await factory.createCampaign(title, goalInBaseUnits, deadlineUnix);
    const receipt = await tx.wait();

    const iface    = factory.interface;
    const eventLog = receipt.logs.find((log) => {
        try { return iface.parseLog(log)?.name === "CampaignCreated"; }
        catch { return false; }
    });
    if (!eventLog) throw new Error("CampaignCreated event not found in receipt");

    const contractAddress = iface.parseLog(eventLog).args[0];
    console.log(`[platformWallet] deployed contract: ${contractAddress}`);
    return { contractAddress, txHash: receipt.hash };
}

// ─── donate ───────────────────────────────────────────────────────────────────
// Steps:
//   1. platform wallet approves USDC spend to the campaign contract
//   2. platform wallet calls campaign.donate(amount)
// amountUsdc is a human-readable number (e.g. 10 = 10 USDC).
async function donate({ campaignAddress, amountUsdc }) {
    const signer      = getSigner();
    const usdcAddress = process.env.USDC_CONTRACT_ADDRESS;
    if (!usdcAddress) throw new Error("USDC_CONTRACT_ADDRESS is not set");

    const usdc     = new ethers.Contract(usdcAddress, ERC20_ABI, signer);
    const campaign = new ethers.Contract(campaignAddress, CAMPAIGN_ABI, signer);

    const amountInBaseUnits = ethers.parseUnits(String(amountUsdc), 6);

    const approveTx = await usdc.approve(campaignAddress, amountInBaseUnits);
    await approveTx.wait();
    console.log(`[platformWallet] approved ${amountUsdc} USDC to ${campaignAddress}`);

    const donateTx = await campaign.donate(amountInBaseUnits);
    const receipt  = await donateTx.wait();
    console.log(`[platformWallet] donated ${amountUsdc} USDC → tx: ${receipt.hash}`);

    return { txHash: receipt.hash };
}

// ─── withdraw ─────────────────────────────────────────────────────────────────
// Calls campaign.withdraw().
// The platform wallet is the on-chain creator (it deployed the campaign),
// so this succeeds once deadline has passed and goal is met.
async function withdraw({ campaignAddress }) {
    const signer   = getSigner();
    const campaign = new ethers.Contract(campaignAddress, CAMPAIGN_ABI, signer);

    const tx      = await campaign.withdraw();
    const receipt = await tx.wait();
    console.log(`[platformWallet] withdrew from ${campaignAddress} → tx: ${receipt.hash}`);

    return { txHash: receipt.hash };
}

module.exports = { isConfigured, deployContract, donate, withdraw };
