import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import CampaignCard from "../components/CampaignCard";
import LoadingSpinner from "../components/LoadingSpinner";

const CATEGORIES = ["all", "medical", "education", "disaster", "community", "business", "creative", "other"];

export default function Home() {
    const { t } = useTranslation();

    const [campaigns,   setCampaigns]   = useState([]);
    const [pagination,  setPagination]  = useState(null);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState("");
    const [search,      setSearch]      = useState("");
    const [category,    setCategory]    = useState("all");
    const [page,        setPage]        = useState(1);
    const [searchInput, setSearchInput] = useState("");

    const fetchCampaigns = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({ page, limit: 12, status: "ACTIVE" });
            if (search)              params.set("search",   search);
            if (category !== "all") params.set("category", category);

            const res = await client.get(`/api/campaigns?${params}`);
            setCampaigns(res.data.campaigns);
            setPagination(res.data.pagination);
        } catch {
            setError(t("home.load_error"));
        } finally {
            setLoading(false);
        }
    }, [page, search, category, t]);

    useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    function handleCategoryClick(cat) {
        setCategory(cat);
        setPage(1);
    }

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Hero */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
                <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                    {t("home.hero_title")}{" "}
                    <span className="text-primary-500">{t("home.hero_highlight")}</span>
                </h1>
                <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
                    {t("home.hero_subtitle")}
                </p>
                <Link
                    to="/create"
                    className="mt-8 inline-block bg-primary-600 hover:bg-primary-500 text-white font-semibold
                               px-8 py-3 rounded-xl transition-colors text-base"
                >
                    {t("home.start_campaign")}
                </Link>
            </section>

            {/* Search + filter */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
                <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t("home.search_placeholder")}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-5 py-3 text-white placeholder-gray-500
                               focus:outline-none focus:border-primary-500 transition-colors mb-5"
                />

                <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => handleCategoryClick(cat)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                                ${category === cat
                                    ? "bg-primary-600 text-white"
                                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                                }`}
                        >
                            {t(`home.cat_${cat}`)}
                        </button>
                    ))}
                </div>
            </section>

            {/* Campaign grid */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                {loading ? (
                    <div className="flex justify-center py-24">
                        <LoadingSpinner size="lg" />
                    </div>
                ) : error ? (
                    <div className="text-center py-24">
                        <p className="text-red-400 mb-4">{error}</p>
                        <button onClick={fetchCampaigns} className="text-primary-400 hover:text-primary-300 text-sm underline">
                            {t("home.try_again")}
                        </button>
                    </div>
                ) : campaigns.length === 0 ? (
                    <div className="text-center py-24">
                        <p className="text-gray-500 text-lg">{t("home.no_campaigns")}</p>
                        {(search || category !== "all") && (
                            <button
                                onClick={() => { setSearchInput(""); setSearch(""); setCategory("all"); }}
                                className="mt-3 text-primary-400 hover:text-primary-300 text-sm underline"
                            >
                                {t("home.clear_filters")}
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <p className="text-gray-500 text-sm mb-5">
                            {t(pagination?.total === 1 ? "home.campaigns_found_one" : "home.campaigns_found_other", { count: pagination?.total })}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {campaigns.map((c) => (
                                <CampaignCard key={c.id} campaign={c} />
                            ))}
                        </div>

                        {pagination && pagination.totalPages > 1 && (
                            <div className="flex justify-center items-center gap-3 mt-12">
                                <button
                                    onClick={() => setPage((p) => p - 1)}
                                    disabled={!pagination.hasPrev}
                                    className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg text-sm
                                               hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t("home.prev")}
                                </button>
                                <span className="text-gray-500 text-sm">
                                    {t("home.page_of", { page: pagination.page, total: pagination.totalPages })}
                                </span>
                                <button
                                    onClick={() => setPage((p) => p + 1)}
                                    disabled={!pagination.hasNext}
                                    className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg text-sm
                                               hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    {t("home.next")}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
