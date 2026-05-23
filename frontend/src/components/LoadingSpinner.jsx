export default function LoadingSpinner({ size = "md", className = "" }) {
    const sizes = {
        sm: "h-4 w-4 border-2",
        md: "h-8 w-8 border-2",
        lg: "h-12 w-12 border-[3px]",
    };
    return (
        <div
            role="status"
            aria-label="Loading"
            className={`inline-block rounded-full border-gray-700 border-t-primary-500 animate-spin ${sizes[size]} ${className}`}
        />
    );
}
