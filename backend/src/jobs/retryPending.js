const prisma         = require("../lib/prisma");
const platformWallet = require("../services/platformWallet");

const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function retryPendingCampaigns() {
    const pending = await prisma.campaign.findMany({
        where:   { deployment_status: "PENDING" },
        take:    10,
        orderBy: { created_at: "asc" },
    });

    for (const campaign of pending) {
        try {
            console.log(`[retryPending] Deploying campaign ${campaign.id}…`);
            const { contractAddress, txHash } = await platformWallet.deployContract({
                title:      campaign.title,
                goalAmount: Number(campaign.goal_amount),
                deadline:   campaign.deadline,
            });
            await prisma.campaign.update({
                where: { id: campaign.id },
                data: {
                    contract_address:  contractAddress,
                    contract_tx_hash:  txHash,
                    deployment_status: "DEPLOYED",
                },
            });
            console.log(`[retryPending] Campaign ${campaign.id} deployed → ${contractAddress}`);
        } catch (err) {
            console.error(`[retryPending] Campaign ${campaign.id} deploy failed: ${err.message}`);
        }
    }
}

async function retryPendingDonations() {
    const pending = await prisma.donation.findMany({
        where:   { tx_status: "PENDING" },
        include: { campaign: { select: { contract_address: true } } },
        take:    10,
        orderBy: { created_at: "asc" },
    });

    for (const donation of pending) {
        if (!donation.campaign.contract_address) {
            continue; // Campaign not deployed yet — will retry next cycle
        }
        try {
            console.log(`[retryPending] Processing donation ${donation.id}…`);
            const { txHash } = await platformWallet.donate({
                campaignAddress: donation.campaign.contract_address,
                amountUsdc:      Number(donation.amount_usdc),
            });
            await prisma.donation.update({
                where: { id: donation.id },
                data: {
                    tx_hash:     txHash,
                    tx_status:   "CONFIRMED",
                    donor_wallet: process.env.PLATFORM_WALLET_ADDRESS || null,
                },
            });
            console.log(`[retryPending] Donation ${donation.id} confirmed → ${txHash}`);
        } catch (err) {
            console.error(`[retryPending] Donation ${donation.id} failed: ${err.message}`);
        }
    }
}

async function retryPendingWithdrawals() {
    const pending = await prisma.withdrawal.findMany({
        where:   { tx_status: "PENDING" },
        include: { campaign: { select: { id: true, contract_address: true } } },
        take:    10,
        orderBy: { created_at: "asc" },
    });

    for (const withdrawal of pending) {
        if (!withdrawal.campaign.contract_address) {
            continue;
        }
        try {
            console.log(`[retryPending] Processing withdrawal ${withdrawal.id}…`);
            const { txHash } = await platformWallet.withdraw({
                campaignAddress: withdrawal.campaign.contract_address,
            });
            await prisma.$transaction([
                prisma.withdrawal.update({
                    where: { id: withdrawal.id },
                    data:  { tx_hash: txHash, tx_status: "CONFIRMED" },
                }),
                prisma.campaign.update({
                    where: { id: withdrawal.campaign.id },
                    data:  { status: "WITHDRAWN" },
                }),
            ]);
            console.log(`[retryPending] Withdrawal ${withdrawal.id} confirmed → ${txHash}`);
        } catch (err) {
            console.error(`[retryPending] Withdrawal ${withdrawal.id} failed: ${err.message}`);
        }
    }
}

async function runOnce() {
    if (!platformWallet.isConfigured()) {
        console.log("[retryPending] Platform wallet not configured — skipping");
        return;
    }
    console.log("[retryPending] Running retry cycle…");
    await Promise.allSettled([
        retryPendingCampaigns(),
        retryPendingDonations(),
        retryPendingWithdrawals(),
    ]);
}

function startRetryJob() {
    // Run immediately on startup
    runOnce().catch((err) => console.error("[retryPending] startup error:", err.message));

    const timer = setInterval(
        () => runOnce().catch((err) => console.error("[retryPending] interval error:", err.message)),
        RETRY_INTERVAL_MS
    );
    // unref() lets the process exit cleanly even if this timer is still pending
    timer.unref();
    return timer;
}

module.exports = { startRetryJob };
