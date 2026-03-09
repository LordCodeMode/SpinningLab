import { Buffer } from "node:buffer";
import { test, expect } from "@playwright/test";

import { fulfillJson, mockDashboardApi } from "./helpers.js";

test("dashboard refreshes session when auth cookie is stale", async ({ page }) => {
  let meCalls = 0;

  await mockDashboardApi(page, {
    extraHandler: async (route, path) => {
      if (path === "/api/auth/me") {
        meCalls += 1;
        if (meCalls === 1) {
          await fulfillJson(route, { detail: "Unauthorized" }, 401);
        } else {
          await fulfillJson(route, {
            id: 1,
            username: "tester",
            email: "tester@example.com",
            name: "Test Rider",
          });
        }
        return true;
      }

      if (path === "/api/auth/refresh") {
        await fulfillJson(route, { success: true });
        return true;
      }

      return false;
    },
  });

  await page.goto("/dashboard.html#/settings");
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  await expect(page.getByText("Settings Studio")).toBeVisible();
});

test("logout flow returns to auth page", async ({ page }) => {
  let loggedOut = false;

  await mockDashboardApi(page, {
    extraHandler: async (route, path) => {
      if (path === "/api/auth/me" && loggedOut) {
        await fulfillJson(route, { detail: "Unauthorized" }, 401);
        return true;
      }

      if (path === "/api/auth/logout") {
        loggedOut = true;
        await fulfillJson(route, { success: true });
        return true;
      }
      return false;
    },
  });

  await page.goto("/dashboard.html#/settings");
  await page.getByRole("button", { name: "Logout" }).click();
  await page.waitForURL("**/index.html");
  await expect(page.getByText("Sign in to your dashboard")).toBeVisible();
});

test("strava callback is handled on settings route", async ({ page }) => {
  let callbackSeen = false;

  await mockDashboardApi(page, {
    extraHandler: async (route, path, url) => {
      if (path === "/api/strava/callback") {
        callbackSeen = url.searchParams.get("code") === "demo-code";
        await fulfillJson(route, {
          success: true,
          athlete: {
            firstname: "Demo",
            lastname: "Rider",
          },
        });
        return true;
      }
      return false;
    },
  });

  await page.goto("/dashboard.html?code=demo-code&scope=read");
  await expect.poll(() => callbackSeen).toBeTruthy();
  await page.waitForURL("**/dashboard.html#/settings");
});

test("upload flow waits for async job completion", async ({ page }) => {
  let jobPollCount = 0;

  await mockDashboardApi(page, {
    extraHandler: async (route, path) => {
      if (path === "/api/import/fit-files") {
        await fulfillJson(route, {
          job_id: "job-1",
          status: "queued",
          preflight_duplicates: [],
          preflight_errors: [],
        }, 202);
        return true;
      }

      if (path === "/api/jobs/job-1") {
        jobPollCount += 1;
        if (jobPollCount === 1) {
          await fulfillJson(route, { job_id: "job-1", status: "running" });
        } else {
          await fulfillJson(route, {
            job_id: "job-1",
            status: "succeeded",
            result: {
              results: [{ filename: "test.fit", success: true, message: "Imported" }],
              total: 1,
              successful: 1,
              failed: 0,
            },
          });
        }
        return true;
      }

      return false;
    },
  });

  await page.goto("/dashboard.html#/upload");
  await page.setInputFiles('input[type="file"]', {
    name: "test.fit",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("fake-fit-data"),
  });
  await expect(page.getByText("Selected Files")).toBeVisible();
  await page.getByRole("button", { name: "Upload Files" }).click();
  await expect(page.getByText("Upload Complete")).toBeVisible();
});
