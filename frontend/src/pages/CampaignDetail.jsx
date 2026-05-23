import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useCurrency } from "../hooks/useCurrency";
import ProgressBar from "../components/ProgressBar";
import LoadingSpinner from "../components/LoadingSpinner";

export default function CampaignDetail() {
    const { id }   = useParams();
    const { user } = useAuth();
    const { t }    = useTranslation();
    const { formatUSDC } = useCurrency();

    const [campaign,      setCampaign]      = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState("");

    // Donate state
    const [donateAmount,  setDonateAmount]  = useState("");
    const [donating,      setDonating]      = useState(false);
    const [donateError,   setDonateError]   = useState("");
    const [donateSuccess, setDonateSuccess] = useState("");

    // Withdraw state
    const [showWithdraw,  setShowWithdraw]  = useState(false);
    const [withdrawing,   setWithdrawing]   = useState(false);
    const [withdrawError, setWithdrawError] = useState("");
    const [withdrawDone,  setWithdrawDone]  = useState(false);

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError("");
            try {
                const res = await client.get(`/api/campaigns/${id}`);
                setCampaign(res.data.campaign);
            } catch (err) {
                setError(err.response?.status === 404 ? t("campaign.error_not_found") : t("campaign.error_load"));
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [id, t]);

    async function handleDonate(e) {
        e.preventDefault();
        const amt = Number(donateAmount);
        if (!donateAmount || isNaN(amt) || amt <= 0) {
            setDonateError(t("campaign.error_invalid_amount"));
            return;
        }
        setDonateError("");
        setDonating(true);
        try {
            await client.post("/api/donations", { campaign_id: id, amount_usd: amt });
            setDonateSuccess(t("campaign.donate_success_msg", { amount: amt.toFixed(2) }));
            setDonateAmount("");
            // Refresh to update donor count
            const res = await client.get(`/api/campaigns/${id}`);
            setCampaign(res.data.campaign);
        } catch (err) {
            setDonateError(err.response?.data?.error || t("campaign.error_generic"));
        } finally {
            setDonating(false);
        }
    }

    async function handleWithdraw() {
        setWithdrawing(true);
        setWithdrawError("");
        try {
            await client.post(`/api/campaigns/${id}/withdraw`);
            setWithdrawDone(true);
            setShowWithdraw(false);
            const res = await client.get(`/api/campaigns/${id}`);
            setCampaign(res.data.campaign);
        } catch (err) {
            setWithdrawError(err.response?.data?.error || t("campaign.error_generic"));
        } finally {
            setWithdrawing(false);
        }
    }

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

    const isCreator       = user && campaign?.creator?.id === user.id;
    const goalAmount      = Number(campaign?.goal_amount ?? 0);
    const totalRaisedUsdc = Number(campaign?.total_raised_usdc ?? 0);
    const totalRaisedUsd  = Number(campaign?.total_raised_usd  ?? 0);
    const donorCount      = campaign?._count?.donations ?? 0;
    const deadlinePassed  = new Date() > new Date(campaign?.deadline);
    const goalMet         = totalRaisedUsdc >= goalAmount;
    const localGoal       = formatUSDC(goalAmount);

    const daysLeft = Math.max(0, Math.ceil((new Date(campaign?.deadline) - Date.now()) / 86_400_000));

    // Withdrawal eligibility: creator, deadline passed, goal met, no existing withdrawal
    const canWithdraw = isCreator && deadlinePassed && goalMet && !campaign?.withdrawal;
    const alreadyWithdrawn = !!campaign?.withdrawal;

    const platformFee = totalRaisedUsdc * 0.025;
    const netAmount   = totalRaisedUsdc - platformFee;

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
                            <img src={campaign.image_url} alt={campaign.title}
                                className="w-full rounded-2xl object-cover max-h-80" />
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

                        {/* Progress section */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                            <ProgressBar raised={totalRaisedUsdc} goal={goalAmount} className="mb-4" />

                            <div className="flex justify-between text-sm mb-4">
                                <div>
                                    <p className="text-white font-semibold">
                                        ${totalRaisedUsd.toLocaleString()} {t("campaign.raised_label")}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-400">
                                        {t("campaign.of_label")} ${goalAmount.toLocaleString()}
                                    </p>
                                    {localGoal && <p className="text-xs text-gray-600">≈ {localGoal}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="bg-gray-800 rounded-lg py-3">
                                    <p className="text-2xl font-bold text-white">{donorCount}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{t("campaign.donors_label")}</p>
                                </div>
                                <div className="bg-gray-800 rounded-lg py-3">
                                    <p className="text-2xl font-bold text-white">
                                        {deadlinePassed ? t("campaign.ended_label") : `${daysLeft}d`}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">{t("campaign.remaining_label")}</p>
                                </div>
                            </div>
                        </div>

                        {/* Recent supporters */}
                        {campaign.donations?.length > 0 && (
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-3">{t("campaign.recent_supporters")}</h2>
                                <div className="flex flex-col gap-2">
                                    {campaign.donations.map((d) => (
                                        <div key={d.id} className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
                                            <span className="text-sm text-gray-400">
                                                {new Date(d.created_at).toLocaleDateString()}
                                            </span>
                                            <span className="text-sm font-semibold text-white">
                                                ${Number(d.amount_usd).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Right: donate / withdraw panel ── */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-24 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">
                            <h2 className="text-xl font-bold text-white">{t("campaign.donate_panel_title")}</h2>

                            {/* Withdraw success banner */}
                            {withdrawDone && (
                                <div className="p-3 bg-green-900/40 border border-green-800 rounded-lg text-green-300 text-sm text-center">
                                    {t("campaign.withdraw_success")}
                                </div>
                            )}

                            {/* Creator note */}
                            {isCreator && !withdrawDone && (
                                <div className="p-3 bg-gray-800 rounded-lg text-sm text-gray-400">
                                    {t("campaign.is_creator_note")}
                                    {deadlinePassed && goalMet && !alreadyWithdrawn && (
                                        <p className="text-green-400 mt-1">{t("campaign.goal_met")}</p>
                                    )}
                                    {deadlinePassed && !goalMet && (
                                        <p className="text-orange-400 mt-1">{t("campaign.goal_not_met")}</p>
                                    )}
                                </div>
                            )}

                            {/* Withdraw button (creator only, goal met, deadline passed) */}
                            {canWithdraw && !showWithdraw && !withdrawDone && (
                                <button
                                    onClick={() => setShowWithdraw(true)}
                                    className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition-colors"
                                >
                                    {t("campaign.withdraw_button")}
                                </button>
                            )}

                            {/* Withdraw modal */}
                            {showWithdraw && (
                                <div className="bg-gray-800 rounded-xl p-4 flex flex-col gap-3">
                                    <h3 className="text-white font-semibold">{t("campaign.withdraw_title")}</h3>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">{t("campaign.withdraw_raised")}</span>
                                        <span className="text-white">${totalRaisedUsdc.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">{t("campaign.withdraw_fee")}</span>
                                        <span className="text-orange-400">-${platformFee.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-semibold border-t border-gray-700 pt-2">
                                        <span className="text-gray-300">{t("campaign.withdraw_you_receive")}</span>
                                        <span className="text-green-400">${netAmount.toFixed(2)}</span>
                                    </div>
                                    {withdrawError && (
                                        <p className="text-red-400 text-xs">{withdrawError}</p>
                                    )}
                                    <div className="flex gap-2 mt-1">
                                        <button
                                            onClick={() => setShowWithdraw(false)}
                                            disabled={withdrawing}
                                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                                        >
                                            {t("campaign.cancel")}
                                        </button>
                                        <button
                                            onClick={handleWithdraw}
                                            disabled={withdrawing}
                                            className="flex-1 bg-green-700 hover:bg-green-600 text-white font-semibold py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                                        >
                                            {withdrawing ? t("campaign.withdraw_processing") : t("campaign.withdraw_confirm")}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Already withdrawn */}
                            {alreadyWithdrawn && !withdrawDone && (
                                <p className="text-gray-500 text-sm text-center">{t("campaign.funds_withdrawn")}</p>
                            )}

                            {/* Donate form — shown to non-creators when campaign is active */}
                            {!isCreator && !deadlinePassed && campaign.status === "ACTIVE" && (
                                <>
                                    {donateSuccess ? (
                                        <div className="p-3 bg-green-900/40 border border-green-800 rounded-lg text-green-300 text-sm text-center">
                                            {donateSuccess}
                                        </div>
                                    ) : (
                                        <form onSubmit={handleDonate} className="flex flex-col gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                                    {t("campaign.amount_label")}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="0.01"
                                                    value={donateAmount}
                                                    onChange={(e) => { setDonateAmount(e.target.value); setDonateError(""); }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white
                                                               focus:outline-none focus:border-primary-500 transition-colors"
                                                    placeholder={t("campaign.amount_placeholder")}
                                                />
                                            </div>

                                            {donateError && <p className="text-red-400 text-sm">{donateError}</p>}

                                            <button
                                                type="submit"
                                                disabled={donating}
                                                className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-60 disabled:cursor-not-allowed
                                                           text-white font-semibold py-3 rounded-xl transition-colors"
                                            >
                                                {donating ? t("campaign.donate_processing") : t("campaign.donate_button")}
                                            </button>

                                            <p className="text-xs text-gray-600 text-center">
                                                {t("campaign.donate_note")}
                                            </p>
                                        </form>
                                    )}
                                </>
                            )}

                            {/* Campaign ended, not creator */}
                            {!isCreator && deadlinePassed && (
                                <p className="text-gray-500 text-sm text-center">{t("campaign.campaign_ended")}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
