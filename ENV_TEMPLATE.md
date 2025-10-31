# Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

```bash
# HeroesProfile API Token
# Get your API token from: https://api.heroesprofile.com/
HEROES_PROFILE_TOKEN=your_api_token_here
```

## For Local Development

When running `vercel dev` locally, Vercel will automatically read from your `.env` file.

## For Vercel Deployment

Set the environment variable in your Vercel project:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add:
   - **Key**: `HEROES_PROFILE_TOKEN`
   - **Value**: Your API token
   - **Environment**: Production, Preview, Development (select all)

## Redis Setup (for caching)

### Using Vercel Redis

Vercel Redis will be automatically configured when you:

1. Go to your Vercel project dashboard
2. Navigate to Storage → Create Database
3. Select "Redis" (or "KV")
4. Click "Create"

Vercel will automatically inject the Redis connection URL (`REDIS_URL` or `KV_URL`) into your serverless functions.

### Using External Redis

If you're using an external Redis service (e.g., Upstash, Redis Cloud):

```bash
# Redis Connection URL
REDIS_URL=redis://your-redis-url:port
```

Add this to both your `.env` file (local) and Vercel Environment Variables (production).
