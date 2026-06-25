import {redirect} from "next/navigation";
import Link from "next/link";
import {getServerUser} from "@/lib/supabase/server";
import {db} from "@/lib/db";
import {profiles, queries, savedCases} from "@/lib/db/schema";
import {eq, desc, count} from "drizzle-orm";
import {Navbar} from "@/components/layout/navbar";
import {
	MessageSquare,
	FolderOpen,
	Star,
	ArrowRight,
	Plus,
	Clock,
} from "lucide-react";
import {formatDistanceToNow} from "date-fns";
import type {Metadata} from "next";

export const metadata: Metadata = {title: "Dashboard"};

export default async function DashboardPage() {
	const user = await getServerUser();
	if (!user) redirect("/login?redirect=/dashboard");

	console.log("[dashboard] User authenticated:", user.email, "ID:", user.id);

	const [profile] = await db
		.select()
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);

	console.log("[dashboard] Profile query result:", profile);

	if (!profile) {
		console.error("[dashboard] No profile found for user:", user.id);
		redirect("/login");
	}

	// Recent queries
	const recentQueries = await db
		.select()
		.from(queries)
		.where(eq(queries.userId, user.id))
		.orderBy(desc(queries.createdAt))
		.limit(5);

	// Saved cases count
	const [{casesCount}] = await db
		.select({casesCount: count()})
		.from(savedCases)
		.where(eq(savedCases.userId, user.id));

	const isPro = profile.subscriptionTier === "pro";

	return (
		<div className="flex flex-col min-h-screen bg-surface-secondary">
			<Navbar user={user} profile={profile} />

			<main className="container mx-auto px-4 py-8 max-w-4xl">
				{/* Welcome */}
				<div className="mb-8">
					<h1 className="font-display text-3xl font-bold text-text-primary">
						Welcome back,{" "}
						{profile.displayName?.split(" ")[0] ?? "there"} 👋
					</h1>
					<p className="text-text-secondary mt-1">
						What legal question can we help you with today?
					</p>
				</div>

				{/* Quick action */}
				<Link
					href="/query"
					className="flex items-center justify-between bg-primary text-white rounded-2xl p-6 mb-6 hover:bg-primary-hover transition-colors group"
				>
					<div className="flex items-center gap-4">
						<div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
							<Plus className="w-6 h-6" />
						</div>
						<div>
							<p className="font-display font-bold text-lg">
								Ask a New Question
							</p>
							<p className="text-white/80 text-sm">
								Get instant legal guidance
							</p>
						</div>
					</div>
					<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
				</Link>

				{/* Stats */}
				<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
					<div className="bg-white rounded-xl border border-border p-5">
						<MessageSquare className="w-6 h-6 text-primary mb-3" />
						<p className="text-2xl font-display font-bold text-text-primary">
							{recentQueries.length}
						</p>
						<p className="text-sm text-text-muted mt-1">
							Recent queries
						</p>
					</div>
					<div className="bg-white rounded-xl border border-border p-5">
						<FolderOpen className="w-6 h-6 text-primary mb-3" />
						<p className="text-2xl font-display font-bold text-text-primary">
							{casesCount}
						</p>
						<p className="text-sm text-text-muted mt-1">
							Saved cases
						</p>
					</div>
					<div className="bg-white rounded-xl border border-border p-5 col-span-2 md:col-span-1">
						<Star className="w-6 h-6 text-accent mb-3" />
						<p className="text-2xl font-display font-bold text-text-primary capitalize">
							{profile.subscriptionTier}
						</p>
						<p className="text-sm text-text-muted mt-1">
							{isPro ? "Unlimited queries" : "10 queries / day"}
						</p>
					</div>
				</div>

				{/* Pro upgrade CTA */}
				{!isPro && (
					<div className="bg-gradient-to-r from-primary to-primary-hover text-white rounded-2xl p-6 mb-8">
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="font-display font-bold text-xl mb-1">
									Upgrade to Pro
								</p>
								<p className="text-white/80 text-sm mb-4">
									Unlimited queries, full case history, PDF
									downloads — GHS 25/month
								</p>
								<Link
									href="/settings/upgrade"
									className="inline-flex items-center gap-2 bg-accent text-text-primary font-bold px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors text-sm"
								>
									Upgrade Now{" "}
									<ArrowRight className="w-4 h-4" />
								</Link>
							</div>
							<Star className="w-12 h-12 text-accent/60 flex-shrink-0" />
						</div>
					</div>
				)}

				{/* Recent queries */}
				<div>
					<div className="flex items-center justify-between mb-4">
						<h2 className="font-display font-bold text-xl text-text-primary">
							Recent Questions
						</h2>
						<Link
							href="/cases"
							className="text-sm text-primary hover:underline"
						>
							View all
						</Link>
					</div>

					{recentQueries.length === 0 ? (
						<div className="bg-white rounded-2xl border border-border p-12 text-center">
							<MessageSquare className="w-12 h-12 text-border mx-auto mb-4" />
							<p className="font-medium text-text-secondary mb-2">
								No questions yet
							</p>
							<p className="text-sm text-text-muted mb-6">
								Ask your first legal question to get started.
							</p>
							<Link
								href="/query"
								className="inline-flex items-center gap-2 bg-primary text-white font-bold px-5 py-2.5 rounded-xl hover:bg-primary-hover transition-colors text-sm"
							>
								Ask a Question
							</Link>
						</div>
					) : (
						<div className="space-y-3">
							{recentQueries.map((q) => (
								<div
									key={q.id}
									className="bg-white rounded-xl border border-border p-5 hover:shadow-sm transition-shadow"
								>
									<p className="text-text-primary font-medium line-clamp-2 mb-2">
										{q.inputText}
									</p>
									<div className="flex items-center gap-3 text-xs text-text-muted">
										<span className="flex items-center gap-1">
											<Clock className="w-3.5 h-3.5" />
											{formatDistanceToNow(
												new Date(q.createdAt),
												{addSuffix: true},
											)}
										</span>
										{q.citedArticles &&
											q.citedArticles.length > 0 && (
												<span className="bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
													{q.citedArticles[0]}
													{q.citedArticles.length > 1
														? ` +${q.citedArticles.length - 1}`
														: ""}
												</span>
											)}
										<span
											className={`px-2 py-0.5 rounded-full font-medium ${
												q.satisfied === true
													? "bg-green-100 text-green-700"
													: q.satisfied === false
														? "bg-red-100 text-red-700"
														: "bg-surface-tertiary text-text-muted"
											}`}
										>
											{q.satisfied === true
												? "Helpful"
												: q.satisfied === false
													? "Not helpful"
													: "No rating"}
										</span>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
