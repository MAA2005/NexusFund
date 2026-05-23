import { Link } from "react-router-dom";
import { useCurrency } from "../hooks/useCurrency";

const CATEGORY_STYLES = {
    medical:   "bg-red-900/60    text-red-300",
    education: "bg-blue-900/60   text-blue-300",
    disaster:  "bg-orange-900/60 text-orange-300",
    community: "bg-green-900/60  text-green-300",
    business:  "bg-yellow-900/60 text-yellow-300",
    creative:  "bg-purple-900/60 text-purple-300",
    other:     "bg-gray-800      text-gray-300",
};

function daysLeft(deadline) {
    const diff = Math.ceil((new Date(deadline) - Date.now()) / 86_400_000);
    if (diff <= 0) return { label: "Ended",              urgent: false };
    if (diff === 1) return { label: "1 day left",        urgent: true  };
    if (diff <= 3)  return { label: `${diff} days left`, urgent: true  };
    return           { label: `${diff} days left`,       urgent: false };
}

export default function CampaignCard({ campaign }) {
    const { id, title, category, goal_amount, image_url, deadline, status, _count } = campaign;
    const { label, urgent } = daysLeft(deadline);
    const donorCount = _count?.donations ?? 0;
    const { formatUSDC } = useCurrency();
    const localGoal = formatUSDC(goal_amount);

    return (
        <Link
            to={`/campaign/${id}`}
            className="group flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden
                       hover:border-primary-500/70 transition-colors duration-200"
        >
            {/* Image / placeholder */}
            <div className="aspect-video overflow-hidden flex-shrink-0 bg-gray-800">
                {image_url ? (
                    <img
                        src={image_url}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-900/60 to-secondary-700/40 flex items-center justify-center">
                        <span className="text-5xl opacity-30">🌐</span>
                    </div>
                )}
            </div>

            <div className="flex flex-col flex-1 p-4 gap-3">
                {/* Category badge + status */}
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other}`}>
                        {category}
                    </span>
                    {status !== "ACTIVE" && (
                        <span className="text-xs text-gray-600 uppercase tracking-wide">{status}</span>
                    )}
                </div>

                {/* Title */}
                <h3 className="text-white font-semibold leading-snug line-clamp-2 flex-1">
                    {title}
                </h3>

                {/* Goal */}
                <div>
                    <p className="text-sm text-gray-400">
                        Goal:{" "}
                        <span className="text-white font-medium">
                            {Number(goal_amount).toLocaleString()} USDC
                        </span>
                    </p>
                    {localGoal && (
                        <p className="text-xs text-gray-600 mt-0.5">≈ {localGoal}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-800 text-sm">
                    <span className="text-gray-400">{donorCount} donor{donorCount !== 1 ? "s" : ""}</span>
                    <span className={urgent ? "text-orange-400" : "text-gray-500"}>{label}</span>
                </div>
            </div>
        </Link>
    );
}
