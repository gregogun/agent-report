import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
let dir: string;
let browser: Browser;

const git = (...args: string[]) =>
	execFileSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8", stdio: "pipe" });

beforeAll(async () => {
	dir = mkdtempSync(join(tmpdir(), "agent-report-e2e-"));
	git("init", "-q", "-b", "main");
	git("config", "user.name", "Test");
	git("config", "user.email", "test@example.com");
	const before = Array.from({ length: 12 }, (_, i) => `export const v${i + 1} = ${i + 1};`);
	writeFileSync(join(dir, "a.ts"), `${before.join("\n")}\n`);
	git("add", ".");
	git("commit", "-q", "-m", "first");
	before[5] = "export const sixth = 600;";
	writeFileSync(join(dir, "a.ts"), `${before.join("\n")}\n`);
	git("add", ".");
	git("commit", "-q", "-m", "second");
	writeFileSync(
		join(dir, "report.md"),
		[
			"---",
			"version: 1",
			"title: E2E report",
			"---",
			"",
			"Intro prose.",
			"",
			"## First section",
			"",
			"Some words.",
			"",
			"## Second section",
			"",
			"More words.",
			"",
			"```diff range=HEAD~1..HEAD path=a.ts",
			"@new:6 The sixth constant was renamed and rescaled.",
			"```",
			"",
		].join("\n"),
	);
	execFileSync(join(root, "node_modules/.bin/tsx"), ["--tsconfig", join(root, "tsconfig.json"), join(root, "src/cli/index.ts"), "build", "report.md"], { cwd: dir });
	browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
	await browser?.close();
	rmSync(dir, { recursive: true, force: true });
});

it("renders the diff and annotation offline from disk", async () => {
	const page = await browser.newPage();
	const requests: string[] = [];
	await page.route("**/*", (route) => {
		requests.push(route.request().url());
		return route.continue();
	});
	await page.goto(`file://${join(dir, "report.html")}`);

	const lines = await page.locator("diffs-container").evaluate((host) => host.shadowRoot?.querySelectorAll("[data-line]").length ?? 0);
	expect(lines).toBeGreaterThan(0);

	const note = page.getByText("The sixth constant was renamed and rescaled.");
	await note.waitFor({ state: "visible" });
	const slotted = await note.evaluate((el) => el.closest("[slot]")?.getAttribute("slot"));
	expect(slotted).toBe("annotation-additions-6");

	const noteBox = await note.boundingBox();
	const lineBox = await page
		.locator("diffs-container")
		.evaluate((host) => host.shadowRoot?.querySelector('[data-line][data-line-index]')?.getBoundingClientRect().toJSON());
	expect(noteBox && lineBox && noteBox.y > lineBox.y).toBe(true);

	expect(requests.every((url) => url.startsWith("file://"))).toBe(true);
	await page.close();
}, 30_000);

it("shows the contents rail, follows scroll, and fits a phone without page scroll", async () => {
	const page = await browser.newPage({ viewport: { width: 1280, height: 400 } });
	await page.goto(`file://${join(dir, "report.html")}`);
	const links = page.locator("nav a");
	expect(await links.allTextContents()).toEqual(["First section", "Second section"]);
	await page.locator("#second-section").scrollIntoViewIfNeeded();
	await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
	await page.locator('nav a[aria-current="location"]').waitFor();
	expect(await page.locator('nav a[aria-current="location"]').textContent()).toBe("Second section");

	await page.setViewportSize({ width: 375, height: 800 });
	const widths = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
	expect(widths[0]).toBe(widths[1]);
	await page.close();
}, 30_000);
