import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import LoadingSpinner from "../components/LoadingSpinner";

const PINATA_JWT     = import.meta.env.VITE_PINATA_JWT;
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY;
const CATEGORIES     = ["medical", "education", "disaster", "community", "business", "creative", "other"];

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
    if (!res.ok) throw new Error("Image upload failed.");
    const data = await res.json();
    return `${PINATA_GATEWAY}/ipfs/${data.IpfsHash}`;
}

// ─── Drag-to-reposition + zoom image component ────────────────────────────────
function ImagePositioner({ src, position, onPositionChange }) {
    const containerRef = useRef(null);
    const dragging     = useRef(false);
    const lastPos      = useRef({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);

    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

    const startDrag = useCallback((clientX, clientY) => {
        if (zoom <= 1) return;
        dragging.current = true;
        lastPos.current  = { x: clientX, y: clientY };
    }, [zoom]);

    const onDrag = useCallback((clientX, clientY) => {
        if (!dragging.current) return;
        const dx = clientX - lastPos.current.x;
        const dy = clientY - lastPos.current.y;
        lastPos.current = { x: clientX, y: clientY };
        onPositionChange((prev) => ({
            x: clamp(prev.x + dx, -200, 200),
            y: clamp(prev.y + dy, -200, 200),
        }));
    }, [onPositionChange]);

    const stopDrag = useCallback(() => { dragging.current = false; }, []);

    return (
        <div className="flex flex-col gap-2">
            <div
                ref={containerRef}
                className="relative w-full h-56 rounded-xl overflow-hidden select-none border border-gray-700 bg-gray-900"
                style={{ cursor: zoom > 1 ? "grab" : "default" }}
                onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
                onMouseMove={(e) => onDrag(e.clientX, e.clientY)}
                onMouseUp={stopDrag}
                onMouseLeave={stopDrag}
                onTouchStart={(e) => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchMove={(e) => { e.preventDefault(); onDrag(e.touches[0].clientX, e.touches[0].clientY); }}
                onTouchEnd={stopDrag}
            >
                <img
                    src={src}
                    alt="Preview"
                    draggable={false}
                    className="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-100"
                    style={{
                        objectFit: zoom <= 1 ? "contain" : "cover",
                        objectPosition: `calc(50% + ${position.x}px) calc(50% + ${position.y}px)`,
                        transform: `scale(${zoom})`,
                        transformOrigin: "center",
                    }}
                />
                {zoom <= 1 && (
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm">
                        Zoom in to reposition
                    </div>
                )}
                {zoom > 1 && (
                    <div className="absolute bottom-2 right-2 text-xs text-white bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm">
                        Drag to reposition
                    </div>
                )}
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-8">Zoom</span>
                <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => {
                        const newZoom = Number(e.target.value);
                        setZoom(newZoom);
                        if (newZoom <= 1) onPositionChange({ x: 0, y: 0 });
                    }}
                    className="flex-1 accent-blue-500 cursor-pointer"
                />
                <span className="text-xs text-gray-500 w-8">{zoom.toFixed(1)}x</span>
            </div>
        </div>
    );
}

export default function CreateCampaign() {
    const { t }    = useTranslation();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        title: "", description: "", goal_amount: "", deadline: "",
        category: "other", imageFile: null, imagePreview: null,
    });
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
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
        setImagePosition({ x: 0, y: 0 });
        setErrors((er) => ({ ...er, image: "" }));
    }

    function handleRemoveImage() {
        setForm((f) => ({ ...f, imageFile: null, imagePreview: null }));
        setImagePosition({ x: 0, y: 0 });
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
        setApiError("");

        try {
            let image_url = null;
            if (form.imageFile && PINATA_JWT) {
                setStep("uploading");
                image_url = await uploadToIPFS(form.imageFile);
                if (imagePosition.x !== 0 || imagePosition.y !== 0) {
                    image_url += `#pos:${imagePosition.x},${imagePosition.y}`;
                }
            }

            setStep("saving");
            const payload = {
                title:       form.title.trim(),
                description: form.description.trim(),
                goal_amount: Number(form.goal_amount),
                deadline:    new Date(form.deadline).toISOString(),
                category:    form.category,
                image_url,
            };
            await client.post("/api/campaigns", payload);

            setStep("done");
            setTimeout(() => navigate("/dashboard"), 1500);
        } catch (err) {
            setStep(null);
            if (err.response?.data?.details) {
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
                        <span className="text-primary-300 text-sm">
                            {step === "uploading" && t("create.step_uploading")}
                            {step === "saving"    && t("create.step_saving")}
                            {step === "done"      && t("create.step_done")}
                        </span>
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

                    {/* ── Image upload ── */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            {t("create.field_image")}{" "}
                            <span className="text-gray-500 font-normal">{t("create.field_image_optional")}</span>
                        </label>

                        {form.imagePreview ? (
                            <div className="flex flex-col gap-2">
                                <ImagePositioner
                                    src={form.imagePreview}
                                    position={imagePosition}
                                    onPositionChange={setImagePosition}
                                />
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500">Zoom in then drag to reposition</p>
                                    <button
                                        type="button"
                                        onClick={handleRemoveImage}
                                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        ✕ Remove image
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <input type="file" accept="image/*" onChange={handleImageChange}
                                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg
                                           file:border-0 file:text-sm file:font-medium file:bg-gray-700 file:text-gray-300
                                           hover:file:bg-gray-600 cursor-pointer" />
                        )}
                        {errors.image && <p className="mt-1 text-xs text-red-400">{errors.image}</p>}
                    </div>

                    <div className="pt-2">
                        <button type="submit" disabled={isSubmitting}
                            className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed
                                       text-white font-semibold py-3 rounded-xl transition-colors">
                            {isSubmitting ? t("create.submitting") : t("create.submit")}
                        </button>
                        <p className="text-xs text-gray-600 text-center mt-3">{t("create.setup_note")}</p>
                    </div>
                </form>
            </div>
        </div>
    );
}