import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Contract, formatUnits, parseUnits } from "ethers";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useWallet } from "../hooks/useWallet";
import { useCurrency } from "../hooks/useCurrency";
import { CAMPAIGN_ABI, USDC_ABI } from "../contracts/abis";
import ProgressBar from "../components/ProgressBar";
import LoadingSpinner from "../components/LoadingSpinner";

// Donation has two on-chain steps: approve USDC spending, then call donate()
// This enum tracks which step we're on so the UI gives clear feedback
const DONATE_STEP = {
    IDLE:      "IDLE",
    APPROVING: "APPROVING",
    DONATING:  "DONATING",
    SUCCESS:   "SUCCESS",
};

export default function CampaignDetail() {
    const { id }   = useParams();
    const { user } = useAuth();
    const wallet   = useWallet();
    const { t }    = useTranslation();

    const [campaign,     setCampaign]     = useState(null);
    const [onChain,      setOnChain]      = useState(null); // live blockchain data
    const [donations,    setDonations]    = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState("");
    const [donateAmount, setDonateAmount] = useState("");
    const [donateStep,   setDonateStep]   = useState(DONATE_STEP.IDLE);
    const [donateError,  setDonateError]  = useState("");
    const [usdcBalance,  setUsdcBalance]  = useState(null);

    // Fetch campaign metadata from our API
    useEffect(() => {
        async function load() {
            setLoading(true);
            setError("");
            try {
                const [campRes, donRes] = await Promise.all([
                    client.get(`/api/campaigns/${id}`),
                    client.get(`/api/donations/${id}`),
                ]);
                setCampaign(campRes.data.campaign);
                setDonations(donRes.data.donations);
            } catch (err) {
                if (err.response?.status === 404) {
                    setError(t("campaign.error_not_found"));
                } else {
                    setError(t("campaign.error_load"));
                }
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id, t]);

    // Once we have the contract address, read live data from the blockchain
    useEffect(() => {
        if (!campaign?.contract_address || !wallet.provider) return;
        async function loadOnChain() {
            try {
                const contract = new Contract(campaign.contract_address, CAMPAIGN_ABI, wallet.provider);
                const [totalRaised, donorCount, withdrawn, isActive, timeRemaining] = await Promise.all([
                    contract.totalRaised(),
                    contract.donorCount(),
                    contract.withdrawn(),
                    contract.isActive(),
                    contract.timeRemaining(),
                ]);
                setOnChain({
                    totalRaised:   Number(formatUnits(totalRaised, 6)),
                    donorCount:    Number(donorCount),
                    withdrawn,
                    isActive,
                    timeRemaining: Number(timeRemaining),
                });

                // Load wallet's USDC balance
                if (wallet.account) {
                    const usdcAddress = await contract.usdc();
                    const usdc = new Contract(usdcAddress, USDC_ABI, wallet.provider);
                    const bal  = await usdc.balanceOf(wallet.account);
                    setUsdcBalance(Number(formatUnits(bal, 6)));
                }
            } catch {
                // On-chain read failed — possibly wrong network. Silently skip.
            }
        }
        loadOnChain();
    }, [campaign?.contract_address, wallet.provider, wallet.account]);

    async function handleDonate() {
        if (!donateAmount || isNaN(donateAmount) || Number(donateAmount) <= 0) {
            setDonateError(t("campaign.error_invalid_amount"));
            return;
        }
        if (!wallet.isConnected) { await wallet.connect(); return; }
        if (!wallet.isCorrectNetwork) { await wallet.switchToAmoy(); return; }

        setDonateError("");
        const amountInBaseUnits = parseUnits(donateAmount, 6);
        const signer            = await wallet.provider.getSigner();
        const campaignContract  = new Contract(campaign.contract_address, CAMPAIGN_ABI, signer);

        try {
            // Step 1: Approve USDC spending
            setDonateStep(DONATE_STEP.APPROVING);
            const usdcAddress  = await campaignContract.usdc();
            const usdcContract = new Contract(usdcAddress, USDC_ABI, signer);

            // Only approve if current allowance is insufficient
            const allowance = await usdcContract.allowance(wallet.account, campaign.contract_address);
            if (allowance < amountInBaseUnits) {
                const approveTx = await usdcContract.approve(campaign.contract_address, amountInBaseUnits);
                await approveTx.wait();
            }

            // Step 2: Donate
            setDonateStep(DONATE_STEP.DONATING);
            const donateTx = await campaignContract.donate(amountInBaseUnits);
            const receipt  = await donateTx.wait();

            // Step 3: Record in our database for display purposes
            await client.post("/api/donations", {
                campaign_id:  id,
                donor_wallet: wallet.account,
                amount_usdc:  Number(donateAmount),
                tx_hash:      receipt.hash,
            });

            setDonateStep(DONATE_STEP.SUCCESS);
            setDonateAmount("");

            // Refresh donation list
            const donRes = await client.get(`/api/donations/${id}`);
            setDonations(donRes.data.donations);
        } catch (err) {
            setDonateStep(DONATE_STEP.IDLE);
            if (err.code === 4001 || err.code === "ACTION_REJECTED") {
                setDonateError(t("campaign.error_tx_cancelled"));
            } else if (err.message?.includes("insufficient")) {
                setDonateError(t("campaign.error_insufficient"));
            } else {
                setDonateError(err.reason || err.message || t("campaign.error_tx_failed"));
            }
        }
    }

    const { formatUSDC } = useCurrency();
    const isCreator  = user && campaign?.creator?.id === user.id;
    const goalAmount = Number(campaign?.goal_amount ?? 0);

    // ─── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
                <p className="text-red-400 text-lg">{error}</p>
                <Link to="/" className="text-primary-400 hover:text-primary-300 underline text-sm">
                    {t("campaign.back_link")}
                </Link>
            </div>
        );
    }

    const totalRaised  = onChain?.totalRaised ?? 0;
    const localRaised  = formatUSDC(totalRaised);
    const localGoal    = formatUSDC(goalAmount);

    return (
        <div className="min-h-screen bg-gray-950">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <Link to="/" className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm mb-8 transition-colors">
                    {t("campaign.back_to_campaigns")}
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ── Left: campaign info ── */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        {campaign.image_url && (
                            <img
                                src={campaign.image_url}
                                alt={campaign.title}
                                className="w-full rounded-2xl object-cover max-h-80"
                            />
                        )}

                        <div>
                            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                                {campaign.category}
                            </span>
                            <h1 className="text-3xl font-bold text-white mt-1 leading-tight">
                                {campaign.title}
                            </h1>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>
                                {t("campaign.by_label")}{" "}
                                <span className="text-gray-300">{campaign.creator?.country || "Anonymous"}</span>
                            </span>
                            <span>•</span>
                            <span>
                                {t("campaign.deadline_label")}:{" "}
                                <span className="text-gray-300">
                                    {new Date(campaign.deadline).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                                </span>
                            </span>
                        </div>

                        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {campaign.description}
                        </p>

                        {/* Blockchain progress (only if contract is deployed) */}
                        {campaign.contract_address && onChain ? (
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                                <ProgressBar raised={totalRaised} goal={goalAmount} className="mb-4" />

                                {/* Raised / goal with local currency */}
                                <div className="flex justify-between text-sm mb-4">
                                    <div>
                                        <p className="text-white font-semibold">
                                            {totalRaised.toLocaleString()} USDC {t("campaign.raised_label")}
                                        </p>
                                        {localRaised && (
                                            <p className="text-xs text-gray-600">≈ {localRaised}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-gray-400">
                                            {t("campaign.of_label")} {goalAmount.toLocaleString()} USDC
                                        </p>
                                        {localGoal && (
                                            <p className="text-xs text-gray-600">≈ {localGoal}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-center">
                                    <div className="bg-gray-800 rounded-lg py-3">
                                        <p className="text-2xl font-bold text-white">{onChain.donorCount}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{t("campaign.donors_label")}</p>
                                    </div>
                                    <div className="bg-gray-800 rounded-lg py-3">
                                        <p className="text-2xl font-bold text-white">
                                            {onChain.timeRemaining > 0
                                                ? `${Math.ceil(onChain.timeRemaining / 86400)}d`
                                                : t("campaign.ended_label")}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">{t("campaign.remaining_label")}</p>
                                    </div>
                                </div>
                                {campaign.contract_address && (
                                    <a
                                        href={`${import.meta.env.VITE_POLYGON_BLOCK_EXPLORER}/address/${campaign.contract_address}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-center mt-3 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                                    >
                                        {t("campaign.view_contract")}
                                    </a>
                                )}
                            </div>
                        ) : !campaign.contract_address ? (
                            <div className="bg-yellow-900/30 border border-yellow-800/50 rounded-xl p-4 text-yellow-400 text-sm">
                                {t("campaign.not_deployed")}
                            </div>
                        ) : (
                            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                                <p className="text-gray-500 text-sm">{t("campaign.blockchain_loading")}</p>
                            </div>
                        )}

                        {/* Recent donors */}
                        {donations.length > 0 && (
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-3">{t("campaign.recent_donors")}</h2>
                                <div className="flex flex-col gap-2">
                                    {donations.slice(0, 10).map((d) => (
                                        <div key={d.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                                            <span className="text-sm font-mono text-gray-400">
                                                {d.donor_wallet.slice(0, 6)}…{d.donor_wallet.slice(-4)}
                                            </span>
                                            <span className="text-sm font-semibold text-white">
                                                {Number(d.amount_usdc).toLocaleString()} USDC
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Right: donate panel ── */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">
                            <h2 className="text-xl font-bold text-white">{t("campaign.donate_panel_title")}</h2>

                            {/* Creator actions */}
                            {isCreator && (
                                <div className="p-3 bg-gray-800 rounded-lg text-sm text-gray-400">
                                    {t("campaign.is_creator_note")}
                                    {onChain?.isActive === false && onChain?.withdrawn === false && (
                                        onChain?.totalRaised >= goalAmount ? (
                                            <p className="text-green-400 mt-1">{t("campaign.goal_met")}</p>
                                        ) : (
                                            <p className="text-orange-400 mt-1">{t("campaign.goal_not_met")}</p>
                                        )
                                    )}
                                </div>
                            )}

                            {/* Donate form */}
                            {!isCreator && campaign.contract_address && onChain?.isActive && (
                                <>
                                    {usdcBalance !== null && (
                                        <p className="text-xs text-gray-500">
                                            {t("campaign.your_balance")}{" "}
                                            <span className="text-gray-300">{usdcBalance.toLocaleString()} USDC</span>
                                        </p>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                            {t("campaign.amount_label")}
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={donateAmount}
                                            onChange={(e) => { setDonateAmount(e.target.value); setDonateError(""); setDonateStep(DONATE_STEP.IDLE); }}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white
                                                       focus:outline-none focus:border-primary-500 transition-colors"
                                            placeholder={t("campaign.amount_placeholder")}
                                        />
                                    </div>

                                    {donateError && (
                                        <p className="text-red-400 text-sm">{donateError}</p>
                                    )}

                                    {donateStep === DONATE_STEP.SUCCESS ? (
                                        <div className="p-3 bg-green-900/40 border border-green-800 rounded-lg text-green-300 text-sm text-center">
                                            {t("campaign.donate_success")}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleDonate}
                                            disabled={donateStep !== DONATE_STEP.IDLE}
                                            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-60 disabled:cursor-not-allowed
                                                       text-white font-semibold py-3 rounded-xl transition-colors"
                                        >
                                            {!wallet.isConnected
                                                ? t("campaign.connect_to_donate")
                                                : !wallet.isCorrectNetwork
                                                ? t("campaign.switch_network")
                                                : donateStep === DONATE_STEP.APPROVING
                                                ? t("campaign.step_approving")
                                                : donateStep === DONATE_STEP.DONATING
                                                ? t("campaign.step_donating")
                                                : t("campaign.donate_button")}
                                        </button>
                                    )}

                                    <p className="text-xs text-gray-600 text-center">
                                        {t("campaign.donate_held_note")}
                                    </p>
                                </>
                            )}

                            {!campaign.contract_address && (
                                <p className="text-gray-600 text-sm">{t("campaign.not_available")}</p>
                            )}

                            {onChain && !onChain.isActive && (
                                <div className="text-center text-gray-500 text-sm">
                                    {onChain.withdrawn
                                        ? t("campaign.funds_withdrawn")
                                        : t("campaign.campaign_ended")}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
