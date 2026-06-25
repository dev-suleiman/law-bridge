"use client";

import {useEffect, useState} from "react";
import {format} from "date-fns";
import {Star, Phone} from "lucide-react";

interface Booking {
	id: string;
	citizenName: string | null;
	scheduledAt: Date | null;
	feeGhs: number;
	status: "pending" | "confirmed" | "completed" | "cancelled";
	meetingLink: string | null;
	citizenRating: number | null;
}

type FilterStatus = "all" | "pending" | "confirmed" | "completed" | "cancelled";

export default function LawyerBookingsPage() {
	const [bookings, setBookings] = useState<Booking[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedFilter, setSelectedFilter] = useState<FilterStatus>("all");

	useEffect(() => {
		const fetchBookings = async () => {
			try {
				const response = await fetch("/api/lawyer/bookings");
				if (response.ok) {
					const data = await response.json();
					setBookings(
						data.bookings.map((b: any) => ({
							...b,
							scheduledAt: b.scheduledAt
								? new Date(b.scheduledAt)
								: null,
						})),
					);
				}
			} catch (error) {
				console.error("Failed to fetch bookings:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchBookings();
	}, []);

	const filteredBookings = bookings.filter((booking) => {
		if (selectedFilter === "all") return true;
		return booking.status === selectedFilter;
	});

	const statusColors = {
		pending: "bg-amber-100 text-amber-800 border-amber-300",
		confirmed: "bg-blue-100 text-blue-800 border-blue-300",
		completed: "bg-green-100 text-green-800 border-green-300",
		cancelled: "bg-gray-100 text-gray-800 border-gray-300",
	};

	const filterTabs: {label: string; value: FilterStatus; count: number}[] = [
		{label: "All", value: "all", count: bookings.length},
		{
			label: "Pending",
			value: "pending",
			count: bookings.filter((b) => b.status === "pending").length,
		},
		{
			label: "Confirmed",
			value: "confirmed",
			count: bookings.filter((b) => b.status === "confirmed").length,
		},
		{
			label: "Completed",
			value: "completed",
			count: bookings.filter((b) => b.status === "completed").length,
		},
		{
			label: "Cancelled",
			value: "cancelled",
			count: bookings.filter((b) => b.status === "cancelled").length,
		},
	];

	if (loading) {
		return (
			<div className="p-6 max-w-6xl mx-auto">
				<div className="flex items-center justify-center h-64">
					<p className="text-text-secondary">Loading bookings...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 max-w-6xl mx-auto">
			{/* Page Header */}
			<div className="mb-8">
				<h1 className="text-3xl font-display font-bold text-primary mb-2">
					All Bookings
				</h1>
				<p className="text-text-secondary">
					Manage and track all your consultations
				</p>
			</div>

			{/* Filter Tabs */}
			<div className="flex gap-2 mb-6 overflow-x-auto pb-2">
				{filterTabs.map((tab) => (
					<button
						key={tab.value}
						onClick={() => setSelectedFilter(tab.value)}
						className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
							selectedFilter === tab.value
								? "bg-primary text-white"
								: "bg-surface-secondary text-text-secondary hover:text-text-primary"
						}`}
					>
						{tab.label} ({tab.count})
					</button>
				))}
			</div>

			{/* Bookings List */}
			{filteredBookings.length === 0 ? (
				<div className="bg-white rounded-2xl border border-border p-12 text-center">
					<p className="text-text-secondary mb-2 text-lg">
						No {selectedFilter === "all" ? "" : selectedFilter}{" "}
						bookings
					</p>
					<p className="text-sm text-text-secondary">
						{selectedFilter === "all"
							? "You don't have any bookings yet"
							: `No bookings with ${selectedFilter} status`}
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{filteredBookings.map((booking) => (
						<BookingCard key={booking.id} booking={booking} />
					))}
				</div>
			)}
		</div>
	);
}

function BookingCard({booking}: {booking: Booking}) {
	const statusColors: Record<string, string> = {
		pending: "bg-amber-100 text-amber-800 border-amber-300",
		confirmed: "bg-blue-100 text-blue-800 border-blue-300",
		completed: "bg-green-100 text-green-800 border-green-300",
		cancelled: "bg-gray-100 text-gray-800 border-gray-300",
	};

	return (
		<div className="bg-white rounded-2xl border border-border p-6 hover:shadow-md transition-shadow">
			<div className="flex items-start justify-between mb-4">
				<div className="flex-1">
					<h3 className="text-lg font-semibold text-text-primary">
						{booking.citizenName || "Anonymous Citizen"}
					</h3>
					<p className="text-sm text-text-secondary">
						{booking.scheduledAt
							? format(
									new Date(booking.scheduledAt),
									"EEE d MMM, h:mm a",
								)
							: "Not scheduled"}
					</p>
				</div>
				<div className="flex items-center gap-4">
					<p className="font-bold text-primary text-lg">
						₵{booking.feeGhs.toFixed(2)}
					</p>
					<span
						className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[booking.status]}`}
					>
						{booking.status.charAt(0).toUpperCase() +
							booking.status.slice(1)}
					</span>
				</div>
			</div>

			{/* Status-based actions */}
			<div className="flex gap-3 pt-4 border-t border-border">
				{booking.status === "confirmed" && booking.meetingLink && (
					<a
						href={booking.meetingLink}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
					>
						<Phone size={16} />
						Join Call
					</a>
				)}
				{booking.status === "completed" && booking.citizenRating && (
					<div className="flex items-center gap-1 px-4 py-2">
						{[...Array(5)].map((_, i) => (
							<Star
								key={i}
								size={16}
								className={
									i < (booking.citizenRating || 0)
										? "fill-yellow-400 text-yellow-400"
										: "text-gray-300"
								}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
