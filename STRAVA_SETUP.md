# Strava Integration Setup Guide

This guide will walk you through setting up Strava OAuth integration for your Training Dashboard, enabling automatic activity imports with full power and heart rate data.

## Benefits

✅ **Auto-Import Activities** - No more manual FIT file uploads
✅ **Full Data Streams** - Power, HR, cadence, temperature, and more
✅ **Instant Analysis** - Automatic power curve, zones, and metrics calculation
✅ **Always Up-to-Date** - Sync anytime to import new activities

---

## Step 1: Create a Strava API Application

1. **Go to Strava API Settings**
   - Visit: https://www.strava.com/settings/api
   - Log in with your Strava account if needed

2. **Create New Application**
   - Click "Create & Manage Your App" (if first time) or scroll to "My API Application"
   - Fill in the application details:
     - **Application Name**: `Training Dashboard` (or any name you prefer)
     - **Category**: Choose `Training` or `Data Analysis`
     - **Club**: Leave blank (optional)
     - **Website**: `http://localhost:8080` (or your domain in production)
     - **Application Description**: `Personal training analytics dashboard` (or similar)
     - **Authorization Callback Domain**: `localhost` (or your domain without http://)

3. **Important: Authorization Callback**
   - Make sure the callback domain is exactly `localhost` for local development
   - For production, use your actual domain (e.g., `yourdomain.com`)

4. **Upload Icon** (Optional)
   - Upload an icon for your application if desired

5. **Click "Create"**

---

## Step 2: Get Your API Credentials

After creating your application, you'll see:

- **Client ID**: A numerical ID (e.g., `123456`)
- **Client Secret**: A long alphanumeric string (e.g., `abc123def456...`)

**⚠️ IMPORTANT:** Keep your Client Secret confidential! Never commit it to version control.

---

## Step 3: Configure Your Training Dashboard

1. **Open your `.env` file** in the `backend/` directory

2. **Add your Strava credentials:**

```bash
# Strava API Integration
STRAVA_CLIENT_ID=123456
STRAVA_CLIENT_SECRET=abc123def456789yoursecrethere
STRAVA_REDIRECT_URI=http://localhost:8080/#/settings
```

3. **For Production Deployment**, update the redirect URI:

```bash
STRAVA_REDIRECT_URI=https://yourdomain.com/#/settings
```

And make sure your Strava app's "Authorization Callback Domain" matches your domain.

---

## Step 4: Restart Your Backend Server

The backend needs to reload the new environment variables:

```bash
# Stop your current backend server (Ctrl+C)

# Restart it
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

---

## Step 5: Connect Your Strava Account

1. **Open Training Dashboard** in your browser: http://localhost:8080

2. **Navigate to Settings** (click the gear icon in sidebar)

3. **Find the "Strava Integration" card**

4. **Click "Connect with Strava"**

5. **Authorize on Strava**
   - You'll be redirected to Strava
   - Review the permissions requested:
     - ✅ Read all activity data
     - ✅ View private activities
   - Click **"Authorize"**

6. **You'll be redirected back** to your Training Dashboard Settings page

7. **Success!** You should see:
   - ✅ "Connected to Strava"
   - Your Strava Athlete ID
   - Sync and Disconnect buttons

---

## Step 6: Import Your Activities

1. **Click "Sync Activities from Strava"**

2. **Wait for import** (this may take a while for many activities)
   - The system fetches all your activities
   - Downloads power and HR streams
   - Calculates power curves, zones, TSS, etc.
   - Builds caches for fast analysis

3. **Check Progress**
   - You'll see a success notification with import stats
   - Navigate to Activities page to see your imported activities
   - Power Curve, Training Load, and other pages will now show data

---

## What Gets Imported?

For each Strava activity, the system imports:

### Basic Metadata
- Start time & date
- Duration & distance
- Activity type

### Power Metrics (if available)
- Average power
- Normalized power (NP)
- Intensity Factor (IF)
- Training Stress Score (TSS)
- Peak powers: 5s, 1min, 3min, 5min, 10min, 20min, 30min, 60min
- Power zone distribution

### Heart Rate Metrics (if available)
- Average heart rate
- Maximum heart rate
- HR zone distribution
- Efficiency Factor (NP/HR)

### Advanced Analysis
- Power curve data points
- Zone-by-zone time analysis
- CTL/ATL/TSB contribution
- VO2max estimates

---

## Troubleshooting

### "Failed to connect to Strava"

**Check:**
- ✅ Client ID and Secret are correct in `.env`
- ✅ No extra spaces or quotes in `.env` values
- ✅ Backend server was restarted after editing `.env`
- ✅ Authorization Callback Domain in Strava app settings matches your domain

### "Sync failed" or "No activities imported"

**Possible reasons:**
- No activities with power data in your Strava account
- Strava API rate limit (100 requests per 15 minutes)
- Network connectivity issues
- Activities are private and scope wasn't granted

**Solution:**
Try syncing again after a few minutes. Check browser console for specific error messages.

### "Invalid redirect URI"

**Fix:**
- Make sure `STRAVA_REDIRECT_URI` in `.env` exactly matches the URL pattern
- For local development: `http://localhost:8080/#/settings`
- The `#/settings` part is important!

### Token expired errors

The system automatically refreshes expired Strava tokens. If you see token errors:
- Disconnect and reconnect your Strava account
- Check that your Strava app is still active (not deleted)

---

## Data Privacy & Security

- **Your Strava tokens are stored securely** in your local database
- **Tokens are encrypted** using your SECRET_KEY
- **No data is sent to third parties** - everything stays local
- **You can disconnect anytime** without losing imported activities
- **Activities imported from Strava** are marked with `strava_activity_id` for deduplication

---

## Re-Syncing Activities

To import new activities after your initial sync:

1. Go to **Settings**
2. Click **"Sync Activities from Strava"**
3. Only new activities (not already imported) will be fetched

The system automatically prevents duplicates using Strava activity IDs.

---

## Disconnecting Strava

To disconnect your Strava account:

1. Go to **Settings**
2. Click **"Disconnect"** under Strava Integration
3. Confirm the action

**Note:** Disconnecting removes your Strava credentials but **does not delete** previously imported activities.

---

## API Rate Limits

Strava enforces rate limits on their API:

- **100 requests per 15 minutes** (read limit)
- **1,000 requests per day** (daily limit)

The Training Dashboard respects these limits. If you hit a rate limit:
- Wait 15 minutes before syncing again
- The system will show appropriate error messages

---

## Production Deployment

When deploying to production:

1. **Update Strava App Settings:**
   - Change "Authorization Callback Domain" to your production domain
   - Update "Website" to your production URL

2. **Update `.env`:**
   ```bash
   STRAVA_REDIRECT_URI=https://yourdomain.com/#/settings
   ```

3. **Use HTTPS** (required by Strava for OAuth)

4. **Consider PostgreSQL** instead of SQLite for better concurrent access

---

## Support

If you encounter issues:

1. Check the backend logs for detailed error messages
2. Verify your Strava app settings match your `.env` configuration
3. Ensure all required scopes are granted when authorizing

---

## Success! 🎉

You're all set! Your Training Dashboard can now automatically import and analyze all your Strava activities with full power and heart rate data.

**Next Steps:**
- Sync your activities
- Explore the Power Curve page
- Check your Training Load trends
- Review your VO2max estimates
- Set your FTP and zones in Settings for accurate analysis

Happy training! 🚴‍♂️💪
