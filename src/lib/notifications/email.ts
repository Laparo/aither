// ---------------------------------------------------------------------------
// Email Notification Service — Nodemailer
// Task: T041 [US3] — Threshold-based sending, failure counter
// ---------------------------------------------------------------------------

import nodemailer from "nodemailer";

const NOTIFY_FAILURE_THRESHOLD = Number(process.env.NOTIFY_FAILURE_THRESHOLD) || 3;
let failureCount = 0;

const smtpConfig = {
	host: process.env.SMTP_HOST ?? "localhost",
	port: Number(process.env.SMTP_PORT) || 587,
	secure: false,
	auth: {
		user: process.env.SMTP_USER ?? "",
		pass: process.env.SMTP_PASS ?? "",
	},
};

const mailTransport = nodemailer.createTransport(smtpConfig);

export async function sendFailureNotification(jobId: string, errorSummary: string): Promise<void> {
	failureCount++;
	if (failureCount < NOTIFY_FAILURE_THRESHOLD) return;

	const mailOptions = {
		from: process.env.SMTP_FROM ?? "aither@localhost",
		to: process.env.SMTP_TO ?? "admin@localhost",
		subject: `Aither Sync Failure Notification (job ${jobId})`,
		text: `Sync job ${jobId} failed.\n\nError summary: ${errorSummary}\n\nTimestamp: ${new Date().toISOString()}`,
	};

	await mailTransport.sendMail(mailOptions);
}

export function resetFailureCounter(): void {
	failureCount = 0;
}

export function getFailureCount(): number {
	return failureCount;
}

export function _resetForTesting(): void {
	failureCount = 0;
}
