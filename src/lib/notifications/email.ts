// ---------------------------------------------------------------------------
// Email Notification Service — Nodemailer
// Task: T041 [US3] — Threshold-based sending, failure counter
// ---------------------------------------------------------------------------

import { loadConfig } from "@/lib/config";
import nodemailer from "nodemailer";

let failureCount = 0;

/** Lazily created transport — avoids reading env at module load time. */
let _transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
	if (_transport) return _transport;
	const cfg = loadConfig();
	_transport = nodemailer.createTransport({
		host: cfg.SMTP_HOST,
		port: cfg.SMTP_PORT,
		secure: false,
		auth: {
			user: cfg.SMTP_USER,
			pass: cfg.SMTP_PASS,
		},
	});
	return _transport;
}

export async function sendFailureNotification(jobId: string, errorSummary: string): Promise<void> {
	const cfg = loadConfig();
	failureCount++;
	if (failureCount < cfg.NOTIFY_FAILURE_THRESHOLD) return;

	const mailOptions = {
		from: cfg.SMTP_FROM,
		to: cfg.SMTP_TO ?? cfg.NOTIFY_EMAIL_TO,
		subject: `Aither Sync Failure Notification (job ${jobId})`,
		text: `Sync job ${jobId} failed.\n\nError summary: ${errorSummary}\n\nTimestamp: ${new Date().toISOString()}`,
	};

	await getTransport().sendMail(mailOptions);
}

export function resetFailureCounter(): void {
	failureCount = 0;
}

export function getFailureCount(): number {
	return failureCount;
}

export function _resetForTesting(): void {
	failureCount = 0;
	_transport = null;
}
