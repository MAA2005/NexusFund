import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function Register() {
    const { t } = useTranslation();
    const { login } = useAuth();
    const navigate  = useNavigate();

    const [form, setForm] = useState({
        email: "", password: "", country: "", wallet_address: "",
    });
    const [errors,   setErrors]   = useState({});
    const [loading,  setLoading]  = useState(false);
    const [apiError, setApiError] = useState("");

    function handleChange(e) {
        setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
        setErrors((er) => ({ ...er, [e.target.name]: "" }));
        setApiError("");
    }

    function validate() {
        const errs = {};
        if (!form.email)    errs.email    = t("register.error_email");
        if (!form.password) errs.password = t("register.error_password_required");
        if (form.password.length > 0 && form.password.length < 8)
            errs.password = t("register.error_password_length");
        if (form.password && !/[a-zA-Z]/.test(form.password))
            errs.password = t("register.error_password_letter");
        if (form.password && !/[0-9]/.test(form.password))
            errs.password = t("register.error_password_number");
        if (!form.country)  errs.country  = t("register.error_country");
        if (form.wallet_address && !/^0x[a-fA-F0-9]{40}$/.test(form.wallet_address))
            errs.wallet_address = t("register.error_wallet");
        return errs;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setLoading(true);
        setApiError("");
        try {
            const payload = {
                email:          form.email,
                password:       form.password,
                country:        form.country,
                wallet_address: form.wallet_address || null,
            };
            const res = await client.post("/api/auth/register", payload);
            login(res.data.token, res.data.user);
            navigate("/");
        } catch (err) {
            if (err.response?.data?.details) {
                const serverErrs = {};
                err.response.data.details.forEach((d) => { serverErrs[d.field] = d.message; });
                setErrors(serverErrs);
            } else {
                setApiError(err.response?.data?.error || t("register.api_error"));
            }
        } finally {
            setLoading(false);
        }
    }

    const fieldClass = (name) =>
        `w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white placeholder-gray-500
         focus:outline-none focus:border-primary-500 transition-colors
         ${errors[name] ? "border-red-600" : "border-gray-700"}`;

    return (
        <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white">{t("register.title")}</h1>
                    <p className="text-gray-400 mt-2">{t("register.subtitle")}</p>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
                    {apiError && (
                        <div role="alert" className="mb-6 p-3 rounded-lg bg-red-900/40 border border-red-800 text-red-300 text-sm">
                            {apiError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">{t("register.email")}</label>
                            <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange}
                                className={fieldClass("email")} placeholder="you@example.com" />
                            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">{t("register.password")}</label>
                            <input id="password" name="password" type="password" autoComplete="new-password" value={form.password} onChange={handleChange}
                                className={fieldClass("password")} placeholder={t("register.password_hint")} />
                            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
                        </div>

                        <div>
                            <label htmlFor="country" className="block text-sm font-medium text-gray-300 mb-1.5">{t("register.country")}</label>
                            <input id="country" name="country" type="text" value={form.country} onChange={handleChange}
                                className={fieldClass("country")} placeholder={t("register.country_placeholder")} />
                            {errors.country && <p className="mt-1 text-xs text-red-400">{errors.country}</p>}
                        </div>

                        <div>
                            <label htmlFor="wallet_address" className="block text-sm font-medium text-gray-300 mb-1.5">
                                {t("register.wallet_address")}{" "}
                                <span className="text-gray-500 font-normal">{t("register.wallet_optional")}</span>
                            </label>
                            <input id="wallet_address" name="wallet_address" type="text" value={form.wallet_address} onChange={handleChange}
                                className={fieldClass("wallet_address")} placeholder={t("register.wallet_placeholder")} />
                            {errors.wallet_address && <p className="mt-1 text-xs text-red-400">{errors.wallet_address}</p>}
                        </div>

                        <button type="submit" disabled={loading}
                            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors">
                            {loading ? t("register.submitting") : t("register.submit")}
                        </button>
                    </form>
                </div>

                <p className="text-center text-gray-500 text-sm mt-6">
                    {t("register.have_account")}{" "}
                    <Link to="/login" className="text-primary-400 hover:text-primary-300">{t("register.signin_link")}</Link>
                </p>
            </div>
        </main>
    );
}
