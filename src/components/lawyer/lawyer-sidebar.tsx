"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {LayoutDashboard, Calendar, User, AlertCircle} from "lucide-react";

interface LawyerSidebarProps {
	pendingCount: number;
	mobile?: boolean;
}

export function LawyerSidebar({
	pendingCount,
	mobile = false,
}: LawyerSidebarProps) {
	const pathname = usePathname();

	const links = [
		{href: "/lawyer/dashboard", label: "Dashboard", icon: LayoutDashboard},
		{
			href: "/lawyer/bookings",
			label: "Bookings",
			icon: Calendar,
			badge: pendingCount > 0 ? pendingCount : null,
		},
		{href: "/lawyer/profile", label: "My Profile", icon: User},
	];

	if (mobile) {
		return (
			<nav className="flex overflow-x-auto px-4 py-2 gap-2">
				{links.map((link) => {
					const Icon = link.icon;
					const isActive = pathname === link.href;
					return (
						<Link
							key={link.href}
							href={link.href}
							className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
								isActive
									? "text-primary bg-primary/10"
									: "text-text-secondary hover:text-text-primary"
							}`}
						>
							<Icon size={20} />
							<span className="text-xs">{link.label}</span>
							{link.badge && (
								<span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center absolute top-0 right-0">
									{link.badge}
								</span>
							)}
						</Link>
					);
				})}
			</nav>
		);
	}

	// Desktop sidebar
	return (
		<nav className="flex flex-col gap-2 p-6">
			{links.map((link) => {
				const Icon = link.icon;
				const isActive = pathname === link.href;
				return (
					<Link
						key={link.href}
						href={link.href}
						className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors relative ${
							isActive
								? "text-primary bg-primary/10 border-l-4 border-primary"
								: "text-text-secondary hover:text-text-primary hover:bg-surface-secondary"
						}`}
					>
						<Icon size={20} />
						<span>{link.label}</span>
						{link.badge && (
							<span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
								{link.badge}
							</span>
						)}
					</Link>
				);
			})}
		</nav>
	);
}
