"use client";

import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {Loader2, CheckCircle} from "lucide-react";

// ─── Validation Schema ────────────────────────────────────────────────────────

const ProfileSchema = z.object({
	fullName: z.string().min(2, "Full name must be at least 2 characters"),
	bio: z.string().max(500, "Bio cannot exceed 500 characters"),
	consultationFeeGhs: z
		.number()
		.min(50, "Consultation fee must be at least ₵50"),
	specialisations: z
		.array(z.string())
		.min(1, "Select at least one specialisation"),
	languages: z.array(z.string()).min(1, "Select at least one language"),
	regions: z.array(z.string()).min(1, "Select at least one region"),
	photoUrl: z
		.string()
		.url("Please enter a valid URL")
		.optional()
		.or(z.literal("")),
});

type ProfileFormData = z.infer<typeof ProfileSchema>;

interface LawyerProfile {
	id: string;
	fullName: string;
	barNumber: string;
	bio: string;
	consultationFeeGhs: number;
	specialisations: string[];
	languages: string[];
	regions: string[];
	photoUrl: string | null;
	isVerified: boolean;
	ratingAvg: number;
	ratingCount: number;
}

const SPECIALISATIONS = [
	"Labour & Employment",
	"Tenancy & Housing",
	"Family Law",
	"Criminal Law",
	"Consumer Rights",
	"Civil Litigation",
	"Human Rights",
];

const LANGUAGES = ["English", "Twi", "Ga", "Hausa", "Ewe", "Dagbani"];

const GHANA_REGIONS = [
	"Ashanti",
	"Bono",
	"Bono East",
	"Central",
	"Eastern",
	"Greater Accra",
	"North East",
	"Northern",
	"Oti",
	"Savannah",
	"Upper East",
	"Upper West",
	"Volta",
	"Western",
	"Western North",
];

export default function LawyerProfilePage() {
	const [lawyerData, setLawyerData] = useState<LawyerProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		watch,
		formState: {errors},
		reset,
	} = useForm<ProfileFormData>({
		resolver: zodResolver(ProfileSchema),
		defaultValues: {
			specialisations: [],
			languages: [],
			regions: [],
		},
	});

	const bioLength = watch("bio")?.length || 0;
	const specialisations = watch("specialisations");
	const languages = watch("languages");
	const regions = watch("regions");

	// ─── Load Lawyer Profile ──────────────────────────────────────────────────

	useEffect(() => {
		const fetchProfile = async () => {
			try {
				const response = await fetch("/api/lawyer/profile");
				const data = await response.json();

				if (response.ok) {
					if (data.exists) {
						// Existing lawyer profile
						setLawyerData(data);
						reset({
							fullName: data.fullName,
							bio: data.bio || "",
							consultationFeeGhs: data.consultationFeeGhs,
							specialisations: data.specialisations || [],
							languages: data.languages || [],
							regions: data.regions || [],
							photoUrl: data.photoUrl || "",
						});
					} else {
						// New lawyer - pre-populate with displayName from profiles table
						reset({
							fullName: data.displayName || "",
							bio: "",
							consultationFeeGhs: 50,
							specialisations: [],
							languages: [],
							regions: [],
							photoUrl: "",
						});
					}
				}
			} catch (error) {
				console.error("Failed to fetch profile:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchProfile();
	}, [reset]);

	// ─── Handle Form Submission ───────────────────────────────────────────────

	const onSubmit = async (values: ProfileFormData) => {
		setSubmitting(true);
		setErrorMessage(null);
		setSuccessMessage(null);

		try {
			const response = await fetch("/api/lawyer/profile", {
				method: "PUT",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify(values),
			});

			const data = await response.json();

			if (response.ok) {
				setLawyerData(data);
				setSuccessMessage("Profile updated successfully!");
				setTimeout(() => setSuccessMessage(null), 3000);
			} else {
				setErrorMessage(data.error || "Failed to update profile");
			}
		} catch (error) {
			console.error("Error:", error);
			setErrorMessage("An error occurred while updating your profile");
		} finally {
			setSubmitting(false);
		}
	};

	if (loading) {
		return (
			<div className="p-6 max-w-4xl mx-auto">
				<div className="flex items-center justify-center h-64">
					<p className="text-text-secondary">Loading profile...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 max-w-4xl mx-auto">
			{/* Page Header */}
			<div className="mb-8">
				<h1 className="text-3xl font-display font-bold text-primary mb-2">
					Profile Settings
				</h1>
				<p className="text-text-secondary">
					{lawyerData ? "Update your professional information" : "Complete your lawyer profile to start receiving bookings"}
				</p>
			</div>

			{/* Messages */}
			{successMessage && (
				<div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
					<CheckCircle size={20} className="text-green-600" />
					<p className="text-green-800 font-medium">
						{successMessage}
					</p>
				</div>
			)}

			{errorMessage && (
				<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
					<p className="text-red-800 font-medium">{errorMessage}</p>
				</div>
			)}

			<form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
				{/* Read-only Info - Only show if profile exists */}
				{lawyerData && (
					<div className="bg-surface-secondary rounded-2xl border border-border p-6">
						<h2 className="text-lg font-display font-bold text-primary mb-4">
							Verification Status
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label className="text-sm font-semibold text-text-secondary">
									Bar Number
								</label>
								<p className="text-text-primary mt-1 font-mono">
									{lawyerData.barNumber}
								</p>
							</div>
							<div>
								<label className="text-sm font-semibold text-text-secondary">
									Verification Status
								</label>
								<p className="text-text-primary mt-1 font-medium">
									{lawyerData.isVerified ? (
										<span className="text-green-600">
											✓ Verified
										</span>
									) : (
										<span className="text-amber-600">
											⏳ Pending
										</span>
									)}
								</p>
							</div>
							<div>
								<label className="text-sm font-semibold text-text-secondary">
									Average Rating
								</label>
								<p className="text-text-primary mt-1">
									{lawyerData.ratingAvg > 0
										? `${lawyerData.ratingAvg.toFixed(1)} ⭐ (${lawyerData.ratingCount} ${
												lawyerData.ratingCount === 1
												? "rating"
												: "ratings"
										})`
									: "No ratings yet"}
							</p>
						</div>
					</div>
				</div>
				)}

				{/* Editable Fields */}
				<div className="bg-white rounded-2xl border border-border p-6 space-y-6">
					{/* Full Name */}
					<div>
						<label className="text-sm font-semibold text-text-primary block mb-2">
							Full Name
						</label>
						<input
							type="text"
							{...register("fullName")}
							className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition ${
								errors.fullName
									? "border-red-500"
									: "border-border"
							}`}
							placeholder="Your full name"
						/>
						{errors.fullName && (
							<p className="text-red-600 text-sm mt-1">
								{errors.fullName.message}
							</p>
						)}
					</div>

					{/* Bio */}
					<div>
						<label className="text-sm font-semibold text-text-primary block mb-2">
							Bio {bioLength}/500
						</label>
						<textarea
							{...register("bio")}
							maxLength={500}
							rows={5}
							className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition resize-none ${
								errors.bio ? "border-red-500" : "border-border"
							}`}
							placeholder="Tell us about yourself and your experience..."
						/>
						{errors.bio && (
							<p className="text-red-600 text-sm mt-1">
								{errors.bio.message}
							</p>
						)}
					</div>

					{/* Consultation Fee */}
					<div>
						<label className="text-sm font-semibold text-text-primary block mb-2">
							Consultation Fee (GHS)
						</label>
						<input
							type="number"
							step="0.5"
							{...register("consultationFeeGhs", {
								valueAsNumber: true,
							})}
							className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition ${
								errors.consultationFeeGhs
									? "border-red-500"
									: "border-border"
							}`}
							placeholder="50"
						/>
						{errors.consultationFeeGhs && (
							<p className="text-red-600 text-sm mt-1">
								{errors.consultationFeeGhs.message}
							</p>
						)}
					</div>

					{/* Photo URL */}
					<div>
						<label className="text-sm font-semibold text-text-primary block mb-2">
							Profile Photo URL
						</label>
						<input
							type="url"
							{...register("photoUrl")}
							className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition ${
								errors.photoUrl
									? "border-red-500"
									: "border-border"
							}`}
							placeholder="https://example.com/photo.jpg"
						/>
						{errors.photoUrl && (
							<p className="text-red-600 text-sm mt-1">
								{errors.photoUrl.message}
							</p>
						)}
						<p className="text-xs text-text-secondary mt-1">
							Photo upload via Supabase Storage will be added
							later
						</p>
					</div>
				</div>

				{/* Specialisations */}
				<div className="bg-white rounded-2xl border border-border p-6">
					<label className="text-sm font-semibold text-text-primary block mb-4">
						Specialisations <span className="text-red-500">*</span>
					</label>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{SPECIALISATIONS.map((spec) => (
							<label
								key={spec}
								className="flex items-center gap-2 cursor-pointer"
							>
								<input
									type="checkbox"
									{...register("specialisations")}
									value={spec}
									className="w-5 h-5 rounded border-border cursor-pointer"
								/>
								<span className="text-text-primary">
									{spec}
								</span>
							</label>
						))}
					</div>
					{errors.specialisations && (
						<p className="text-red-600 text-sm mt-2">
							{errors.specialisations.message}
						</p>
					)}
				</div>

				{/* Languages */}
				<div className="bg-white rounded-2xl border border-border p-6">
					<label className="text-sm font-semibold text-text-primary block mb-4">
						Languages Spoken <span className="text-red-500">*</span>
					</label>
					<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
						{LANGUAGES.map((lang) => (
							<label
								key={lang}
								className="flex items-center gap-2 cursor-pointer"
							>
								<input
									type="checkbox"
									{...register("languages")}
									value={lang}
									className="w-5 h-5 rounded border-border cursor-pointer"
								/>
								<span className="text-text-primary">
									{lang}
								</span>
							</label>
						))}
					</div>
					{errors.languages && (
						<p className="text-red-600 text-sm mt-2">
							{errors.languages.message}
						</p>
					)}
				</div>

				{/* Regions */}
				<div className="bg-white rounded-2xl border border-border p-6">
					<label className="text-sm font-semibold text-text-primary block mb-4">
						Regions Covered <span className="text-red-500">*</span>
					</label>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{GHANA_REGIONS.map((region) => (
							<label
								key={region}
								className="flex items-center gap-2 cursor-pointer"
							>
								<input
									type="checkbox"
									{...register("regions")}
									value={region}
									className="w-5 h-5 rounded border-border cursor-pointer"
								/>
								<span className="text-text-primary">
									{region}
								</span>
							</label>
						))}
					</div>
					{errors.regions && (
						<p className="text-red-600 text-sm mt-2">
							{errors.regions.message}
						</p>
					)}
				</div>

				{/* Submit Button */}
				<div className="flex gap-3">
					<button
						type="submit"
						disabled={submitting}
						className="px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
					>
						{submitting && (
							<Loader2 size={18} className="animate-spin" />
						)}
						{submitting ? "Saving..." : "Save Changes"}
					</button>
				</div>
			</form>
		</div>
	);
}
