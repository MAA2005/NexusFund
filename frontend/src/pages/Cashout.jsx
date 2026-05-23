import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { getGuideForCountry, GUIDES, GENERIC_GUIDE } from "../lib/cashoutGuides";

const BINANCE_P2P_BASE = "https://p2p.binance.com/en/trade/sell/USDC";

function binanceUrl(fiatCode) {
    return fiatCode
        ? `${BINANCE_P2P_BASE}?fiat=${fiatCode}`
        : BINANCE_P2P_BASE;
}

function StepList({ steps }) {
    return (
        <ol className="flex flex-col gap-3 mt-4">
            {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600/20 border border-primary-500/30
                                     text-primary-400 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                    </span>
                    <p className="text-sm text-gray-300 leading-relaxed">{step}</p>
                </li>
            ))}
        </ol>
    );
}

function MethodCard({ method, fiatCode }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {/* Method header */}
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-start hover:bg-gray-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{method.icon}</span>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-semibold text-sm">{method.name}</span>
                            {method.badge && (
                                <span className="text-xs bg-primary-600/20 border border-primary-500/30 text-primary-400 px-2 py-0.5 rounded-full">
                                    {method.badge}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <svg
                    className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="px-5 pb-5 border-t border-gray-800">
                    <StepList steps={method.steps} />

                    {/* Tip */}
                    {method.tip && (
                        <div className="mt-4 flex gap-2 p-3 bg-blue-900/20 border border-blue-800/40 rounded-lg">
                            <span className="text-blue-400 text-sm flex-shrink-0">💡</span>
                            <p className="text-xs text-blue-300 leading-relaxed">{method.tip}</p>
                        </div>
                    )}

                    {/* Warning */}
                    {method.warning && (
                        <div className="mt-4 flex gap-2 p-3 bg-yellow-900/20 border border-yellow-800/40 rounded-lg">
                            <span className="text-yellow-400 text-sm flex-shrink-0">⚠️</span>
                            <p className="text-xs text-yellow-300 leading-relaxed">{method.warning}</p>
                        </div>
                    )}

                    {/* Binance P2P button — shown on every method that uses P2P */}
                    {method.name.toLowerCase().includes("binance") && (
                        <a
                            href={binanceUrl(fiatCode)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-5 flex items-center justify-center gap-2 w-full bg-yellow-500 hover:bg-yellow-400
                                       text-gray-950 font-semibold text-sm py-3 rounded-xl transition-colors"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                            </svg>
                            Open Binance P2P — Sell USDC
                            {fiatCode && <span className="opacity-70">({fiatCode})</span>}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

function GuideSection({ guide }) {
    return (
        <div className="flex flex-col gap-4">
            {guide.methods.map((method, i) => (
                <MethodCard key={i} method={method} fiatCode={guide.fiatCode} />
            ))}
        </div>
    );
}

export default function Cashout() {
    const { t } = useTranslation();
    const { user, isAuthenticated } = useAuth();

    const guide        = getGuideForCountry(user?.country);
    const isPersonal   = guide.id !== "generic";
    const isGeneric    = guide.id === "generic";

    // Country switcher — lets logged-out users or mismatched users browse guides
    const [selectedId, setSelectedId] = useState(guide.id);
    const allGuides    = [...GUIDES, GENERIC_GUIDE];
    const activeGuide  = allGuides.find((g) => g.id === selectedId) ?? guide;

    return (
        <div className="min-h-screen bg-gray-950">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

                {/* Header */}
                <div className="mb-10">
                    <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                        ← {t("nav.explore")}
                    </Link>
                    <h1 className="text-3xl font-bold text-white mt-4 mb-2">
                        {t("cashout.title")}
                    </h1>
                    <p className="text-gray-400">{t("cashout.subtitle")}</p>
                </div>

                {/* Login nudge for guests */}
                {!isAuthenticated && (
                    <div className="mb-8 p-4 bg-primary-900/20 border border-primary-800/40 rounded-xl flex items-start gap-3">
                        <span className="text-primary-400 text-lg flex-shrink-0">ℹ️</span>
                        <p className="text-sm text-primary-300">
                            {t("cashout.login_note")}{" "}
                            <Link to="/login" className="underline hover:text-white transition-colors">
                                {t("nav.login")}
                            </Link>
                        </p>
                    </div>
                )}

                {/* Active guide badge */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 uppercase tracking-widest">
                            {isAuthenticated && isPersonal ? t("cashout.your_guide") : t("cashout.viewing_guide")}
                        </span>
                        <span className="text-sm font-semibold text-white bg-gray-800 border border-gray-700 px-3 py-1 rounded-full">
                            {activeGuide.title}
                        </span>
                    </div>

                    {/* Universal safety warning */}
                    <div className="flex items-center gap-1.5 text-xs text-yellow-600">
                        <span>⚠️</span>
                        <span>{t("cashout.safety_note")}</span>
                    </div>
                </div>

                {/* Guide content */}
                <GuideSection guide={activeGuide} />

                {/* Country switcher */}
                <div className="mt-10 pt-8 border-t border-gray-800">
                    <p className="text-sm text-gray-500 mb-4">{t("cashout.switch_country")}</p>
                    <div className="flex flex-wrap gap-2">
                        {allGuides.map((g) => (
                            <button
                                key={g.id}
                                onClick={() => setSelectedId(g.id)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors
                                    ${selectedId === g.id
                                        ? "bg-primary-600 text-white"
                                        : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                                    }`}
                            >
                                {g.title}
                            </button>
                        ))}
                    </div>
                </div>

                {/* General safety box */}
                <div className="mt-8 p-5 bg-gray-900 border border-gray-800 rounded-xl">
                    <h3 className="text-white font-semibold mb-3">🔒 {t("cashout.safety_title")}</h3>
                    <ul className="flex flex-col gap-2">
                        {[
                            t("cashout.safety_1"),
                            t("cashout.safety_2"),
                            t("cashout.safety_3"),
                            t("cashout.safety_4"),
                        ].map((tip, i) => (
                            <li key={i} className="flex gap-2 text-sm text-gray-400">
                                <span className="text-green-500 flex-shrink-0">✓</span>
                                {tip}
                            </li>
                        ))}
                    </ul>
                </div>

            </div>
        </div>
    );
}
