import { test, expect } from "@playwright/test";

import { fulfillJson, mockAuthApiForGuest, stubDashboardDocument } from "./helpers.js";

test("register flow opens local verify link and confirms account", async ({ page }) => {
  await stubDashboardDocument(page);
  await mockAuthApiForGuest(page, async (route, path) => {
    if (path === "/api/auth/register") {
      await fulfillJson(route, {
        dev_verify_url: "/index.html?mode=verify&token=verify-token",
      });
      return true;
    }

    if (path === "/api/auth/verify-email/confirm") {
      await fulfillJson(route, { message: "Email verified successfully. You can sign in now." });
      return true;
    }

    return false;
  });

  await page.goto("/index.html");
  await page.getByRole("button", { name: "Register" }).click();
  await page.getByLabel("Email address").fill("rider@example.com");
  await page.locator("#registerPassword").fill("StrongPass123!");
  await page.locator("#registerPasswordConfirm").fill("StrongPass123!");
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByText("Local verification fallback")).toBeVisible();
  await page.getByRole("button", { name: "Open Verify Link" }).click();
  await expect(page.getByText("Email verified successfully. You can sign in now.")).toBeVisible();
});

test("login flow redirects to dashboard", async ({ page }) => {
  await stubDashboardDocument(page, "Dashboard ready");
  await mockAuthApiForGuest(page, async (route, path) => {
    if (path === "/api/auth/login") {
      await fulfillJson(route, { success: true });
      return true;
    }
    return false;
  });

  await page.goto("/index.html");
  await page.getByLabel("Email or username").fill("tester@example.com");
  await page.locator("#loginPassword").fill("StrongPass123!");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/dashboard.html");
  await expect(page.getByText("Dashboard ready")).toBeVisible();
});

test("forgot password flow opens local reset link and submits new password", async ({ page }) => {
  await stubDashboardDocument(page);
  await mockAuthApiForGuest(page, async (route, path) => {
    if (path === "/api/auth/password-reset/request") {
      await fulfillJson(route, {
        dev_reset_url: "/index.html?mode=reset&token=reset-token",
      });
      return true;
    }

    if (path === "/api/auth/password-reset/confirm") {
      await fulfillJson(route, { success: true });
      return true;
    }

    return false;
  });

  await page.goto("/index.html");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Account email").fill("tester@example.com");
  await page.getByRole("button", { name: "Send Reset Email" }).click();

  await expect(page.getByRole("button", { name: "Open Reset Link" })).toBeVisible();
  await page.getByRole("button", { name: "Open Reset Link" }).click();
  await expect(page.getByText("Single-use link")).toBeVisible();

  await page.locator("#resetPassword").fill("ResetPass123!");
  await page.locator("#resetPasswordConfirm").fill("ResetPass123!");
  await page.getByRole("button", { name: "Save New Password" }).click();
  await page.waitForURL("**/dashboard.html");
});
