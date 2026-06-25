import {db} from "@/lib/db";
import {lawyers, bookings, profiles, queries} from "@/lib/db/schema";
import {getServerUser} from "@/lib/supabase/server";
import {eq, and, desc, asc, count as countFn, sql, gte} from "drizzle-orm";
import {redirect} from "next/navigation";
import {format} from "date-fns";
import Link from "next/link";
import {AlertCircle, BookOpen, CheckCircle, Star} from "lucide-react";
import type {Metadata} from "next";

export const metadata: Metadata = {title: "Lawyer Dashboard"};

export default async function LawyerDashboardPage() {
	const user = await getServerUser();
	if (!user) redirect("/login");

	// Get lawyer record
	const [lawyerRecord] = await db
		.select()
		.from(lawyers)
		.where(eq(lawyers.userId, user.id))
		.limit(1);

	if (!lawyerRecord) {
		redirect("/lawyer/profile");
	}

	// ─── Fetch Stats ───────────────────────────────────────────────────────────

	// Total bookings
	const [{totalBookings}] = await db
		.select({totalBookings: sql<number>`count(*)`})
		.from(bookings)
		.where(eq(bookings.lawyerId, lawyerRecord.id));

	// Pending bookings
	const [{pendingBookings}] = await db
		.select({pendingBookings: sql<number>`count(*)`})
		.from(bookings)
		.where(
			and(
				eq(bookings.lawyerId, lawyerRecord.id),
				eq(bookings.status, "pending"),
			),
		);

	// Completed bookings
	const [{completedBookings}] = await db
		.select({completedBookings: sql<number>`count(*)`})
		.from(bookings)
		.where(
			and(
				eq(bookings.lawyerId, lawyerRecord.id),
				eq(bookings.status, "completed"),
			),
		);

	// ─── Fetch Upcoming Confirmed Bookings ──────────────────────────────────────
	const upcomingBookings = await db
		.select({
			id: bookings.id,
			citizenId: bookings.citizenId,
			citizenName: profiles.displayName,
			scheduledAt: bookings.scheduledAt,
			feeGhs: bookings.feeGhs,
			meetingLink: bookings.meetingLink,
		})
		.from(bookings)
		.leftJoin(profiles, eq(bookings.citizenId, profiles.id))
		.where(
			and(
				eq(bookings.lawyerId, lawyerRecord.id),
				eq(bookings.status, "confirmed"),
				gte(bookings.scheduledAt, new Date()),
			),
		)
		.orderBy(asc(bookings.scheduledAt))
		.limit(3);

	// ─── Fetch Pending Requests ────────────────────────────────────────────────
	const pendingRequests = await db
		.select({
			id: bookings.id,
			citizenId: bookings.citizenId,
			citizenName: profiles.displayName,
			queryId: bookings.queryId,
			queryText: queries.inputText,
			feeGhs: bookings.feeGhs,
			createdAt: bookings.createdAt,
		})
		.from(bookings)
		.leftJoin(profiles, eq(bookings.citizenId, profiles.id))
		.leftJoin(queries, eq(bookings.queryId, queries.id))
		.where(
			and(
				eq(bookings.lawyerId, lawyerRecord.id),
				eq(bookings.status, "pending"),
			),
		)
		.orderBy(desc(bookings.createdAt))
		.limit(3);

	// Format dates to Ghana timezone (UTC+0)
	const formatGhanaTime = (date: Date | null) => {
		if (!date) return "Not scheduled";
		// Ghana is UTC+0, so we just format the date as-is
		return format(date, "EEE d MMM, h:mm a");
	};

	const truncateText = (text: string | null, length: number = 150) => {
		if (!text) return "";
		return text.length > length ? `${text.substring(0, length)}...` : text;
	};

	return (
		<div className="p-6 max-w-6xl mx-auto">
			{/* Page Header */}
			<div className="mb-8">
				<h1 className="text-3xl font-display font-bold text-primary mb-2">
					Dashboard
				</h1>
				<p className="text-text-secondary">
					Welcome back, {lawyerRecord.fullName}
				</p>
			</div>

			{/* Verification Status Banner */}
			{!lawyerRecord.isVerified && (
				<div
					className={`mb-6 p-4 rounded-2xl flex items-start gap-3 border-l-4 ${
						lawyerRecord.rejectionReason
							? "bg-red-50 border-l-red-500"
							: "bg-amber-50 border-l-amber-500"
					}`}
				>
					<AlertCircle
						size={20}
						className={
							lawyerRecord.rejectionReason
								? "text-red-600 mt-0.5"
								: "text-amber-600 mt-0.5"
						}
					/>
					<div className="flex-1">
						{lawyerRecord.rejectionReason ? (
							<>
								<h3 className="font-semibold text-red-900 mb-1">
									Profile Rejected
								</h3>
								<p className="text-red-800 text-sm mb-2">
									{lawyerRecord.rejectionReason}
								</p>
								<Link
									href="/lawyer/profile"
									className="text-red-600 hover:text-red-700 text-sm font-semibold"
								>
									Edit Profile →
								</Link>
							</>
						) : (
							<>
								<h3 className="font-semibold text-amber-900 mb-1">
									Verification Pending
								</h3>
								<p className="text-amber-800 text-sm">
									Your profile is pending verification by our
									admin team.
								</p>
							</>
						)}
					</div>
				</div>
			)}

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
				<StatCard
					label="Total Bookings"
					value={Number(totalBookings)}
					icon="📋"
				/>
				<StatCard
					label="Pending Requests"
					value={Number(pendingBookings)}
					icon="⏳"
					highlight={Number(pendingBookings) > 0}
				/>
				<StatCard
					label="Completed Bookings"
					value={Number(completedBookings)}
					icon="✓"
				/>
				<StatCard
					label="Average Rating"
					value={
						lawyerRecord.ratingAvg > 0
							? lawyerRecord.ratingAvg.toFixed(1)
							: "No ratings yet"
					}
					icon="⭐"
					subtitle={`(${lawyerRecord.ratingCount} ${lawyerRecord.ratingCount === 1 ? "rating" : "ratings"})`}
				/>
			</div>

			{/* Two-Column Layout */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Upcoming Confirmed Bookings */}
				<section className="bg-white rounded-2xl border border-border p-6">
					<h2 className="text-xl font-display font-bold text-primary mb-4 flex items-center gap-2">
						<BookOpen size={24} />
						Upcoming Bookings
					</h2>

					{upcomingBookings.length === 0 ? (
						<div className="text-center py-8">
							<p className="text-text-secondary mb-2">
								No upcoming bookings
							</p>
							<p className="text-sm text-text-secondary">
								Accept pending requests to schedule
								consultations
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{upcomingBookings.map((booking) => (
								<div
									key={booking.id}
									className="border border-border rounded-lg p-4 hover:bg-surface-secondary transition-colors"
								>
									<div className="flex items-start justify-between mb-2">
										<div>
											<h3 className="font-semibold text-text-primary">
												{booking.citizenName ||
													"Anonymous"}
											</h3>
											<p className="text-sm text-text-secondary">
												{formatGhanaTime(
													booking.scheduledAt,
												)}
											</p>
										</div>
										<p className="font-bold text-primary">
											₵{booking.feeGhs.toFixed(2)}
										</p>
									</div>
									{booking.meetingLink && (
										<a
											href={booking.meetingLink}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-block mt-3 px-3 py-1 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
										>
											Join Call
										</a>
									)}
								</div>
							))}
						</div>
					)}
				</section>

				{/* Pending Requests */}
				<section className="bg-white rounded-2xl border border-border p-6">
					<h2 className="text-xl font-display font-bold text-primary mb-4 flex items-center gap-2">
						<AlertCircle size={24} />
						Pending Requests
					</h2>

					{pendingRequests.length === 0 ? (
						<div className="text-center py-8">
							<p className="text-text-secondary mb-2">
								No pending requests
							</p>
							<p className="text-sm text-text-secondary">
								New booking requests will appear here
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{pendingRequests.map((request) => (
								<PendingRequestCard
									key={request.id}
									request={request}
									lawyerId={lawyerRecord.id}
								/>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	icon,
	subtitle,
	highlight = false,
}: {
	label: string;
	value: string | number;
	icon: string;
	subtitle?: string;
	highlight?: boolean;
}) {
	return (
		<div
			className={`p-6 rounded-2xl border transition-all ${
				highlight
					? "bg-amber-50 border-amber-200"
					: "bg-white border-border hover:border-primary"
			}`}
		>
			<div className="flex items-start justify-between mb-2">
				<span className="text-3xl">{icon}</span>
				<p className="text-text-secondary text-sm font-medium">
					{label}
				</p>
			</div>
			<p
				className={`text-3xl font-bold ${highlight ? "text-amber-600" : "text-primary"}`}
			>
				{value}
			</p>
			{subtitle && (
				<p className="text-xs text-text-secondary mt-1">{subtitle}</p>
			)}
		</div>
	);
}

interface PendingRequest {
	id: string;
	citizenName: string | null;
	queryText: string | null;
	feeGhs: number;
	createdAt: Date;
}

function PendingRequestCard({
	request,
	lawyerId,
}: {
	request: PendingRequest;
	lawyerId: string;
}) {
	const truncateText = (text: string | null, length: number = 100) => {
		if (!text) return "No details provided";
		return text.length > length ? `${text.substring(0, length)}...` : text;
	};

	const handleAction = async (action: "accept" | "decline") => {
		try {
			const response = await fetch(`/api/lawyer/bookings/${request.id}`, {
				method: "PATCH",
				headers: {"Content-Type": "application/json"},
				body: JSON.stringify({action}),
			});

			if (response.ok) {
				window.location.reload();
			} else {
				alert("Failed to process request");
			}
		} catch (error) {
			console.error("Error:", error);
			alert("Error processing request");
		}
	};

	return (
		<div className="border border-border rounded-lg p-4">
			<h3 className="font-semibold text-text-primary mb-1">
				{request.citizenName || "Anonymous"}
			</h3>
			<p className="text-sm text-text-secondary mb-3 line-clamp-2">
				{truncateText(request.queryText)}
			</p>
			<div className="flex items-center justify-between">
				<div>
					<p className="font-bold text-primary">
						₵{request.feeGhs.toFixed(2)}
					</p>
					<p className="text-xs text-text-secondary">
						Requested {format(request.createdAt, "d MMM HH:mm")}
					</p>
				</div>
				<div className="flex gap-2">
					<button
						onClick={() => handleAction("accept")}
						className="px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
					>
						Accept
					</button>
					<button
						onClick={() => handleAction("decline")}
						className="px-3 py-1 bg-gray-400 text-white text-sm font-medium rounded-lg hover:bg-gray-500 transition-colors"
					>
						Decline
					</button>
				</div>
			</div>
		</div>
	);
}
