import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useCurrency } from "../hooks/useCurrency";
import LoadingSpinner from "../components/LoadingSpinner";

const STATUS_STYLES = {
    ACTIVE:     "bg-green-900/50 text-green-400",
    SUCCESSFUL: "bg-blue-900/50  text-blue-400",
    FAILED:     "bg-red-900/50   text-red-400",
    WITHDRAWN:  "bg-gray-800     text-gray-400",
};

function WalletCard() {
    const { t } = useTranslation();
    const { formatUSDC } = useCurrency();
    const [data,    setData]    = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        client.get("/api/wallet/balance")
            .then((r) => setData(r.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    const localBalance = data ? formatUSDC(data.usdc_balance) : null;

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{t("dashboard.wallet_label")}</p>
            {loading ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <LoadingSpinner size="sm" /> {t("dashboard.wallet_loading")}
                </div>
            ) : !data ? (
                <p className="text-sm text-red-400">{t("dashboard.wallet_error")}</p>
            ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">{t("dashboard.wallet_address")}</p>
                        <p className="font-mono text-sm text-gray-300 break-all">{data.wallet_address}</p>
                    </div>
                    <div className="sm:text-end">
                        <p className="text-xs text-gray-500 mb-1">{t("dashboard.wallet_balance")}</p>
                        <p className="text-2xl font-bold text-white">
                            ${Number(data.usdc_balance).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">{data.usdc_balance} USDC</p>
                        {localBalance && (
                            <p className="text-xs text-gray-500 mt-0.5">≈ {localBalance}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Dashboard() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [tab,       setTab]       = useState("campaigns");
    const [campaigns, setCampaigns] = useState([]);
    const [donations, setDonations] = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState("");

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError("");
            try {
                const [campRes, donRes] = await Promise.all([
                    client.get("/api/campaigns/mine"),
                    client.get("/api/donations/mine").catch(() => ({ data: { donations: [] } })),
                ]);
                setCampaigns(campRes.data.campaigns);
                setDonations(donRes.data.donations || []);
            } catch {
                setError(t("dashboard.load_error"));
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [t]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white">{t("dashboard.title")}</h1>
                        <p className="text-gray-400 mt-1">{user.email}</p>
                    </div>
                    <Link
                        to="/create"
                        className="inline-block bg-primary-600 hover:bg-primary-500 text-white font-semibold
                                   px-5 py-2.5 rounded-xl transition-colors text-sm"
                    >
                        {t("dashboard.new_campaign")}
                    </Link>
                </div>

                {error && (
                    <div role="alert" className="mb-6 p-4 rounded-xl bg-red-900/40 border border-red-800 text-red-300 text-sm">
                        {error}
                    </div>
                )}

                <WalletCard />

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit">
                    {["campaigns", "donations"].map((tab_key) => (
                        <button
                            key={tab_key}
                            onClick={() => setTab(tab_key)}
                            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors
                                ${tab === tab_key ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}
                        >
                            {tab_key === "campaigns"
                                ? t("dashboard.tab_campaigns", { count: campaigns.length })
                                : t("dashboard.tab_donations", { count: donations.length })}
                        </button>
                    ))}
                </div>

                {/* My Campaigns */}
                {tab === "campaigns" && (
                    campaigns.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-gray-500 text-lg mb-4">{t("dashboard.no_campaigns")}</p>
                            <Link to="/create" className="text-primary-400 hover:text-primary-300 underline text-sm">
                                {t("dashboard.create_first")}
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {campaigns.map((c) => (
                                <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[c.status]}`}>
                                                {t(`campaign.status_${c.status.toLowerCase()}`)}
                                            </span>
                                            <span className="text-xs text-gray-600 capitalize">{c.category}</span>
                                        </div>
                                        <Link to={`/campaign/${c.id}`} className="text-white font-semibold hover:text-primary-400 transition-colors truncate block">
                                            {c.title}
                                        </Link>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {t("dashboard.goal")}: {Number(c.goal_amount).toLocaleString()} USDC
                                            {" · "}
                                            {c._count?.donations ?? 0} {t("dashboard.donors")}
                                            {" · "}
                                            {t("dashboard.deadline")}: {new Date(c.deadline).toLocaleDateString()}
                                        </p>
                                        {!c.contract_address && (
                                            <p className="text-xs text-yellow-600 mt-1">{t("dashboard.contract_warning")}</p>
                                        )}
                                    </div>
                                    <Link
                                        to={`/campaign/${c.id}`}
                                        className="flex-shrink-0 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500
                                                   px-4 py-2 rounded-lg transition-colors"
                                    >
                                        {t("dashboard.view")}
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {/* My Donations */}
                {tab === "donations" && (
                    donations.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-gray-500 text-lg mb-4">{t("dashboard.no_donations")}</p>
                            <Link to="/" className="text-primary-400 hover:text-primary-300 underline text-sm">
                                {t("dashboard.explore")}
                            </Link>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {donations.map((d) => (
                                <div key={d.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-white font-semibold">
                                            {Number(d.amount_usdc).toLocaleString()} USDC
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {new Date(d.created_at).toLocaleDateString()}
                                            {" · "}
                                            <span className="font-mono">
                                                {d.tx_hash.slice(0, 10)}…{d.tx_hash.slice(-6)}
                                            </span>
                                        </p>
                                    </div>
                                    <a
                                        href={`${import.meta.env.VITE_POLYGON_BLOCK_EXPLORER}/tx/${d.tx_hash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        {t("dashboard.polygonscan")}
                                    </a>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
