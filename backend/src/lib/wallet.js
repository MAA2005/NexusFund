const { ethers } = require("ethers");
const crypto     = require("crypto");

const ALGORITHM  = "aes-256-gcm";
const IV_BYTES   = 12;   // 96-bit IV — recommended for GCM
const TAG_BYTES  = 16;   // 128-bit auth tag

// Derive a 32-byte key from the env variable.
// We use createHash rather than raw substring so the env value can be any length.
function getEncryptionKey() {
    const secret = process.env.WALLET_ENCRYPTION_KEY;
    if (!secret) throw new Error("WALLET_ENCRYPTION_KEY is not set in environment.");
    return crypto.createHash("sha256").update(secret).digest();
}

// ─── Generate a new custodial wallet ─────────────────────────────────────────
// Returns { address, encryptedPrivateKey } — never exposes the raw private key.
function generateCustodialWallet() {
    const wallet            = ethers.Wallet.createRandom();
    const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey);
    return { address: wallet.address, encryptedPrivateKey };
}

// ─── Encrypt a private key ────────────────────────────────────────────────────
// Storage format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
function encryptPrivateKey(privateKey) {
    const key        = getEncryptionKey();
    const iv         = crypto.randomBytes(IV_BYTES);
    const cipher     = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
    const authTag    = cipher.getAuthTag();
    return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

// ─── Decrypt a private key ────────────────────────────────────────────────────
function decryptPrivateKey(stored) {
    const [ivHex, tagHex, ctHex] = stored.split(":");
    const key      = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const plain = Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]);
    return plain.toString("utf8");
}

// ─── Query USDC balance from Polygon RPC ─────────────────────────────────────
// Returns the balance as a human-readable string (e.g. "12.500000").
// Returns "0.000000" if the RPC or USDC contract is not configured.
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
];

async function getUsdcBalance(walletAddress) {
    const rpcUrl      = process.env.POLYGON_AMOY_RPC_URL;
    const usdcAddress = process.env.USDC_CONTRACT_ADDRESS;

    if (!rpcUrl || !usdcAddress || usdcAddress === "fill_in_after_deployment") {
        return "0.000000";
    }

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const usdc     = new ethers.Contract(usdcAddress, ERC20_ABI, provider);
        const [raw, decimals] = await Promise.all([
            usdc.balanceOf(walletAddress),
            usdc.decimals(),
        ]);
        return ethers.formatUnits(raw, decimals);
    } catch {
        return "0.000000";
    }
}

module.exports = { generateCustodialWallet, encryptPrivateKey, decryptPrivateKey, getUsdcBalance };
