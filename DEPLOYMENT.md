# 🚀 Deployment Guide

Complete guide for deploying the HotS Draft Tool backend to Vercel with KV caching.

---

## ⚡ Quick Start

### 1️⃣ Install Dependencies

```bash
npm install
```

### 2️⃣ Create Environment File

Create a `.env` file in the root directory:

```bash
HEROES_PROFILE_TOKEN=your_heroesprofile_api_token_here
```

Get your API token from: https://api.heroesprofile.com/

### 3️⃣ Test Locally

```bash
vercel dev
```

Your API will be available at `http://localhost:3000`

Test it:

```bash
# Health check
curl http://localhost:3000/api/health

# Fetch player data (example with oldpa#21616)
curl "http://localhost:3000/api/player/heroes?battletag=oldpa%2321616&region=2"
```

---

## 🌐 Deploy to Vercel

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

Follow the prompts to authenticate.

### Step 3: Deploy (First Time)

```bash
vercel
```

This will:

1. Create a new Vercel project
2. Link it to your local directory
3. Deploy a preview version
4. Give you a preview URL

**Important:** Note down your project name (e.g., `hots-draft-tool-backend`)

### Step 4: Set Up Vercel KV (Redis Cache)

1. Go to https://vercel.com/dashboard
2. Select your project (`hots-draft-tool-backend`)
3. Click **Storage** tab
4. Click **Create Database**
5. Select **KV** (Redis)
6. Enter a name: `hots-cache`
7. Select region: **Closest to your users** (e.g., Frankfurt for EU)
8. Click **Create**

Vercel will automatically:

- Create the KV database
- Inject connection variables into your functions
- Link it to all environments

### Step 5: Set Environment Variables

1. In your Vercel dashboard, go to **Settings** → **Environment Variables**
2. Add the following:

| Key                    | Value                        | Environments                     |
| ---------------------- | ---------------------------- | -------------------------------- |
| `HEROES_PROFILE_TOKEN` | Your HeroesProfile API token | Production, Preview, Development |

3. Click **Save**

### Step 6: Deploy to Production

```bash
vercel --prod
```

Your API will be live at: `https://your-project.vercel.app`

---

## ✅ Verify Deployment

### Test the API

```bash
# Replace with your actual Vercel URL
API_URL="https://your-project.vercel.app"

# Health check
curl "$API_URL/api/health"

# Fetch player data
curl "$API_URL/api/player/heroes?battletag=oldpa%2321616&region=2"
```

Expected response:

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
  "cache_key": "player:oldpa#21616:2:all::",
  "cache_ttl": 3600
}
```

### Verify Caching

Run the same request twice:

```bash
# First request (cached: false)
curl "$API_URL/api/player/heroes?battletag=oldpa%2321616&region=2"

# Second request (cached: true)
curl "$API_URL/api/player/heroes?battletag=oldpa%2321616&region=2"
```

The second request should show `"cached": true` and return instantly.

---

## 🔗 Connect Frontend to Backend

### Option 1: Update Frontend to Use API

Edit `app.js` to fetch from your backend instead of local JSON files:

```javascript
// Add at the top of app.js
const API_URL = 'https://your-project.vercel.app';

// Add a new method to DraftManager class
async fetchPlayerHeroes(battletag, region) {
    try {
        const params = new URLSearchParams({ battletag, region });
        const response = await fetch(`${API_URL}/api/player/heroes?${params}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        const data = await response.json();
        console.log('Fetched player data:', data);
        return data;
    } catch (error) {
        console.error('Error fetching player data:', error);
        throw error;
    }
}
```

### Option 2: Separate Deployments

Keep frontend on GitHub Pages and backend on Vercel:

- **Frontend**: `https://yourusername.github.io/hots-draft-tool/`
- **Backend**: `https://your-backend.vercel.app`

Configure CORS in `api/player/heroes.js` to allow your GitHub Pages domain.

---

## 📊 Monitor Your API

### View Logs

```bash
vercel logs
```

Or in the Vercel dashboard:

1. Go to your project
2. Click **Deployments**
3. Click on a deployment
4. Click **Functions** to see logs

### View KV Cache Stats

1. Go to Vercel dashboard
2. Click **Storage**
3. Click on your KV database
4. View metrics: requests, data size, hit rate

---

## 🔄 Update Deployment

After making changes to your API:

```bash
# Deploy to preview (for testing)
vercel

# Deploy to production
vercel --prod
```

---

## 🐛 Troubleshooting

### Issue: "API token not configured"

**Solution:**

1. Go to Vercel dashboard → Settings → Environment Variables
2. Ensure `HEROES_PROFILE_TOKEN` is set
3. Redeploy: `vercel --prod`

### Issue: "KV is not defined" or "@vercel/kv not found"

**Solution:**

1. Ensure you created a KV database in Vercel dashboard
2. Make sure it's linked to your project
3. Redeploy: `vercel --prod`

### Issue: CORS errors from frontend

**Solution:**
The API includes `Access-Control-Allow-Origin: *` by default. If you still see errors:

1. Check browser console for the exact error
2. Ensure you're using the correct API URL
3. Test with `curl` to verify the API works

### Issue: "Player not found" or 404 errors

**Solution:**

1. Verify the battletag format: `name#12345`
2. Verify the region code: `1` (NA), `2` (EU), `3` (KR), `5` (CN)
3. Check if the player exists on https://heroesprofile.com/

### Issue: Slow responses

**Solution:**

1. Check KV cache is working (second request should be fast)
2. First request to a new player will be slow (fetching from HeroesProfile)
3. Cached requests should be <100ms

---

## 💰 Costs

### Vercel

- **Free tier**: 100GB bandwidth, 100GB-hours serverless execution
- **Hobby plan**: $0/month for personal projects
- **Pro plan**: $20/month if you need more

### Vercel KV (Redis)

- **Free tier**:
  - 256 MB storage
  - 10,000 commands per day
  - More than enough for this use case!

### HeroesProfile API

- Check their pricing: https://api.heroesprofile.com/

**Total cost for small-scale use: $0/month** 🎉

---

## 📈 Scaling

As your tool grows:

1. **Increase cache TTL** (currently 1 hour) to reduce API calls
2. **Add more endpoints** for different HeroesProfile features
3. **Upgrade Vercel KV** if you hit limits
4. **Add Redis caching layers** for frequently accessed data

---

## 🔒 Security Best Practices

1. ✅ **Never commit `.env` files** - already in `.gitignore`
2. ✅ **Use environment variables** for API tokens
3. ✅ **Rotate API tokens** periodically
4. ✅ **Monitor API usage** to detect abuse
5. ✅ **Rate limiting** - Vercel has built-in DDoS protection

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel KV Documentation](https://vercel.com/docs/storage/vercel-kv)
- [HeroesProfile API Docs](https://api.heroesprofile.com/docs)
- [API_README.md](./API_README.md) - Full API documentation

---

## 🎉 You're Done!

Your HotS Draft Tool backend is now live on Vercel with Redis caching! 🚀

**Next Steps:**

1. Test all endpoints
2. Monitor logs for errors
3. Connect your frontend to the new backend
4. Add more features as needed

Happy drafting! 🎮
