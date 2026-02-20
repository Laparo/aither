"use client";

// ---------------------------------------------------------------------------
// Full-Screen HD Web Player
// Task: T030 [US4] — Client component, <video> fills viewport at 1920×1080,
//                    no controls, black background, SSE EventSource, handle
//                    play/stop/seek commands, POST state reports back
// ---------------------------------------------------------------------------

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type SSECommand = { action: "play" } | { action: "stop" } | { action: "seek"; position: number };

export default function RecordingPlayerPage() {
	const params = useParams<{ id: string }>();
	const id = params.id;

	const videoRef = useRef<HTMLVideoElement>(null);
	const [error, setError] = useState<string | null>(null);
	const [connected, setConnected] = useState(false);

	// Report player state back to the server
	const reportState = useCallback(
		async (state: string, position: number, errorMessage?: string) => {
			try {
				await fetch("/api/recording/playback/state", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						recordingId: id,
						state,
						position,
						...(errorMessage ? { message: errorMessage } : {}),
					}),
				});
			} catch {
				// Silently fail — state reports are best-effort
			}
		},
		[id],
	);

	useEffect(() => {
		if (!id) {
			setError("No recording ID provided");
			return;
		}

		const video = videoRef.current;
		if (!video) return;

		// Set video source to the streaming endpoint
		video.src = `/api/recording/stream/${id}`;

		// Connect to SSE events
		const eventSource = new EventSource(`/api/recording/events?recordingId=${id}`);

		eventSource.addEventListener("connected", () => {
			setConnected(true);
		});

		eventSource.addEventListener("command", (event) => {
			try {
				const command: SSECommand = JSON.parse(event.data);

				switch (command.action) {
					case "play":
						video.play().catch((err) => {
							setError(`Playback failed: ${err.message}`);
							reportState("error", video.currentTime, err.message);
						});
						break;
					case "stop":
						video.pause();
						break;
					case "seek":
						video.currentTime = command.position;
						break;
				}
			} catch {
				// Invalid SSE data — ignore
			}
		});

		eventSource.onerror = () => {
			setConnected(false);
		};

		// Video event listeners for state reporting
		const onPlay = () => reportState("playing", video.currentTime);
		const onPause = () => reportState("paused", video.currentTime);
		const onEnded = () => reportState("ended", video.currentTime);
		const onError = () => {
			const msg = "Video playback error";
			setError(msg);
			reportState("error", video.currentTime, msg);
		};
		let lastReportTimestamp = 0;
		const onTimeUpdate = () => {
			const now = Date.now();
			if (now - lastReportTimestamp >= 2000) {
				lastReportTimestamp = now;
				reportState(video.paused ? "paused" : "playing", video.currentTime);
			}
		};

		video.addEventListener("play", onPlay);
		video.addEventListener("pause", onPause);
		video.addEventListener("ended", onEnded);
		video.addEventListener("error", onError);
		video.addEventListener("timeupdate", onTimeUpdate);

		return () => {
			eventSource.close();
			video.removeEventListener("play", onPlay);
			video.removeEventListener("pause", onPause);
			video.removeEventListener("ended", onEnded);
			video.removeEventListener("error", onError);
			video.removeEventListener("timeupdate", onTimeUpdate);
		};
	}, [id, reportState]);

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100vw",
				height: "100vh",
				backgroundColor: "#000",
				margin: 0,
				padding: 0,
				overflow: "hidden",
			}}
		>
			{error ? (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: "100%",
						height: "100%",
						color: "#fff",
						fontFamily: "system-ui, sans-serif",
						fontSize: "1.5rem",
					}}
				>
					{error}
				</div>
			) : (
				<video
					ref={videoRef}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "contain",
					}}
					playsInline
					preload="auto"
				>
					<track kind="captions" />
				</video>
			)}
			{!connected && !error && (
				<div
					style={{
						position: "absolute",
						top: 16,
						right: 16,
						color: "#666",
						fontFamily: "system-ui, sans-serif",
						fontSize: "0.75rem",
					}}
				>
					Connecting…
				</div>
			)}
		</div>
	);
}
