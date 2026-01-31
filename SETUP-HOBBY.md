# Setup Guide for Vercel Hobby Plan (Free)

Since Vercel Postgres requires a Pro plan, we'll use **Neon** - a free PostgreSQL database that works perfectly with our app.

## Step 1: Create Free Neon Database

1. Go to https://neon.tech
2. Sign up with GitHub (free)
3. Click **"Create a project"**
4. Name it: `soiree`
5. Select region: **US East (Ohio)** (closest to Vercel)
6. Click **Create Project**

## Step 2: Get Connection String

1. On your Neon dashboard, click **"Connection Details"**
2. Select **"Pooled connection"**
3. Copy the connection string - looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

## Step 3: Deploy to Vercel

### Option A: Via Vercel Dashboard (Easiest)

1. Go to https://vercel.com
2. Click **"Add New"** → **"Project"**
3. Import your GitHub repo: `stilwellc/soiree`
4. Before deploying, add Environment Variables:
   - `POSTGRES_URL` = your Neon connection string
   - `SCRAPE_SECRET` = `soiree-scrape-secret-2024`
5. Click **Deploy**

### Option B: Via CLI

```bash
# Login to Vercel
npx vercel login

# Deploy
npx vercel --prod

# When prompted, set environment variables:
# POSTGRES_URL=your-neon-connection-string
# SCRAPE_SECRET=soiree-scrape-secret-2024
```

## Step 4: Initialize Database

After deployment, trigger the first scrape to populate the database:

```bash
curl -X POST https://your-app.vercel.app/api/scrape \
  -H "Authorization: Bearer soiree-scrape-secret-2024"
```

## Step 5: Verify

1. Visit `https://your-app.vercel.app/api/events`
   - Should return JSON with events
2. Visit your main site
   - Should show scraped events

## Limitations on Hobby Plan

✅ **What Works:**
- All app features
- Serverless functions
- Database (via Neon)
- Daily cron jobs (up to 2 per project)
- Automatic deployments

⚠️ **Hobby Plan Limits:**
- 100GB bandwidth/month (plenty for this app)
- 100 hours serverless function execution/month
- Limited to 2 cron jobs
- No team features

**This is perfect for a personal project!** 🎉

## Neon Free Tier Limits

- 0.5 GB storage (holds ~50,000 events - way more than needed)
- 1 database per project
- Always available
- No credit card required

## Cost Summary

- Vercel Hobby: **$0/month**
- Neon Free: **$0/month**
- **Total: FREE** ✨

## Next Steps

Once deployed, the app will:
1. Scrape NYC events daily at 6 AM UTC
2. Store them in your Neon database
3. Serve them via API to the frontend
4. Auto-delete events older than 7 days

Your app will have **real, live data updating every day!**
