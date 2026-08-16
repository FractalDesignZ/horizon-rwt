#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

mkdirSync("/workspace/screenshots", { recursive: true });
const errors = [];
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("http://127.0.0.1:8080/ingest", { waitUntil: "networkidle", timeout: 45000 });
  await page.getByRole("button", { name: "Generate test wells" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("link", { name: "Train", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/workspace/screenshots/train-before.png" });
  const trainBtn = page.getByRole("button", { name: "Train", exact: true });
  await trainBtn.click();
  await page.getByText(/holdout|Holdout/i).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  const body = await page.locator("body").innerText();
  await page.screenshot({ path: "/workspace/screenshots/train-after.png" });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto("http://127.0.0.1:8080/train", { waitUntil: "networkidle", timeout: 45000 });
  await mobile.waitForTimeout(500);
  await mobile.screenshot({ path: "/workspace/screenshots/train-mobile.png" });
  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  if (overflow) throw new Error("mobile overflow on train");
  if (!/HOLD|BUILD|DROP|CUT/.test(body)) throw new Error("no action on train page: " + body.slice(0, 300));
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(2);
  }
  console.log(JSON.stringify({ ok: true, hint: body.slice(0, 400) }, null, 2));
} catch (e) {
  console.error(String(e?.message || e));
  process.exit(1);
} finally {
  await browser.close();
}
