// ---------------------------------------------------------------------------
// Unit Tests: Email Notifications
// Task: T039 [US3] — Threshold failures, counter reset, email content
// ---------------------------------------------------------------------------

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock loadConfig — must come before email module import
vi.mock("@/lib/config", () => ({
	loadConfig: vi.fn(() => ({
		SMTP_HOST: "localhost",
		SMTP_PORT: 587,
		SMTP_USER: "user",
		SMTP_PASS: "pass",
		SMTP_FROM: "aither@localhost",
		SMTP_TO: undefined,
		NOTIFY_EMAIL_TO: "admin@localhost",
		NOTIFY_FAILURE_THRESHOLD: 3,
	})),
}));

// Mock Nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: "test-123" });
vi.mock("nodemailer", () => ({
	default: {
		createTransport: vi.fn().mockReturnValue({
			sendMail: mockSendMail,
		}),
	},
}));

describe("Email Notifications", () => {
	let sendFailureNotification: (jobId: string, error: string) => Promise<void>;
	let resetFailureCounter: () => void;
	let getFailureCount: () => number;
	let _resetForTesting: () => void;

	beforeAll(async () => {
		({ sendFailureNotification, resetFailureCounter, getFailureCount, _resetForTesting } =
			await import("@/lib/notifications/email"));
	});

	beforeEach(() => {
		mockSendMail.mockClear().mockResolvedValue({ messageId: "test-123" });
		_resetForTesting();
	});

	it("does not send email below failure threshold", async () => {
		await sendFailureNotification("job-1", "sync error 1");
		await sendFailureNotification("job-2", "sync error 2");
		// Default threshold is 3, so 2 failures should NOT trigger email
		expect(mockSendMail).not.toHaveBeenCalled();
	});

	it("sends email when failure threshold is reached", async () => {
		await sendFailureNotification("job-1", "error 1");
		await sendFailureNotification("job-2", "error 2");
		await sendFailureNotification("job-3", "error 3");
		// 3rd consecutive failure should trigger email
		expect(mockSendMail).toHaveBeenCalledTimes(1);
	});

	it("includes job ID and error summary in email body", async () => {
		await sendFailureNotification("job-1", "error 1");
		await sendFailureNotification("job-2", "error 2");
		await sendFailureNotification("job-3", "error 3");

		const mailOptions = mockSendMail.mock.calls[0][0];
		expect(mailOptions.text).toContain("job-3");
		expect(mailOptions.text).toContain("error 3");
		expect(mailOptions.subject).toContain("Sync");
	});

	it("continues sending emails for subsequent failures beyond threshold", async () => {
		// Fehler 1 & 2: unter Schwellenwert, keine E-Mail
		await sendFailureNotification("job-1", "error 1");
		expect(getFailureCount()).toBe(1);
		await sendFailureNotification("job-2", "error 2");
		expect(getFailureCount()).toBe(2);
		expect(mockSendMail).toHaveBeenCalledTimes(0);

		// Fehler 3: Schwellenwert erreicht, erste E-Mail
		await sendFailureNotification("job-3", "error 3");
		expect(getFailureCount()).toBe(3);
		expect(mockSendMail).toHaveBeenCalledTimes(1);

		// Fehler 4: über Schwellenwert, zweite E-Mail
		await sendFailureNotification("job-4", "error 4");
		expect(getFailureCount()).toBe(4);
		expect(mockSendMail).toHaveBeenCalledTimes(2);

		// Fehler 5: über Schwellenwert, dritte E-Mail
		await sendFailureNotification("job-5", "error 5");
		expect(getFailureCount()).toBe(5);
		expect(mockSendMail).toHaveBeenCalledTimes(3);
	});

	it("resets counter on success, requiring threshold again for next email", async () => {
		await sendFailureNotification("job-1", "error 1");
		await sendFailureNotification("job-2", "error 2");
		resetFailureCounter();
		expect(getFailureCount()).toBe(0);

		await sendFailureNotification("job-3", "error 3");
		// Only 1 failure after reset — no email yet
		expect(mockSendMail).not.toHaveBeenCalled();
	});

	it("tracks failure count correctly", async () => {
		expect(getFailureCount()).toBe(0);
		await sendFailureNotification("job-1", "error 1");
		expect(getFailureCount()).toBe(1);
		await sendFailureNotification("job-2", "error 2");
		expect(getFailureCount()).toBe(2);
	});
});
