import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { useAppContext } from "../store";

export function ToastContainer() {
	const { toasts, removeToast } = useAppContext();

	if (toasts.length === 0) return null;

	return (
		<div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
			{toasts.map((toast) => {
				const isSuccess = toast.type === "success";
				const isError = toast.type === "error";
				const isWarning = toast.type === "warning";

				return (
					<div
						key={toast.id}
						className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-slide-in ${
							isSuccess
								? "bg-emerald-50/90 dark:bg-emerald-950/90 text-emerald-850 dark:text-emerald-305 border-emerald-200 dark:border-emerald-900/50"
								: isError
									? "bg-red-50/90 dark:bg-red-950/90 text-red-850 dark:text-red-305 border-red-200 dark:border-red-900/50"
									: isWarning
										? "bg-amber-50/90 dark:bg-amber-950/90 text-amber-850 dark:text-amber-305 border-amber-200 dark:border-amber-900/50"
										: "bg-blue-50/90 dark:bg-blue-950/90 text-blue-850 dark:text-blue-305 border-blue-200 dark:border-blue-900/50"
						}`}
					>
						<span className="mt-0.5 shrink-0">
							{isSuccess && (
								<CheckCircle size={16} className="text-emerald-500" />
							)}
							{isError && <AlertCircle size={16} className="text-red-500" />}
							{isWarning && (
								<AlertCircle size={16} className="text-amber-500" />
							)}
							{!isSuccess && !isError && !isWarning && (
								<Info size={16} className="text-blue-500" />
							)}
						</span>
						<div className="flex-1 text-xs font-semibold leading-relaxed break-words">
							{toast.message}
						</div>
						<button
							type="button"
							onClick={() => removeToast(toast.id)}
							className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer shrink-0 mt-0.5"
						>
							<X size={14} />
						</button>
					</div>
				);
			})}
		</div>
	);
}
