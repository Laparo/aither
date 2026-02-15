import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("encryption helpers", () => {
	const ORIGINAL = "sensitive-token-value-12345";
	const ENV_KEY = "TOKEN_STORE_ENCRYPTION_KEY";

	beforeEach(() => {
		// clear any env key to start clean
		delete process.env[ENV_KEY];
		// reset module registry so getKey picks up env changes on next dynamic import
		vi.resetModules();
	});

	afterEach(() => {
		delete process.env[ENV_KEY];
	});

	it("returns plaintext when no key is configured", async () => {
		const mod = await import("@/lib/auth/encryption");
		const enc = mod.encryptString(ORIGINAL);
		expect(enc).toBe(ORIGINAL);
		const dec = mod.decryptString(enc);
		expect(dec).toBe(ORIGINAL);
		expect(mod.isEncryptedString(enc)).toBe(false);
	});

	it("encrypts and decrypts when a 32-byte key is configured (base64)", async () => {
		const key = Buffer.alloc(32, 0x42).toString("base64");
		process.env[ENV_KEY] = key;
		const mod = await import("@/lib/auth/encryption");

		const enc = mod.encryptString(ORIGINAL);
		expect(typeof enc).toBe("string");
		expect(enc).not.toBe(ORIGINAL);
		expect(enc.startsWith("enc:")).toBe(true);
		expect(mod.isEncryptedString(enc)).toBe(true);

		const dec = mod.decryptString(enc);
		expect(dec).toBe(ORIGINAL);
	});

	it("decryptString throws on malformed encrypted payloads", async () => {
		const key = Buffer.alloc(32, 0x11).toString("base64");
		process.env[ENV_KEY] = key;
		const mod = await import("@/lib/auth/encryption");

		// Crafted payload that is too short to contain iv+tag
		const bad = `enc:${Buffer.from("short").toString("base64")}`;
		expect(() => mod.decryptString(bad)).toThrow();
	});

	it("decryptString returns input unchanged when not prefixed even with key present", async () => {
		const key = Buffer.alloc(32, 0x77).toString("base64");
		process.env[ENV_KEY] = key;
		const mod = await import("@/lib/auth/encryption");
		const plain = "just-a-plain-string";
		expect(mod.decryptString(plain)).toBe(plain);
	});
});
