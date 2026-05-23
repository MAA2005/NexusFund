import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Contract, parseUnits } from "ethers";
import client from "../api/client";
import { useWallet } from "../hooks/useWallet";
import { CAMPAIGN_FACTORY_ABI } from "../contracts/abis";
import LoadingSpinner from "../components/LoadingSpinner";

const FACTORY_ADDRESS = import.meta.env.VITE_CAMPAIGN_FACTORY_ADDRESS;
const PINATA_JWT      = import.meta.env.VITE_PINATA_JWT;
const CATEGORIES      = ["medical", "education", "disaster", "community", "business", "creative", "other"];

async function uploadToIPFS(file) {
    const form = new FormData();
    form.append("file", file);
    form.append("pinataMetadata", JSON.stringify({ name: file.name }));
    form.append("pinataOptions",  JSON.stringify({ cidVersion: 1 }));

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method:  "POST",
        headers: { Authorization: `Bearer ${PINATA_JWT}` },
        body:    form,
    });
    if (!res.ok) throw new Error("Image upload failed. Check your Pinata JWT.");
    const data = await res.json();
    return `${import.meta.env.VITE_PINATA_GATEWAY}/ipfs/${data.IpfsHash}`;
}

export default function CreateCampaign() {
    const { t } = useTranslation();
    const wallet   = useWallet();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        title: "", description: "", goal_amount: "", deadline: "",
        category: "other", imageFile: null, imagePreview: null,
    });
    const [errors,   setErrors]   = useState({});
    const [step,     setStep]     = useState(null);
    const [apiError, setApiError] = useState("");

    const isSubmitting = step !== null && step !== "done";

    function handleChange(e) {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
        setErrors((er) => ({ ...er, [name]: "" }));
        setApiError("");
    }

    function handleImageChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            setErrors((er) => ({ ...er, image: t("create.error_image_size") }));
            return;
        }
        setForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
        setErrors((er) => ({ ...er, image: "" }));
    }

    function validate() {
        const errs = {};
        if (!form.title.trim() || form.title.length < 3) errs.title = t("create.error_title_short");
        if (form.title.length > 200)                      errs.title = t("create.error_title_long");
        if (!form.description.trim() || form.description.length < 20) errs.description = t("create.error_description");
        if (!form.goal_amount || isNaN(form.goal_amount) || Number(form.goal_amount) <= 0)
            errs.goal_amount = t("create.error_goal");
        if (!form.deadline) errs.deadline = t("create.error_deadline_required");
        if (form.deadline && new Date(form.deadline) <= new Date())
            errs.deadline = t("create.error_deadline_future");
        return errs;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }
        if (!wallet.isConnected) { await wallet.connect(); return; }
        if (!wallet.isCorrectNetwork) { await wallet.switchToAmoy(); return; }
        if (!FACTORY_ADDRESS || FACTORY_ADDRESS.startsWith("fill")) {
            setApiError(t("create.error_no_contract"));
            return;
        }

        setApiError("");

        try {
            let imageUrl = null;
            if (form.imageFile) {
                setStep("uploading");
                imageUrl = await uploadToIPFS(form.imageFile);
            }

            setStep("saving");
            const payload = {
                title:       form.title.trim(),
                description: form.description.trim(),
                goal_amount: Number(form.goal_amount),
                deadline:    new Date(form.deadline).toISOString(),
                category:    form.category,
                image_url:   imageUrl,
            };
            const dbRes    = await client.post("/api/campaigns", payload);
            const campaign = dbRes.data.campaign;

            setStep("deploying");
            const signer  = await wallet.provider.getSigner();
            const factory = new Contract(FACTORY_ADDRESS, CAMPAIGN_FACTORY_ABI, signer);

            const goalInBaseUnits = parseUnits(String(form.goal_amount), 6);
            const deadlineUnix    = Math.floor(new Date(form.deadline).getTime() / 1000);

            const tx      = await factory.createCampaign(form.title.trim(), goalInBaseUnits, deadlineUnix);
            const receipt = await tx.wait();

            const iface    = factory.interface;
            const eventLog = receipt.logs.find((log) => {
                try { return iface.parseLog(log)?.name === "CampaignCreated"; }
                catch { return false; }
            });
            if (!eventLog) throw new Error("CampaignCreated event not found in transaction receipt.");
            const contractAddress = iface.parseLog(eventLog).args[0];

            setStep("updating");
            await client.put(`/api/campaigns/${campaign.id}`, { contract_address: contractAddress });

            setStep("done");
            setTimeout(() => navigate(`/campaign/${campaign.id}`), 1500);
        } catch (err) {
            setStep(null);
            if (err.code === 4001 || err.code === "ACTION_REJECTED") {
                setApiError(t("create.error_rejected"));
            } else if (err.response?.data?.details) {
                const serverErrs = {};
                err.response.data.details.forEach((d) => { serverErrs[d.field] = d.message; });
                setErrors(serverErrs);
            } else {
                setApiError(err.response?.data?.error || err.message || t("create.error_generic"));
            }
        }
    }

    const fieldClass = (name) =>
        `w-full bg-gray-800 border rounded-lg px-4 py-2.5 text-white placeholder-gray-500
         focus:outline-none focus:border-primary-500 transition-colors
         ${errors[name] ? "border-red-600" : "border-gray-700"}`;

    // Map step key to translation key
    const stepLabel = step ? t(`create.step_${step}`) : null;

    return (
        <div className="min-h-screen bg-gray-950">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
                <h1 className="text-3xl font-bold text-white mb-2">{t("create.title")}</h1>
                <p className="text-gray-400 mb-8">{t("create.subtitle")}</p>

                {apiError && (
                    <div role="alert" className="mb-6 p-4 rounded-xl bg-red-900/40 border border-red-800 text-red-300 text-sm">
                        {apiError}
                    </div>
                )}

                {step && (
                    <div className="mb-6 p-4 rounded-xl bg-primary-900/30 border border-primary-800/50 flex items-center gap-3">
                        {step !== "done" && <LoadingSpinner size="sm" />}
                        {step === "done" && <span className="text-green-400 text-lg">✓</span>}
                        <span className="text-primary-300 text-sm">{stepLabel}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">{t("create.field_title")}</label>
                        <input name="title" type="text" value={form.title} onChange={handleChange}
                            className={fieldClass("title")} placeholder={t("create.field_title_placeholder")} maxLength={200} />
                        {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">{t("create.field_description")}</label>
                        <textarea name="description" rows={6} value={form.description} onChange={handleChange}
                            className={`${fieldClass("description")} resize-none`}
                            placeholder={t("create.field_description_placeholder")} />
                        <p className="mt-1 text-xs text-gray-600">{form.description.length} / 5000</p>
                        {errors.description && <p className="mt-1 text-xs text-red-400">{errors.description}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">{t("create.field_goal")}</label>
                            <input name="goal_amount" type="number" min="1" step="0.01" value={form.goal_amount} onChange={handleChange}
                                className={fieldClass("goal_amount")} placeholder={t("create.field_goal_placeholder")} />
                            {errors.goal_amount && <p className="mt-1 text-xs text-red-400">{errors.goal_amount}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">{t("create.field_deadline")}</label>
                            <input name="deadline" type="datetime-local" value={form.deadline} onChange={handleChange}
                                min={new Date(Date.now() + 86400000).toISOString().slice(0, 16)}
                                className={fieldClass("deadline")} />
                            {errors.deadline && <p className="mt-1 text-xs text-red-400">{errors.deadline}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">{t("create.field_category")}</label>
                        <select name="category" value={form.category} onChange={handleChange}
                            className={`${fieldClass("category")} capitalize cursor-pointer`}>
                            {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            {t("create.field_image")}{" "}
                            <span className="text-gray-500 font-normal">{t("create.field_image_optional")}</span>
                        </label>
                        {form.imagePreview && (
                            <img src={form.imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg mb-3" />
                        )}
                        <input type="file" accept="image/*" onChange={handleImageChange}
                            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg
                                       file:border-0 file:text-sm file:font-medium file:bg-gray-700 file:text-gray-300
                                       hover:file:bg-gray-600 cursor-pointer" />
                        {errors.image && <p className="mt-1 text-xs text-red-400">{errors.image}</p>}
                        {!PINATA_JWT && (
                            <p className="mt-1 text-xs text-yellow-600">
                                VITE_PINATA_JWT not set — image upload disabled. Add it to frontend/.env.
                            </p>
                        )}
                    </div>

                    <div className="pt-2">
                        {!wallet.isConnected ? (
                            <button type="button" onClick={wallet.connect}
                                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl transition-colors">
                                {t("create.connect_wallet")}
                            </button>
                        ) : !wallet.isCorrectNetwork ? (
                            <button type="button" onClick={wallet.switchToAmoy}
                                className="w-full bg-orange-700 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors">
                                {t("create.switch_network")}
                            </button>
                        ) : (
                            <button type="submit" disabled={isSubmitting}
                                className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed
                                           text-white font-semibold py-3 rounded-xl transition-colors">
                                {isSubmitting ? t("create.submitting") : t("create.submit")}
                            </button>
                        )}
                        <p className="text-xs text-gray-600 text-center mt-3">{t("create.gas_note")}</p>
                    </div>
                </form>
            </div>
        </div>
    );
}
