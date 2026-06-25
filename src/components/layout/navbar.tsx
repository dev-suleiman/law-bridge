"use client";

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useState} from "react";
import {
	Scale,
	Menu,
	X,
	ChevronDown,
	LogOut,
	User,
	Settings,
	LayoutDashboard,
} from "lucide-react";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import type {Profile} from "@/lib/db/schema";

interface NavbarProps {
	user?: {id: string; email?: string} | null;
	profile?: Profile | null;
}

const NAV_LINKS = [
	{href: "/query", label: "Ask a Question"},
	{href: "/lawyers", label: "Find a Lawyer"},
	{href: "/how-it-works", label: "How It Works"},
];

export function Navbar({user, profile}: NavbarProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [userMenuOpen, setUserMenuOpen] = useState(false);
	const pathname = usePathname();
	const router = useRouter();
	const supabase = createSupabaseBrowserClient();

	const handleSignOut = async () => {
		if (!supabase) {
			router.push("/");
			router.refresh();
			return;
		}
		await supabase.auth.signOut();
		router.push("/");
		router.refresh();
	};

	return (
		<header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border shadow-sm">
			{/* Ghana flag accent bar */}
			<div className="ghana-stripe h-1 w-full" />

			<nav className="container mx-auto px-4 h-16 flex items-center justify-between">
				{/* Logo */}
				<Link
					href="/"
					className="flex items-center gap-2 min-h-0 min-w-0"
				>
					<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
						<Scale className="w-4 h-4 text-white" />
					</div>
					<div className="hidden sm:block">
						<span className="font-display font-bold text-text-primary text-lg leading-tight">
							LawBridge<span className="text-primary"> GH</span>
						</span>
					</div>
				</Link>

				{/* Desktop nav */}
				<div className="hidden md:flex items-center gap-6">
					{NAV_LINKS.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className={`text-sm font-medium transition-colors hover:text-primary min-h-0 ${
								pathname === link.href
									? "text-primary"
									: "text-text-secondary"
							}`}
						>
							{link.label}
						</Link>
					))}
				</div>

				{/* Auth area */}
				<div className="flex items-center gap-3">
					{user ? (
						<div className="relative">
							<button
								onClick={() => setUserMenuOpen(!userMenuOpen)}
								className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-secondary transition-colors text-sm font-medium text-text-primary"
							>
								<div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center">
									<User className="w-4 h-4 text-primary" />
								</div>
								<span className="hidden sm:block max-w-[120px] truncate">
									{profile?.displayName ??
										user.email?.split("@")[0]}
								</span>
								<ChevronDown className="w-4 h-4 text-text-muted" />
							</button>

							{userMenuOpen && (
								<div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-border py-1 z-50">
									{profile?.subscriptionTier === "free" && (
										<Link
											href="/settings/upgrade"
											className="block px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
											onClick={() =>
												setUserMenuOpen(false)
											}
										>
											⭐ Upgrade to Pro
										</Link>
									)}
									<div className="border-t border-border my-1" />
									<Link
										href="/dashboard"
										className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-secondary"
										onClick={() => setUserMenuOpen(false)}
									>
										<LayoutDashboard className="w-4 h-4" />{" "}
										Dashboard
									</Link>
									<Link
										href="/settings"
										className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-secondary"
										onClick={() => setUserMenuOpen(false)}
									>
										<Settings className="w-4 h-4" />{" "}
										Settings
									</Link>
									{profile?.role === "admin" && (
										<Link
											href="/admin"
											className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:bg-surface-secondary"
											onClick={() =>
												setUserMenuOpen(false)
											}
										>
											Admin Dashboard
										</Link>
									)}
									<div className="border-t border-border my-1" />
									<button
										onClick={handleSignOut}
										className="flex items-center gap-2 w-full px-4 py-2 text-sm text-danger hover:bg-red-50"
									>
										<LogOut className="w-4 h-4" /> Sign Out
									</button>
								</div>
							)}
						</div>
					) : (
						<>
							<Link
								href="/login"
								className="hidden sm:block text-sm font-medium text-text-secondary hover:text-primary transition-colors px-3 py-2"
							>
								Sign In
							</Link>
							<Link
								href="/signup"
								className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors"
							>
								Get Started
							</Link>
						</>
					)}

					{/* Mobile menu button */}
					<button
						className="md:hidden p-2 text-text-secondary hover:text-primary"
						onClick={() => setMenuOpen(!menuOpen)}
						aria-label="Toggle menu"
					>
						{menuOpen ? (
							<X className="w-5 h-5" />
						) : (
							<Menu className="w-5 h-5" />
						)}
					</button>
				</div>
			</nav>

			{/* Mobile menu */}
			{menuOpen && (
				<div className="md:hidden border-t border-border bg-white px-4 py-4 space-y-1">
					{NAV_LINKS.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							onClick={() => setMenuOpen(false)}
							className={`block px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
								pathname === link.href
									? "bg-primary/10 text-primary"
									: "text-text-secondary hover:bg-surface-secondary"
							}`}
						>
							{link.label}
						</Link>
					))}
					{!user && (
						<div className="pt-2 border-t border-border">
							<Link
								href="/login"
								onClick={() => setMenuOpen(false)}
								className="block px-3 py-3 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-secondary"
							>
								Sign In
							</Link>
						</div>
					)}
				</div>
			)}
		</header>
	);
}
