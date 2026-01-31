# Deployment Guide

## Prerequisites

1. Vercel account (free tier works)
2. GitHub account

## Step 1: Set Up Vercel Postgres

1. Go to your Vercel dashboard
2. Navigate to Storage → Create Database → Postgres
3. Create a new Postgres database named `soiree-db`
4. Copy all connection strings (they'll be automatically added to your project)

## Step 2: Configure Environment Variables

In your Vercel project settings, add:

```
SCRAPE_SECRET=your-secure-random-string-here
```

Postgres variables are automatically added when you connect the database.

## Step 3: Deploy

### Option A: GitHub Integration (Recommended)

1. Push your code to GitHub
2. Import the repository in Vercel
3. Vercel will automatically deploy
4. Connect the Postgres database to your project

### Option B: Vercel CLI

```bash
# Install dependencies
npm install

# Login to Vercel
npx vercel login

# Deploy
npx vercel --prod
```

## Step 4: Initialize Database

After deployment, manually trigger the scraper once to populate the database:

```bash
curl -X POST https://your-domain.vercel.app/api/scrape \
  -H "Authorization: Bearer your-scrape-secret"
```

Or use the Vercel dashboard to manually run the cron job.

## Step 5: Verify

1. Visit `https://your-domain.vercel.app/api/events`
2. You should see JSON with events
3. Visit your main site - it should load events from the database

## Automated Scraping

The cron job runs daily at 6 AM UTC (configured in `vercel.json`):
- Scrapes NYC event websites
- Clears events older than 7 days
- Inserts new events into the database

## Manual Scraping

To manually trigger a scrape:

```bash
curl -X POST https://your-domain.vercel.app/api/scrape \
  -H "Authorization: Bearer YOUR_SCRAPE_SECRET"
```

## Troubleshooting

### No events showing
1. Check `/api/events` endpoint
2. Trigger manual scrape
3. Check Vercel function logs

### Database connection errors
1. Verify Postgres database is connected
2. Check environment variables
3. Review connection strings

### Scraping fails
- The app will fall back to hardcoded events
- Check function logs for specific errors
- Websites may have changed structure

## Monitoring

- View logs in Vercel dashboard → Functions → Logs
- Monitor cron job execution under Cron Jobs tab
- Check database queries in Vercel Postgres dashboard

## Scaling

Free tier limits:
- 100GB bandwidth/month
- 12 hours serverless function execution/month
- 10,000 database rows

For production:
- Upgrade to Pro plan ($20/month)
- Increase database size as needed
- Add caching with Redis
