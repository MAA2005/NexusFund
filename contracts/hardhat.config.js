require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Fail loudly if required vars are missing when NOT running local tasks.
// We allow missing vars during `hardhat compile` and `hardhat test` (local only),
// but block deployment commands so you never accidentally deploy with a wrong key.
const isDeployment = process.argv.some((arg) =>
  arg.includes("deploy") || arg.includes("verify")
);

if (isDeployment) {
  const required = ["PRIVATE_KEY", "POLYGON_AMOY_RPC_URL", "POLYGONSCAN_API_KEY"];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(
        `\n\nMissing required environment variable: ${key}\n` +
        `Copy contracts/.env.example to contracts/.env and fill it in.\n`
      );
    }
  }
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      // Optimizer reduces deployed bytecode size and gas costs.
      // 200 runs is the standard balance between deploy cost and call cost.
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // Local Hardhat network — used for all tests, no real MATIC needed
    hardhat: {
      chainId: 31337,
    },

    // Polygon Amoy testnet — replaces deprecated Mumbai (shut down April 2024)
    amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology/",
      accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 80002,
      gasPrice: "auto",
    },
  },

  // Contract verification on Polygonscan (makes contract source code public)
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },

  // Gas cost reporting — only enabled when REPORT_GAS=true to avoid slowdowns
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
