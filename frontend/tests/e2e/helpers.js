export const TEST_USER = {
  id: 1,
  username: "tester",
  email: "tester@example.com",
  name: "Test Rider",
};

export async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function stubDashboardDocument(page, label = "Dashboard target") {
  await page.route("**/dashboard.html", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><html><body><main>${label}</main></body></html>`,
    });
  });
}

export async function mockAuthApiForGuest(page, extraHandler = null) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (extraHandler) {
      const handled = await extraHandler(route, path, url);
      if (handled) return;
    }

    if (path === "/api/auth/me") {
      await fulfillJson(route, { detail: "Unauthorized" }, 401);
      return;
    }

    await fulfillJson(route, {});
  });
}

export async function mockDashboardApi(page, { user = TEST_USER, extraHandler = null } = {}) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (extraHandler) {
      const handled = await extraHandler(route, path, url, request);
      if (handled) return;
    }

    if (path === "/api/auth/me") {
      await fulfillJson(route, user);
      return;
    }

    if (path === "/api/settings/" || path === "/api/settings") {
      if (request.method() === "GET") {
        await fulfillJson(route, {
          name: user.name,
          username: user.username,
          email: user.email,
          ftp: 280,
          weight: 72,
          hr_max: 190,
          hr_rest: 52,
          lthr: 172,
        });
        return;
      }
      await fulfillJson(route, {});
      return;
    }

    if (path === "/api/strava/status") {
      await fulfillJson(route, { connected: false, athlete_id: null, last_sync: null });
      return;
    }

    if (path.startsWith("/api/activities")) {
      await fulfillJson(route, { activities: [], items: [], total: 0, page: 1, pages: 1 });
      return;
    }

    await fulfillJson(route, {});
  });
}
