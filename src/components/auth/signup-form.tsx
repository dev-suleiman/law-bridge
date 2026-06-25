"use client";

import {useState} from "react";
import {useRouter} from "next/navigation";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {Loader2, Eye, EyeOff} from "lucide-react";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";

const SignupSchema = z.object({
	displayName: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	isLawyer: z.boolean().default(false),
});

type SignupValues = z.infer<typeof SignupSchema>;

export function SignupForm() {
	const [showPassword, setShowPassword] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const router = useRouter();
	const supabase = createSupabaseBrowserClient();

	const {
		register,
		handleSubmit,
		watch,
		formState: {errors, isSubmitting},
	} = useForm<SignupValues>({
		resolver: zodResolver(SignupSchema),
		defaultValues: {isLawyer: false},
	});

	const isLawyer = watch("isLawyer");

	const onSubmit = async (values: SignupValues) => {
		setServerError(null);

		if (!supabase) {
			setServerError(
				"Authentication service is not configured. Please try again later.",
			);
			return;
		}

		const {data, error} = await supabase.auth.signUp({
			email: values.email,
			password: values.password,
			options: {
				data: {
					display_name: values.displayName,
					role: values.isLawyer ? "lawyer" : "user",
				},
			},
		});

		if (error) {
			setServerError(error.message);
			return;
		}

		if (data.user) {
			console.log("[SignupForm] User created:", data.user.id);

			// If there's a session, sync it immediately
			if (data.session) {
				console.log(
					"[SignupForm] Session available, syncing to server...",
				);
				const syncRes = await fetch("/api/auth/sync", {
					method: "POST",
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify({
						access_token: data.session.access_token,
						refresh_token: data.session.refresh_token,
						expires_in: data.session.expires_in,
						token_type: data.session.token_type,
					}),
				});

				if (!syncRes.ok) {
					console.error("[SignupForm] Sync failed");
					setServerError("Session sync failed. Please try again.");
					return;
				}

				// Wait a bit for sync to complete
				await new Promise((r) => setTimeout(r, 150));

				// Ensure profile is created
				console.log("[SignupForm] Ensuring profile exists...");
				const ensureRes = await fetch("/api/auth/ensure-profile", {
					method: "POST",
				});
				if (!ensureRes.ok) {
					const ensureError = await ensureRes.json();
					console.error(
						"[SignupForm] Failed to ensure profile:",
						ensureError,
					);
					setServerError("Profile setup failed. Please try again.");
					return;
				}

				console.log("[SignupForm] Profile created successfully");
				// Redirect based on role
				const destination = values.isLawyer ? "/lawyer/dashboard" : "/dashboard";
				router.push(destination);
				router.refresh();
			} else {
				// No session = email confirmation required
				console.log("[SignupForm] Email confirmation required");
				setServerError(
					"Check your email to confirm your account before logging in.",
				);
			}
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
					Full name
				</label>
				<input
					{...register("displayName")}
					type="text"
					autoComplete="name"
					placeholder="Kwame Mensah"
					className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-base"
				/>
				{errors.displayName && (
					<p className="text-red-600 text-xs mt-1">
						{errors.displayName.message}
					</p>
				)}
			</div>

			<div>
				<label className="block text-sm font-medium text-text-primary mb-1.5">
					Email address
				</label>
				<input
					{...register("email")}
					type="email"
					autoComplete="email"
					placeholder="you@example.com"
					className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-base"
				/>
				{errors.email && (
					<p className="text-red-600 text-xs mt-1">
						{errors.email.message}
					</p>
				)}
			</div>

			<div>
				<label className="block text-sm font-medium text-text-primary mb-1.5">
					Password
				</label>
				<div className="relative">
					<input
						{...register("password")}
						type={showPassword ? "text" : "password"}
						autoComplete="new-password"
						placeholder="At least 8 characters"
						className="w-full px-4 py-3 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 text-base pr-12"
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

			{/* Lawyer option */}
			<label className="flex items-start gap-3 p-4 border-2 border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
				<input
					{...register("isLawyer")}
					type="checkbox"
					className="mt-0.5 rounded accent-primary w-4 h-4 flex-shrink-0"
				/>
				<div>
					<p className="text-sm font-semibold text-text-primary">
						I am a qualified Ghanaian lawyer
					</p>
					<p className="text-xs text-text-muted mt-0.5">
						Create a lawyer profile to receive consultation bookings
						from citizens.
					</p>
				</div>
			</label>

			<button
				type="submit"
				disabled={isSubmitting}
				className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
			>
				{isSubmitting ? (
					<>
						<Loader2 className="w-4 h-4 animate-spin" /> Creating
						account…
					</>
				) : (
					"Create Free Account"
				)}
			</button>
		</form>
	);
}
