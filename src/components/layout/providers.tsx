"use client";

import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useState, useEffect} from "react";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";

export function Providers({children}: {children: React.ReactNode}) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000,
						retry: 1,
					},
				},
			}),
	);

	useEffect(() => {
		const supabase = createSupabaseBrowserClient();

		if (!supabase) {
			console.log("[Providers] Supabase client not available");
			return;
		}

		// Sync existing session on mount
		supabase.auth.getSession().then(async ({data: {session}}) => {
			if (session) {
				console.log(
					"[Providers] Found existing session on mount, syncing to server...",
				);
				const syncRes = await fetch("/api/auth/sync", {
					method: "POST",
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify({
						access_token: session.access_token,
						refresh_token: session.refresh_token,
						expires_in: session.expires_in,
						token_type: session.token_type,
					}),
				});
				const data = await syncRes.json();
				console.log("[Providers] Sync response:", data);
			} else {
				console.log("[Providers] No session found on mount");
			}
		});

		// Keep cookies in sync on every auth state change
		const {
			data: {subscription},
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log("[Providers] Auth event:", event);
			if (event === "SIGNED_IN" && session) {
				console.log(
					"[Providers] SIGNED_IN event, syncing to server...",
				);
				const syncRes = await fetch("/api/auth/sync", {
					method: "POST",
					headers: {"Content-Type": "application/json"},
					body: JSON.stringify({
						access_token: session.access_token,
						refresh_token: session.refresh_token,
						expires_in: session.expires_in,
						token_type: session.token_type,
					}),
				});
				const data = await syncRes.json();
				console.log("[Providers] Sync response:", data);
			}
		});

		return () => subscription.unsubscribe();
	}, []);

	return (
		<QueryClientProvider client={queryClient}>
			{children}
		</QueryClientProvider>
	);
}
