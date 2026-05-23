export default function ProgressBar({ raised, goal, className = "" }) {
    const pct       = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
    const isReached = raised >= goal;

    return (
        <div className={className}>
            <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-white font-semibold">
                    {Number(raised).toLocaleString()} USDC raised
                </span>
                <span className={`text-sm font-medium ${isReached ? "text-green-400" : "text-gray-400"}`}>
                    {pct}%
                </span>
            </div>
            <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${isReached ? "bg-green-500" : "bg-primary-500"}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <div className="flex justify-between mt-1.5 text-sm text-gray-500">
                <span>Goal: {Number(goal).toLocaleString()} USDC</span>
                {isReached && <span className="text-green-400 font-medium">Goal reached!</span>}
            </div>
        </div>
    );
}
