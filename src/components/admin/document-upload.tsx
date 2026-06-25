"use client";

import {useState} from "react";
import {Upload, FileText, X} from "lucide-react";

export function DocumentUpload() {
	const [uploading, setUploading] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [actName, setActName] = useState("");
	const [actNumber, setActNumber] = useState("");
	const [year, setYear] = useState(new Date().getFullYear().toString());
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			if (!file.name.endsWith(".pdf")) {
				setError("Only PDF files are supported");
				return;
			}
			if (file.size > 50 * 1024 * 1024) {
				setError("File size must be less than 50MB");
				return;
			}
			setSelectedFile(file);
			setError(null);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!selectedFile) {
			setError("Please select a file");
			return;
		}

		if (!actName.trim()) {
			setError("Please enter the act name");
			return;
		}

		setUploading(true);
		setError(null);

		try {
			const formData = new FormData();
			formData.append("file", selectedFile);
			formData.append("actName", actName);
			formData.append("actNumber", actNumber);
			formData.append("year", year);

			const res = await fetch("/api/admin/upload-document", {
				method: "POST",
				body: formData,
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "Upload failed");
				return;
			}

			setSuccess(true);
			setSelectedFile(null);
			setActName("");
			setActNumber("");
			setYear(new Date().getFullYear().toString());

			setTimeout(() => setSuccess(false), 3000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="bg-white rounded-2xl border border-border overflow-hidden">
			<div className="px-6 py-4 border-b border-border">
				<h3 className="font-display font-bold text-lg text-text-primary">
					Upload Document
				</h3>
			</div>

			<form onSubmit={handleSubmit} className="p-6 space-y-4">
				{/* Act Name */}
				<div>
					<label className="block text-sm font-medium text-text-primary mb-1.5">
						Act Name *
					</label>
					<input
						type="text"
						value={actName}
						onChange={(e) => setActName(e.target.value)}
						placeholder="e.g., Criminal Procedure Code"
						className="w-full px-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
					/>
				</div>

				{/* Act Number */}
				<div>
					<label className="block text-sm font-medium text-text-primary mb-1.5">
						Act Number
					</label>
					<input
						type="text"
						value={actNumber}
						onChange={(e) => setActNumber(e.target.value)}
						placeholder="e.g., NRCD 30"
						className="w-full px-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
					/>
				</div>

				{/* Year */}
				<div>
					<label className="block text-sm font-medium text-text-primary mb-1.5">
						Year
					</label>
					<input
						type="number"
						value={year}
						onChange={(e) => setYear(e.target.value)}
						className="w-full px-4 py-2 rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
					/>
				</div>

				{/* File Upload */}
				<div>
					<label className="block text-sm font-medium text-text-primary mb-1.5">
						PDF File *
					</label>
					<div className="relative">
						<input
							type="file"
							accept=".pdf"
							onChange={handleFileSelect}
							disabled={uploading}
							className="hidden"
							id="file-input"
						/>
						<label
							htmlFor="file-input"
							className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/50 cursor-pointer transition-colors"
						>
							<FileText className="w-5 h-5 text-text-muted" />
							<span className="text-sm text-text-muted">
								{selectedFile
									? selectedFile.name
									: "Click to select or drag PDF"}
							</span>
						</label>
					</div>
					{selectedFile && (
						<p className="text-xs text-text-muted mt-1">
							{(selectedFile.size / 1024 / 1024).toFixed(2)} MB
						</p>
					)}
				</div>

				{/* Error Message */}
				{error && (
					<div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
						<X className="w-4 h-4" />
						{error}
					</div>
				)}

				{/* Success Message */}
				{success && (
					<div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
						Document uploaded successfully! Processing...
					</div>
				)}

				{/* Submit Button */}
				<button
					type="submit"
					disabled={uploading || !selectedFile}
					className="w-full flex items-center justify-center gap-2 bg-primary text-white font-semibold py-2.5 rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60"
				>
					<Upload className="w-4 h-4" />
					{uploading ? "Uploading..." : "Upload Document"}
				</button>
			</form>
		</div>
	);
}
