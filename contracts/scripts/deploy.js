const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Deployment script for CampaignFactory on Polygon Amoy testnet.
 *
 * Prerequisites:
 *  1. contracts/.env is filled in (copy from .env.example)
 *  2. Deployer wallet has Amoy testnet MATIC (faucet.polygon.technology)
 *  3. USDC_ADDRESS_AMOY is the verified USDC contract on Amoy
 *
 * Run:
 *  npx hardhat run scripts/deploy.js --network amoy
 */
async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("═══════════════════════════════════════════════════════");
    console.log("         NexusFund — CampaignFactory Deployment        ");
    console.log("═══════════════════════════════════════════════════════");
    console.log("Network:          Polygon Amoy Testnet");
    console.log("Deployer address:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", ethers.formatEther(balance), "MATIC");

    if (balance === 0n) {
        throw new Error(
            "\nDeployer has 0 MATIC.\n" +
            "Get testnet MATIC at: https://faucet.polygon.technology/\n" +
            "Select 'Polygon Amoy', paste your wallet address, and request funds."
        );
    }

    const usdcAddress = process.env.USDC_ADDRESS_AMOY;
    const feeReceiver = process.env.PLATFORM_FEE_RECEIVER;

    // These were already validated by hardhat.config.js — but double-check here
    // so the error message is clear in the deployment log
    if (!usdcAddress || usdcAddress.startsWith("your_")) {
        throw new Error("USDC_ADDRESS_AMOY is not set in contracts/.env");
    }
    if (!feeReceiver || feeReceiver.startsWith("your_")) {
        throw new Error("PLATFORM_FEE_RECEIVER is not set in contracts/.env");
    }

    console.log("\nDeployment parameters:");
    console.log("  USDC address:     ", usdcAddress);
    console.log("  Fee receiver:     ", feeReceiver);
    console.log("  Platform fee:      2.5% on successful withdrawals");
    console.log("\nDeploying CampaignFactory...");

    const CampaignFactory = await ethers.getContractFactory("CampaignFactory");
    const factory = await CampaignFactory.deploy(usdcAddress, feeReceiver);
    await factory.waitForDeployment();

    const factoryAddress = await factory.getAddress();
    const txHash         = factory.deploymentTransaction().hash;

    console.log("\n✓ CampaignFactory deployed successfully");
    console.log("  Contract address:", factoryAddress);
    console.log("  Transaction hash:", txHash);
    console.log("  Explorer URL:     https://amoy.polygonscan.com/address/" + factoryAddress);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("REQUIRED: Complete these steps after deployment");
    console.log("═══════════════════════════════════════════════════════");
    console.log("\n1. Add to backend/.env:");
    console.log(`   CAMPAIGN_FACTORY_ADDRESS=${factoryAddress}`);
    console.log("\n2. Add to frontend/.env:");
    console.log(`   VITE_CAMPAIGN_FACTORY_ADDRESS=${factoryAddress}`);
    console.log("\n3. Verify contract source code on Polygonscan.");
    console.log("   Wait ~30 seconds for the transaction to be indexed, then run:");
    console.log(`\n   npx hardhat verify --network amoy ${factoryAddress} "${usdcAddress}" "${feeReceiver}"`);
    console.log("\n   Verification makes your contract trustworthy to donors —");
    console.log("   they can read the source code and confirm funds are safe.");
    console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((error) => {
    console.error("\n✗ Deployment failed:", error.message);
    process.exitCode = 1;
});
