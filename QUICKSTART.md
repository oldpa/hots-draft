# ⚡ Quick Start Guide

Get the HotS Draft Tool backend up and running in 5 minutes!

---

## 🎯 What You're Building

A serverless API on Vercel that:

- ✅ Fetches player hero stats from HeroesProfile API
- ✅ Caches results with Redis (Vercel KV) for fast responses
- ✅ Handles CORS for frontend integration
- ✅ Costs $0/month for normal usage

---

## 🚀 Local Development (5 Minutes)

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

You mentioned you already have the token in `.env`, so you're good! If not:

```bash
./setup-env.sh
```

Or manually create `.env`:

```bash
echo "HEROES_PROFILE_TOKEN=your_token_here" > .env
```

### 3. Start Dev Server

```bash
vercel dev
```

API is now running at: **http://localhost:3000**

### 4. Test It

```bash
# Option 1: Use the test script
./test-api.sh

# Option 2: Manual curl test
curl "http://localhost:3000/api/player/heroes?battletag=oldpa%2321616&region=2"
```

**Expected Response:**

```json
{
  "Quick Match": {
    "Abathur": {
      "wins": 45,
      "losses": 32,
      "games_played": 77,
      "win_rate": 58.44,
      "mmr": 2500
    }
    // ... more heroes
  },
  "cached": false,
  "cache_key": "player:oldpa#21616:2:all::"
}
```

✅ **Working?** Move to deployment!

---

## 🌐 Deploy to Vercel (10 Minutes)

### Step 1: Login & Deploy

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy preview
vercel

# Deploy production
vercel --prod
```

### Step 2: Set Up Redis Cache (2 clicks)

1. Go to https://vercel.com/dashboard
2. Select your project → **Storage** → **Create Database**
3. Choose **KV** → **Create**

Done! Vercel auto-links it to your functions.

### Step 3: Add Environment Variable

1. In Vercel dashboard: **Settings** → **Environment Variables**
2. Add:
   - **Key**: `HEROES_PROFILE_TOKEN`
   - **Value**: Your API token
   - **Environments**: All (Production, Preview, Development)

### Step 4: Redeploy

```bash
vercel --prod
```

✅ **Your API is now live!**

---

## 🧪 Test Production

```bash
# Replace with your actual URL
./test-api.sh https://your-project.vercel.app

# Or manually:
curl "https://your-project.vercel.app/api/health"
curl "https://your-project.vercel.app/api/player/heroes?battletag=oldpa%2321616&region=2"
```

---

## 📡 API Endpoints

### Health Check

```
GET /api/health
```

### Fetch Player Heroes

```
GET /api/player/heroes?battletag={BATTLETAG}&region={REGION}
```

**Parameters:**

- `battletag`: Player's battletag (e.g., `oldpa#21616`)
- `region`: `1` (NA), `2` (EU), `3` (KR), `5` (CN)
- `game_type`: _(optional)_ e.g., `Storm League`
- `start_date`: _(optional)_ e.g., `2024-01-01`
- `end_date`: _(optional)_ e.g., `2024-12-31`

**Example:**

```bash
curl "https://your-api.vercel.app/api/player/heroes?battletag=oldpa%2321616&region=2"
```

---

## 🔗 Use from Frontend

```javascript
const API_URL = "https://your-api.vercel.app";

async function getPlayerHeroes(battletag, region) {
  const params = new URLSearchParams({ battletag, region });
  const response = await fetch(`${API_URL}/api/player/heroes?${params}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

// Usage
const data = await getPlayerHeroes("oldpa#21616", "2");
console.log("Hero stats:", data);
console.log("Cached?", data.cached);
```

---

## 💾 Caching

- **TTL**: 1 hour (3600 seconds)
- **Storage**: Vercel KV (Redis)
- **Free tier**: 256 MB, 10,000 commands/day

**First request**: Fetches from HeroesProfile (slow)  
**Subsequent requests**: Served from cache (fast ⚡)

---

## 📚 Full Documentation

- **API Documentation**: [API_README.md](./API_README.md)
- **Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Environment Setup**: [ENV_TEMPLATE.md](./ENV_TEMPLATE.md)

---

## 🐛 Troubleshooting

### "API token not configured"

→ Set `HEROES_PROFILE_TOKEN` in `.env` (local) or Vercel dashboard (production)

### "KV is not defined"

→ Create a Vercel KV database in your project dashboard

### CORS errors

→ Already configured! Check your frontend is using the correct API URL

### Slow first request

→ Normal! Caching kicks in on second request

---

## 🎉 You're Done!

Your serverless HotS stats API is live with Redis caching! 🚀

**Next Steps:**

1. ✅ Test the API endpoints
2. ✅ Integrate with your frontend
3. ✅ Monitor Vercel logs for any issues
4. ✅ Add more endpoints as needed

---

## 💡 Development vs Deployment Commands

| Task                  | Command          |
| --------------------- | ---------------- |
| Local development     | `vercel dev`     |
| Deploy preview        | `vercel`         |
| Deploy to production  | `vercel --prod`  |
| Deploy (npm shortcut) | `npm run deploy` |

**Questions?** Check the full docs in [API_README.md](./API_README.md)

Happy coding! 🎮
