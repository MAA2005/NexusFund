import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
    const { t } = useTranslation();
    const { login } = useAuth();
    const navigate  = useNavigate();
    const location  = useLocation();

    const [form,    setForm]    = useState({ email: "", password: "" });
    const [error,   setError]   = useState("");
    const [loading, setLoading] = useState(false);

    const redirectTo = location.state?.from || "/";

    function handleChange(e) {
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
        setError("");
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await client.post("/api/auth/login", form);
            login(res.data.token, res.data.user);
            navigate(redirectTo, { replace: true });
        } catch (err) {
            const msg = err.response?.data?.error;
            setError(msg || t("login.server_error"));
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white">{t("login.title")}</h1>
                    <p className="text-gray-400 mt-2">{t("login.subtitle")}</p>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
                    {error && (
                        <div role="alert" className="mb-6 p-3 rounded-lg bg-red-900/40 border border-red-800 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                                {t("login.email")}
                            </label>
                            <input
                                id="email" name="email" type="email" autoComplete="email" required
                                value={form.email} onChange={handleChange}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500
                                           focus:outline-none focus:border-primary-500 transition-colors"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                                {t("login.password")}
                            </label>
                            <input
                                id="password" name="password" type="password" autoComplete="current-password" required
                                value={form.password} onChange={handleChange}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500
                                           focus:outline-none focus:border-primary-500 transition-colors"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit" disabled={loading}
                            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed
                                       text-white font-semibold py-2.5 rounded-lg transition-colors"
                        >
                            {loading ? t("login.submitting") : t("login.submit")}
                        </button>
                    </form>
                </div>

                <p className="text-center text-gray-500 text-sm mt-6">
                    {t("login.no_account")}{" "}
                    <Link to="/register" className="text-primary-400 hover:text-primary-300">
                        {t("login.signup_link")}
                    </Link>
                </p>
            </div>
        </main>
    );
}
