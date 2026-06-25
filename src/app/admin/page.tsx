import {redirect} from "next/navigation";
import {getServerUser} from "@/lib/supabase/server";
import {db} from "@/lib/db";
import {
	profiles,
	legalDocuments,
	corpusJobs,
	queries,
	analyticsDaily,
	lawyers,
} from "@/lib/db/schema";
import {eq, desc, count, sum, avg} from "drizzle-orm";
import {Navbar} from "@/components/layout/navbar";
import {AdminCorpusTable} from "@/components/admin/corpus-table";
import {AdminStats} from "@/components/admin/admin-stats";
import {DocumentUpload} from "@/components/admin/document-upload";
import {LawyerVerification} from "@/components/admin/lawyer-verification";
import {BarChart2, FileText, Users, Zap, Scale} from "lucide-react";
import type {Metadata} from "next";

export const metadata: Metadata = {title: "Admin Dashboard"};

export default async function AdminPage() {
	const user = await getServerUser();
	if (!user) {
		console.log("[admin] No user, redirecting to login");
		redirect("/login");
	}

	const [profile] = await db
		.select()
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);
	if (!profile || profile.role !== "admin") {
		console.log("[admin] User not admin, redirecting to dashboard");
		redirect("/dashboard");
	}

	console.log(`[admin] Admin user verified: ${user.email}`);

	// Fetch documents
	const documents = await db
		.select()
		.from(legalDocuments)
		.orderBy(desc(legalDocuments.createdAt));

	// Fetch recent jobs
	const recentJobs = await db
		.select()
		.from(corpusJobs)
		.orderBy(desc(corpusJobs.createdAt))
		.limit(10);

	// Aggregate stats
	const [queryStats] = await db
		.select({
			total: count(),
			avgLatency: avg(queries.latencyMs),
		})
		.from(queries);

	const [userStats] = await db.select({total: count()}).from(profiles);

	// Recent analytics
	const recentAnalytics = await db
		.select()
		.from(analyticsDaily)
		.orderBy(desc(analyticsDaily.date))
		.limit(7);

	// Fetch unverified lawyers
	const unverifiedLawyers = await db
		.select()
		.from(lawyers)
		.where(eq(lawyers.isVerified, false))
		.orderBy(desc(lawyers.createdAt));

	return (
		<div className="flex flex-col min-h-screen bg-surface-secondary">
			<Navbar user={user} profile={profile} />

			<main className="container mx-auto px-4 py-8 max-w-7xl">
				<div className="mb-8">
					<h1 className="font-display text-3xl font-bold text-text-primary">
						Admin Dashboard
					</h1>
					<p className="text-text-secondary mt-1">
						Corpus management, analytics, and platform health
					</p>
				</div>

				{/* Stats overview */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
					{[
						{
							label: "Total Queries",
							value: queryStats.total.toLocaleString(),
							icon: Zap,
							color: "text-primary",
						},
						{
							label: "Total Users",
							value: userStats.total.toLocaleString(),
							icon: Users,
							color: "text-blue-600",
						},
						{
							label: "Avg Latency",
							value: `${Math.round(Number(queryStats.avgLatency) || 0)}ms`,
							icon: BarChart2,
							color: "text-amber-600",
						},
						{
							label: "Legal Documents",
							value: documents.length.toString(),
							icon: FileText,
							color: "text-green-600",
						},
					].map((stat) => (
						<div
							key={stat.label}
							className="bg-white rounded-xl border border-border p-5"
						>
							<stat.icon
								className={`w-6 h-6 ${stat.color} mb-3`}
							/>
							<p className="text-2xl font-display font-bold text-text-primary">
								{stat.value}
							</p>
							<p className="text-sm text-text-muted mt-1">
								{stat.label}
							</p>
						</div>
					))}
				</div>

				<div className="grid lg:grid-cols-3 gap-8">
					{/* Corpus management — takes 2/3 width */}
					<div className="lg:col-span-2 space-y-6">
						<DocumentUpload />

						<div className="bg-white rounded-2xl border border-border overflow-hidden">
							<div className="px-6 py-4 border-b border-border flex items-center justify-between">
								<h2 className="font-display font-bold text-xl text-text-primary">
									Legal Corpus
								</h2>
								<span className="text-sm text-text-muted">
									{documents.length} documents
								</span>
							</div>
							<AdminCorpusTable
								documents={documents}
								recentJobs={recentJobs}
							/>
						</div>
					</div>

					{/* Sidebar */}
					<div className="space-y-6">
						{/* Recent analytics */}
						<div className="bg-white rounded-2xl border border-border overflow-hidden">
							<div className="px-6 py-4 border-b border-border">
								<h2 className="font-display font-bold text-xl text-text-primary">
									Last 7 Days
								</h2>
							</div>
							<div className="p-6 space-y-4">
								{recentAnalytics.length === 0 ? (
									<p className="text-sm text-text-muted">
										No analytics data yet
									</p>
								) : (
									recentAnalytics.map((day) => (
										<div
											key={day.id}
											className="flex justify-between items-center text-sm"
										>
											<span className="text-text-muted">
												{day.date}
											</span>
											<div className="flex gap-4">
												<span className="font-medium text-text-primary">
													{day.totalQueries} queries
												</span>
												<span className="text-text-muted">
													{day.uniqueUsers} users
												</span>
											</div>
										</div>
									))
								)}
							</div>
						</div>

						{/* Quick links */}
						<div className="bg-white rounded-2xl border border-border overflow-hidden">
							<div className="px-6 py-4 border-b border-border">
								<h2 className="font-display font-bold text-xl text-text-primary">
									Quick Actions
								</h2>
							</div>
							<div className="p-4 space-y-2">
								{[
									{
										href: "/admin/users",
										label: "Manage Users & Lawyers",
									},
									{
										href: "/admin/bookings",
										label: "View Bookings",
									},
									{
										href: "/admin/flagged",
										label: "Flagged Responses",
									},
								].map((link) => (
									<a
										key={link.href}
										href={link.href}
										className="block px-4 py-3 rounded-xl text-sm text-text-secondary hover:bg-surface-secondary hover:text-primary transition-colors"
									>
										{link.label} →
									</a>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Lawyer Verification Section */}
				<div className="mt-12">
					<div className="mb-6">
						<div className="flex items-center gap-2 mb-2">
							<Scale className="w-6 h-6 text-primary" />
							<h2 className="font-display text-2xl font-bold text-text-primary">
								Lawyer Verification
							</h2>
						</div>
						<p className="text-text-secondary">
							Review and approve/reject pending lawyer profiles
						</p>
					</div>
					<LawyerVerification unverifiedLawyers={unverifiedLawyers} />
				</div>
			</main>
		</div>
	);
}
