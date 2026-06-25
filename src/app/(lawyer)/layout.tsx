import {redirect} from "next/navigation";
import {getServerUser} from "@/lib/supabase/server";
import {db} from "@/lib/db";
import {profiles, lawyers, bookings} from "@/lib/db/schema";
import {eq, and, count as countFn, sql} from "drizzle-orm";
import {Navbar} from "@/components/layout/navbar";
import {LawyerSidebar} from "@/components/lawyer/lawyer-sidebar";

export default async function LawyerLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// ─── Auth Check ───────────────────────────────────────────────────────────
	const user = await getServerUser();
	if (!user) {
		redirect("/login?redirect=/lawyer/dashboard");
	}

	// ─── Role Check ───────────────────────────────────────────────────────────
	const [profile] = await db
		.select()
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);

	if (!profile) {
		redirect("/login");
	}

	if (profile.role !== "lawyer") {
		redirect("/dashboard");
	}

	// ─── Get Lawyer ID & Pending Count for Sidebar ────────────────────────────
	const [lawyerRecord] = await db
		.select()
		.from(lawyers)
		.where(eq(lawyers.userId, user.id))
		.limit(1);

	let pendingCount = 0;
	if (lawyerRecord) {
		const [{pendingBookings}] = await db
			.select({pendingBookings: sql<number>`count(*)`})
			.from(bookings)
			.where(
				and(
					eq(bookings.lawyerId, lawyerRecord.id),
					eq(bookings.status, "pending"),
				),
			);

		pendingCount = Number(pendingBookings) || 0;
	}

	return (
		<div className="min-h-screen bg-surface">
			<Navbar user={user} profile={profile} />
			<div className="flex gap-0">
				{/* Sidebar */}
				<aside className="hidden lg:block w-64 bg-white border-r border-border sticky top-16 h-[calc(100vh-4rem)]">
					<LawyerSidebar pendingCount={pendingCount} />
				</aside>

				{/* Main Content */}
				<main className="flex-1">
					{/* Mobile Bottom Tab Bar */}
					<div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border">
						<LawyerSidebar
							pendingCount={pendingCount}
							mobile={true}
						/>
					</div>

					{/* Page Content */}
					<div className="pb-20 lg:pb-0">{children}</div>
				</main>
			</div>
		</div>
	);
}
