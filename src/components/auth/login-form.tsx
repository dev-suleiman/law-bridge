"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {Loader2, Eye, EyeOff} from "lucide-react";
import Link from "next/link";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";

const LoginSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof LoginSchema>;

export function LoginForm({redirectTo}: {redirectTo?: string}) {
	const [showPassword, setShowPassword] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const router = useRouter();
	const supabase = createSupabaseBrowserClient();

	const {
		register,
		handleSubmit,
		formState: {errors, isSubmitting},
	} = useForm<LoginValues>({
		resolver: zodResolver(LoginSchema),
	});

	const onSubmit = async (values: LoginValues) => {
		setServerError(null);

		if (!supabase) {
			setServerError(
				"Authentication service is not configured. Please try again later.",
			);
			return;
		}

		try {
			console.log(
				"[LoginForm] Attempting to sign in with:",
				values.email,
			);
			const {data, error} =
				await supabase.auth.signInWithPassword(values);

			if (error) {
				console.error("[LoginForm] Sign in error:", error);
				setServerError(
					error.message === "Invalid login credentials"
						? "Incorrect email or password. Please try again."
						: error.message,
				);
				return;
			}

			console.log(
				"[LoginForm] Sign in successful, waiting for session...",
			);

			// Wait for session to be available (this ensures getSession returns it)
			const {
				data: {session},
			} = await supabase.auth.getSession();

			if (!session) {
				console.error(
					"[LoginForm] Session not available after sign in",
				);
				setServerError("Session not ready. Please try again.");
				return;
			}

			console.log(
				"[LoginForm] Session confirmed, giving sync time to complete...",
			);

			// Small delay to allow Providers.tsx sync to complete
			await new Promise((r) => setTimeout(r, 150));

			// Ensure profile exists for this user (creates if first login)
			console.log("[LoginForm] Ensuring profile exists...");
			const ensureRes = await fetch("/api/auth/ensure-profile", {
				method: "POST",
			});
			const ensureData = await ensureRes.json();
			if (!ensureRes.ok) {
				console.error(
					"[LoginForm] Failed to ensure profile:",
					ensureData,
				);
				setServerError("Profile setup failed. Please try again.");
				return;
			}
			console.log("[LoginForm] Profile ensured:", ensureData);

			// Check user role to determine redirect destination
			const userRes = await fetch("/api/user/profile");
			const userProfile = await userRes.json();

			const destination =
				userProfile?.role === "admin"
					? "/admin"
					: userProfile?.role === "lawyer"
					? "/lawyer/dashboard"
					: (redirectTo ?? "/dashboard");
			console.log(
				"[LoginForm] User role:",
				userProfile?.role,
				"Redirecting to:",
				destination,
			);

			console.log("[LoginForm] Navigating to", destination);
			router.refresh();
			router.push(destination);
		} catch (e) {
			console.error("[LoginForm] Unexpected error:", e);
			setServerError("An unexpected error occurred. Please try again.");
		}
	};

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			{serverError && (
				<div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
					{serverError}
				</div>
			)}

			<div>
				<label className="block text-sm font-medium text-text-primary mb-1.5">
					Email address
				</label>
				<input
					{...register("email")}
					type="email"
					autoComplete="email"
					placeholder="you@example.com"
					className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-base"
				/>
				{errors.email && (
					<p className="text-red-600 text-xs mt-1">
						{errors.email.message}
					</p>
				)}
			</div>

			<div>
				<div className="flex justify-between mb-1.5">
					<label className="block text-sm font-medium text-text-primary">
						Password
					</label>
					<Link
						href="/reset-password"
						className="text-xs text-primary hover:underline"
					>
						Forgot password?
					</Link>
				</div>
				<div className="relative">
					<input
						{...register("password")}
						type={showPassword ? "text" : "password"}
						autoComplete="current-password"
						placeholder="••••••••"
						className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-base pr-12"
					/>
					<button
						type="button"
						onClick={() => setShowPassword(!showPassword)}
						className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary p-1"
					>
						{showPassword ? (
							<EyeOff className="w-4 h-4" />
						) : (
							<Eye className="w-4 h-4" />
						)}
					</button>
				</div>
				{errors.password && (
					<p className="text-red-600 text-xs mt-1">
						{errors.password.message}
					</p>
				)}
			</div>

			<button
				type="submit"
				disabled={isSubmitting}
				className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
			>
				{isSubmitting ? (
					<>
						<Loader2 className="w-4 h-4 animate-spin" /> Signing in…
					</>
				) : (
					"Sign In"
				)}
			</button>
		</form>
	);
}
