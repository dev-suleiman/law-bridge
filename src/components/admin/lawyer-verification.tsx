"use client";

import {useState} from "react";
import {CheckCircle, XCircle, AlertCircle} from "lucide-react";

interface Lawyer {
	id: string;
	fullName: string;
	barNumber: string;
	bio: string | null;
	consultationFeeGhs: number;
	specialisations: string[];
	regions: string[];
	createdAt: Date;
}

interface LawyerVerificationProps {
	unverifiedLawyers: Lawyer[];
}

export function LawyerVerification({
	unverifiedLawyers,
}: LawyerVerificationProps) {
	const [lawyers, setLawyers] = useState<Lawyer[]>(unverifiedLawyers);
	const [processingId, setProcessingId] = useState<string | null>(null);
	const [rejectionReason, setRejectionReason] = useState<
		Record<string, string>
	>({});

	const handleVerify = async (lawyerId: string, approved: boolean) => {
		setProcessingId(lawyerId);
		try {
			const response = await fetch(
				`/api/admin/lawyers/${lawyerId}/verify`,
				{
					method: "PATCH",
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify({
						action: approved ? "approve" : "reject",
						rejectionReason: rejectionReason[lawyerId],
					}),
				},
			);

			if (response.ok) {
				// Remove from list
				setLawyers(lawyers.filter((l) => l.id !== lawyerId));
				setRejectionReason((prev) => {
					const updated = {...prev};
					delete updated[lawyerId];
					return updated;
				});
			} else {
				alert("Failed to process verification");
			}
		} catch (error) {
			console.error("Error:", error);
			alert("Error processing verification");
		} finally {
			setProcessingId(null);
		}
	};

	if (lawyers.length === 0) {
		return (
			<div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
				<CheckCircle
					size={32}
					className="text-green-600 mx-auto mb-2"
				/>
				<p className="text-green-800 font-semibold">
					All lawyers verified!
				</p>
				<p className="text-green-700 text-sm">
					No pending verifications
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{lawyers.map((lawyer) => (
				<div
					key={lawyer.id}
					className="bg-white border border-border rounded-2xl p-6 hover:border-primary/50 transition-colors"
				>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
						<div>
							<p className="text-sm font-semibold text-text-secondary">
								Full Name
							</p>
							<p className="text-text-primary font-semibold">
								{lawyer.fullName}
							</p>
						</div>
						<div>
							<p className="text-sm font-semibold text-text-secondary">
								Bar Number
							</p>
							<p className="text-text-primary font-mono">
								{lawyer.barNumber}
							</p>
						</div>
						<div>
							<p className="text-sm font-semibold text-text-secondary">
								Consultation Fee
							</p>
							<p className="text-text-primary font-semibold">
								₵{lawyer.consultationFeeGhs.toFixed(2)}/hr
							</p>
						</div>
					</div>

					<div className="mb-4">
						<p className="text-sm font-semibold text-text-secondary mb-1">
							Bio
						</p>
						<p className="text-text-primary text-sm line-clamp-2">
							{lawyer.bio || "No bio provided"}
						</p>
					</div>

					<div className="mb-4">
						<p className="text-sm font-semibold text-text-secondary mb-2">
							Specialisations
						</p>
						<div className="flex flex-wrap gap-2">
							{lawyer.specialisations.map((spec) => (
								<span
									key={spec}
									className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-lg"
								>
									{spec}
								</span>
							))}
						</div>
					</div>

					<div className="mb-6">
						<p className="text-sm font-semibold text-text-secondary mb-2">
							Regions
						</p>
						<div className="flex flex-wrap gap-2">
							{lawyer.regions.map((region) => (
								<span
									key={region}
									className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-lg"
								>
									{region}
								</span>
							))}
						</div>
					</div>

					{/* Rejection reason input */}
					{!rejectionReason[lawyer.id] && (
						<div
							className="mb-4 hidden"
							id={`reject-input-${lawyer.id}`}
						>
							<label className="text-sm font-semibold text-text-secondary mb-2 block">
								Rejection Reason
							</label>
							<textarea
								value={rejectionReason[lawyer.id] || ""}
								onChange={(e) =>
									setRejectionReason((prev) => ({
										...prev,
										[lawyer.id]: e.target.value,
									}))
								}
								placeholder="Explain why the profile is being rejected..."
								className="w-full px-3 py-2 border border-border rounded-lg text-sm"
								rows={2}
							/>
						</div>
					)}

					{/* Action buttons */}
					<div className="flex gap-3">
						<button
							onClick={() => handleVerify(lawyer.id, true)}
							disabled={processingId === lawyer.id}
							className="flex-1 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
						>
							<CheckCircle size={18} />
							Approve
						</button>
						<button
							onClick={() => {
								const input = document.getElementById(
									`reject-input-${lawyer.id}`,
								);
								if (input) input.classList.toggle("hidden");
							}}
							className="flex-1 px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
						>
							<AlertCircle size={18} />
							Reject
						</button>
					</div>

					{/* Confirm reject */}
					{rejectionReason[lawyer.id] !== undefined && (
						<div className="mt-4 flex gap-2">
							<button
								onClick={() => handleVerify(lawyer.id, false)}
								disabled={processingId === lawyer.id}
								className="flex-1 px-3 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
							>
								Confirm Rejection
							</button>
							<button
								onClick={() =>
									setRejectionReason((prev) => {
										const updated = {...prev};
										delete updated[lawyer.id];
										return updated;
									})
								}
								className="flex-1 px-3 py-2 bg-gray-300 text-gray-800 text-sm font-semibold rounded-lg hover:bg-gray-400 transition-colors"
							>
								Cancel
							</button>
						</div>
					)}
				</div>
			))}
		</div>
	);
}
