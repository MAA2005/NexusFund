import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { useWallet } from "../hooks/useWallet";

const LANGUAGES = [
    { code: "en", label: "EN", name: "English" },
    { code: "ar", label: "AR", name: "العربية" },
    { code: "fr", label: "FR", name: "Français" },
    { code: "sw", label: "SW", name: "Kiswahili" },
];

function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

    function select(code) {
        i18n.changeLanguage(code);
        setOpen(false);
    }

    return (
        <div className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className="text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 px-2.5 py-1.5 rounded-lg
                           hover:border-gray-500 hover:text-white transition-colors flex items-center gap-1"
            >
                {current.label}
                <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <>
                    {/* Backdrop to close on outside click */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute end-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[130px]">
                        {LANGUAGES.map((lang) => (
                            <button
                                key={lang.code}
                                onClick={() => select(lang.code)}
                                className={`w-full text-start px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-3
                                    ${lang.code === i18n.language
                                        ? "bg-gray-800 text-white"
                                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                    }`}
                            >
                                <span>{lang.name}</span>
                                <span className="text-xs text-gray-600 font-mono">{lang.label}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default function Navbar() {
    const { t, i18n } = useTranslation();
    const { isAuthenticated, user, logout } = useAuth();
    const { isConnected, shortAccount, connect, connecting, isCorrectNetwork, switchToAmoy } = useWallet();
    const [mobileOpen, setMobileOpen] = useState(false);
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        setMobileOpen(false);
        navigate("/");
    }

    const linkClass = ({ isActive }) =>
        `text-sm font-medium transition-colors ${isActive ? "text-primary-400" : "text-gray-400 hover:text-white"}`;

    return (
        <nav className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">

                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xl font-bold tracking-tight text-white">
                            Nexus<span className="text-primary-500">Fund</span>
                        </span>
                    </Link>

                    {/* Desktop nav links */}
                    <div className="hidden md:flex items-center gap-6">
                        <NavLink to="/" className={linkClass} end>{t("nav.explore")}</NavLink>
                        {isAuthenticated && (
                            <>
                                <NavLink to="/create"    className={linkClass}>{t("nav.create")}</NavLink>
                                <NavLink to="/dashboard" className={linkClass}>{t("nav.dashboard")}</NavLink>
                                <NavLink to="/cashout"   className={linkClass}>{t("nav.cashout")}</NavLink>
                            </>
                        )}
                    </div>

                    {/* Desktop right side */}
                    <div className="hidden md:flex items-center gap-3">
                        <LanguageSwitcher />

                        {/* Wallet button */}
                        {isConnected ? (
                            isCorrectNetwork ? (
                                <span className="text-xs font-mono bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg">
                                    {shortAccount}
                                </span>
                            ) : (
                                <button
                                    onClick={switchToAmoy}
                                    className="text-xs bg-orange-900/50 border border-orange-700 text-orange-300 px-3 py-1.5 rounded-lg hover:bg-orange-900 transition-colors"
                                >
                                    {t("nav.wrong_network")}
                                </button>
                            )
                        ) : (
                            <button
                                onClick={connect}
                                disabled={connecting}
                                className="text-sm bg-gray-800 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg hover:border-primary-500 hover:text-white transition-colors disabled:opacity-50"
                            >
                                {connecting ? t("nav.connecting") : t("nav.connect_wallet")}
                            </button>
                        )}

                        {/* Auth buttons */}
                        {isAuthenticated ? (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500 hidden lg:block">{user?.email}</span>
                                <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-white transition-colors">
                                    {t("nav.logout")}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link to="/login"    className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5">
                                    {t("nav.login")}
                                </Link>
                                <Link to="/register" className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                                    {t("nav.signup")}
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Mobile hamburger */}
                    <button
                        onClick={() => setMobileOpen((o) => !o)}
                        className="md:hidden p-2 text-gray-400 hover:text-white"
                        aria-label="Toggle menu"
                    >
                        {mobileOpen ? (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile menu */}
            {mobileOpen && (
                <div className="md:hidden border-t border-gray-800 bg-gray-950 px-4 py-4 flex flex-col gap-4">
                    <NavLink to="/" className={linkClass} end onClick={() => setMobileOpen(false)}>{t("nav.explore")}</NavLink>
                    {isAuthenticated && (
                        <>
                            <NavLink to="/create"    className={linkClass} onClick={() => setMobileOpen(false)}>{t("nav.create")}</NavLink>
                            <NavLink to="/dashboard" className={linkClass} onClick={() => setMobileOpen(false)}>{t("nav.dashboard")}</NavLink>
                            <NavLink to="/cashout"   className={linkClass} onClick={() => setMobileOpen(false)}>{t("nav.cashout")}</NavLink>
                        </>
                    )}
                    <div className="pt-4 border-t border-gray-800 flex flex-col gap-3">
                        {/* Language switcher in mobile */}
                        <div className="flex gap-2 flex-wrap">
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => i18n.changeLanguage(lang.code)}
                                    className={`text-xs border px-2.5 py-1 rounded-lg transition-colors
                                        ${lang.code === i18n.language
                                            ? "border-primary-500 text-primary-400"
                                            : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                                        }`}
                                >
                                    {lang.label}
                                </button>
                            ))}
                        </div>

                        {isConnected ? (
                            <span className="text-xs font-mono text-gray-400">{shortAccount}</span>
                        ) : (
                            <button onClick={connect} disabled={connecting} className="text-sm text-start text-gray-400 hover:text-white disabled:opacity-50">
                                {connecting ? t("nav.connecting") : t("nav.connect_wallet")}
                            </button>
                        )}
                        {isAuthenticated ? (
                            <button onClick={handleLogout} className="text-sm text-start text-gray-400 hover:text-white">
                                {t("nav.logout")}
                            </button>
                        ) : (
                            <div className="flex gap-3">
                                <Link to="/login"    onClick={() => setMobileOpen(false)} className="text-sm text-gray-400 hover:text-white">{t("nav.login")}</Link>
                                <Link to="/register" onClick={() => setMobileOpen(false)} className="text-sm text-primary-400 hover:text-primary-300">{t("nav.signup")}</Link>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}
