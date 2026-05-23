import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/LoadingSpinner";

const STATUS_STYLES = {
    ACTIVE:     "bg-green-900/50 text-green-400",
    SUCCESSFUL: "bg-blue-900/50  text-blue-400",
    FAILED:     "bg-red-900/50   text-red-400",
    WITHDRAWN:  "bg-gray-800     text-gray-400",
};

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
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[c.status]}`}>
                                                {t(`campaign.status_${c.status.toLowerCase()}`)}
                                            </span>
                                            <span className="text-xs text-gray-600 capitalize">{c.category}</span>
                                        </div>
                                        <Link to={`/campaign/${c.id}`} className="text-white font-semibold hover:text-primary-400 transition-colors truncate block">
                                            {c.title}
                                        </Link>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {t("dashboard.goal")}: ${Number(c.goal_amount).toLocaleString()}
                                            {" · "}
                                            {c._count?.donations ?? 0} {t("dashboard.donors")}
                                            {" · "}
                                            {t("dashboard.deadline")}: {new Date(c.deadline).toLocaleDateString()}
                                        </p>
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
                                        {d.campaign && (
                                            <Link to={`/campaign/${d.campaign.id}`} className="text-white font-semibold hover:text-primary-400 transition-colors truncate block">
                                                {d.campaign.title}
                                            </Link>
                                        )}
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {new Date(d.created_at).toLocaleDateString()}
                                            {" · "}
                                            <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                                                d.tx_status === "CONFIRMED" ? "bg-green-900/50 text-green-400" :
                                                d.tx_status === "FAILED"    ? "bg-red-900/50   text-red-400"   :
                                                "bg-yellow-900/50 text-yellow-400"
                                            }`}>
                                                {d.tx_status}
                                            </span>
                                        </p>
                                    </div>
                                    <p className="flex-shrink-0 text-lg font-bold text-white">
                                        ${Number(d.amount_usd).toFixed(2)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}