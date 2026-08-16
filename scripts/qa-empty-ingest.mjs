#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (err) => errors.push(String(err?.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(`${base}/ingest`, { waitUntil: "networkidle", timeout: 45000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(500);
  const dash = await page.locator("body").innerText();
  await page.screenshot({ path: "/workspace/screenshots/empty-dashboard.png" });
  if (!/No wells loaded|Dashboard is empty|Import files/i.test(dash)) {
    throw new Error(`dashboard not empty: ${dash.slice(0, 240)}`);
  }

  await page.getByRole("link", { name: "Import", exact: true }).first().click();
  await page.waitForTimeout(400);
  const two = `data[MD, X, Y, Z, GR, TVT]
0, 0, 0, 0, 80, 100
100, 10, 0, -20, 90, 102
200, 20, 0, -40, 70, 104
300, 30, 0, -60, 85,
400, 40, 0, -80, 88,
data[MD, X, Y, Z, GR, TVT]
0, 200, 10, 0, 82, 101
100, 210, 10, -20, 91, 103
200, 220, 10, -40, 72, 105
300, 230, 10, -60, 86,
400, 240, 10, -80, 89,`;
  await page.locator("#source").fill(two);
  await page.waitForTimeout(300);
  const ingestText = await page.locator("body").innerText();
  await page.screenshot({ path: "/workspace/screenshots/ingest-objects.png" });
  if (!/2 objects/i.test(ingestText)) {
    throw new Error(`expected 2 objects, got: ${ingestText.slice(0, 400)}`);
  }

  await page.getByRole("button", { name: "Import and run" }).click();
  await page.getByText(/Imported 2 wells/).waitFor({ timeout: 8000 });
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.waitForTimeout(800);
  const after = await page.locator("body").innerText();
  await page.screenshot({ path: "/workspace/screenshots/imported-dashboard.png" });
  if (/Dashboard is empty/i.test(after)) {
    throw new Error(`import did not populate dashboard: ${after.slice(0, 300)}`);
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${base}/ingest`, { waitUntil: "networkidle", timeout: 45000 });
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: "/workspace/screenshots/ingest-mobile.png" });
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  if (overflow) throw new Error("mobile horizontal overflow on import");

  const report = { ok: true, errors, bodyHint: after.slice(0, 320) };
  writeFileSync("/workspace/screenshots/qa-empty-ingest.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exit(2);
} catch (err) {
  console.error(String(err?.message || err));
  process.exit(1);
} finally {
  await browser.close();
}
