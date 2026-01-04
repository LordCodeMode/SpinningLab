# Deploy: Render (API) + Cloudflare Pages (Frontend)

This setup keeps the backend on Render (free) and the frontend on Cloudflare Pages (free).

## 1) Render (Backend + Postgres)
1. Create a Render account and connect this repo.
2. Render should detect `render.yaml` and propose:
   - `training-dashboard-backend` (web service)
   - `training-dashboard-db` (Postgres)
3. Fill in the missing env vars in the Render service:
   - `BACKEND_CORS_ORIGINS` = `https://<your-cloudflare-domain>`
   - `REDIS_URL` = `rediss://<your-upstash-redis-url>`
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`
   - `STRAVA_REDIRECT_URI` = `https://<your-cloudflare-domain>/dashboard.html#/settings`
4. Deploy. Render will install dependencies and start the API.
5. Once live, copy the backend URL, e.g. `https://training-dashboard-backend.onrender.com`.

## 2) Upstash (Redis)
1. Create a free Upstash Redis database.
2. Copy the TLS URL (starts with `rediss://`).
3. Paste it into Render as `REDIS_URL`.

## 3) Cloudflare Pages (Frontend)
1. Create a Cloudflare Pages project from this repo.
2. Build settings:
   - Root directory: `frontend`
   - Build command: `npm install && npm run build`
   - Output directory: `dist`
3. Set environment variable:
   - `VITE_API_BASE_URL` = `https://<your-render-backend-url>`
4. Deploy. Cloudflare will host `index.html` (auth) and `dashboard.html` (app).

## 4) Post-deploy checks
- Visit the Cloudflare Pages URL, log in, and ensure API calls go to Render.
- If CORS errors appear, confirm `BACKEND_CORS_ORIGINS` exactly matches the Cloudflare domain.
- For Strava, ensure your Strava app has the same redirect URI as `STRAVA_REDIRECT_URI`.

## 5) Optional: Run migrations on Render
If you prefer automatic migrations after deploy, add a Render “Post‑deploy” command:
`cd backend && alembic upgrade head`
