# 🎉 Backend API Setup Complete!

Your HotS Draft Tool backend is ready to deploy to Vercel with Redis caching!

---

## ✅ What Was Created

### 📡 API Endpoints

1. **Health Check** (`/api/health.js`)

   - Simple endpoint to verify API is running
   - No authentication required

2. **Player Heroes** (`/api/player/heroes.js`)
   - Fetches hero stats for a given player from HeroesProfile API
   - Includes Redis caching (1-hour TTL)
   - CORS-enabled for frontend integration

### 📝 Documentation

- **QUICKSTART.md** - 5-minute setup guide
- **API_README.md** - Complete API documentation
- **DEPLOYMENT.md** - Detailed deployment guide
- **ENV_TEMPLATE.md** - Environment variable reference

### 🛠️ Configuration Files

- **package.json** - Node.js dependencies
- **vercel.json** - Vercel deployment configuration
- **.gitignore** - Updated with Node.js and Vercel entries

### 🧪 Testing & Setup Scripts

- **setup-env.sh** - Interactive script to create `.env` file
- **test-api.sh** - Comprehensive API test suite

---

## 🚀 Quick Start (3 Steps)

### 1. Set Up Environment

You mentioned you already have `heroes_profile_token` in `.env`. Let's verify:

```bash
# Check if .env exists
cat .env
```

If it doesn't exist or needs the correct format, run:

```bash
./setup-env.sh
```

Expected `.env` format:

```bash
HEROES_PROFILE_TOKEN=your_api_token_here
```

### 2. Test Locally

```bash
# Start dev server
vercel dev

# In another terminal, run tests
./test-api.sh
```

You should see:

- ✅ Health check passes
- ✅ Player hero data fetches successfully
- ✅ Error handling works correctly

### 3. Deploy to Vercel

```bash
# Install Vercel CLI (if not already installed)
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Then set up Vercel KV (Redis):

1. Go to https://vercel.com/dashboard
2. Select your project → **Storage** → **Create Database**
3. Choose **KV** → Create
4. Add `HEROES_PROFILE_TOKEN` in **Settings** → **Environment Variables**
5. Redeploy: `vercel --prod`

---

## 📊 API Usage Examples

### JavaScript (Frontend)

```javascript
const API_URL = "https://your-project.vercel.app";

// Fetch player hero stats
async function getPlayerHeroes(battletag, region) {
  const params = new URLSearchParams({ battletag, region });
  const response = await fetch(`${API_URL}/api/player/heroes?${params}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

// Usage
try {
  const data = await getPlayerHeroes("oldpa#21616", "2");

  console.log("Hero stats:", data);
  console.log("Cached?", data.cached);

  // Example: Show Abathur stats
  const abathurStats = data["Quick Match"]?.Abathur;
  if (abathurStats) {
    console.log(
      `Abathur: ${abathurStats.wins}W ${abathurStats.losses}L (${abathurStats.win_rate}%)`
    );
  }
} catch (error) {
  console.error("Error:", error.message);
}
```

### cURL (Testing)

```bash
# Health check
curl https://your-project.vercel.app/api/health

# Fetch player data (EU region)
curl "https://your-project.vercel.app/api/player/heroes?battletag=oldpa%2321616&region=2"

# With optional parameters
curl "https://your-project.vercel.app/api/player/heroes?battletag=oldpa%2321616&region=2&game_type=Storm%20League"
```

### Python

```python
import requests

def get_player_heroes(battletag, region):
    url = 'https://your-project.vercel.app/api/player/heroes'
    params = {
        'battletag': battletag,
        'region': region
    }

    response = requests.get(url, params=params)
    response.raise_for_status()

    return response.json()

# Usage
data = get_player_heroes('oldpa#21616', '2')
print(f"Cached: {data.get('cached')}")

# Show Quick Match stats
for hero, stats in data.get('Quick Match', {}).items():
    print(f"{hero}: {stats['wins']}W {stats['losses']}L ({stats['win_rate']:.1f}%)")
```

---

## 🔗 API Endpoints Reference

### GET `/api/health`

**Description:** Check if API is running

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-10-23T14:00:00.000Z",
  "message": "HotS Draft Tool API is running"
}
```

---

### GET `/api/player/heroes`

**Description:** Fetch all hero stats for a player

**Query Parameters:**

| Parameter    | Required | Type   | Description                                    |
| ------------ | -------- | ------ | ---------------------------------------------- |
| `battletag`  | ✅       | string | Player's battletag (URL-encoded)               |
| `region`     | ✅       | string | Region: `1` (NA), `2` (EU), `3` (KR), `5` (CN) |
| `game_type`  | ❌       | string | Filter by game type (e.g., "Storm League")     |
| `start_date` | ❌       | string | Filter from date (YYYY-MM-DD)                  |
| `end_date`   | ❌       | string | Filter to date (YYYY-MM-DD)                    |

**Example Request:**

```
GET /api/player/heroes?battletag=oldpa%2321616&region=2
```

**Example Response:**

```json
{
  "Quick Match": {
    "Abathur": {
      "wins": 45,
      "losses": 32,
      "games_played": 77,
      "win_rate": 58.44,
      "mmr": 2500
    },
    "Alarak": {
      "wins": 12,
      "losses": 8,
      "games_played": 20,
      "win_rate": 60.0,
      "mmr": 2600
    }
    // ... more heroes
  },
  "Storm League": {
    // ... heroes for this game type
  },
  "cached": false,
  "cache_key": "player:oldpa#21616:2:all::",
  "cache_ttl": 3600
}
```

---

## 💾 Caching Details

- **Backend:** Vercel KV (Redis)
- **TTL:** 1 hour (3600 seconds)
- **Cache Key Format:** `player:{battletag}:{region}:{game_type}:{start_date}:{end_date}`

**Performance:**

- First request: ~500-1500ms (fetches from HeroesProfile)
- Cached requests: <100ms ⚡

**Free Tier Limits:**

- 256 MB storage
- 10,000 commands/day
- More than enough for typical usage!

---

## 🧪 Testing Checklist

Run through these tests to verify everything works:

- [ ] **Local development:** `npm run dev` starts without errors
- [ ] **Health check:** `curl http://localhost:3000/api/health` returns 200
- [ ] **Valid request:** Fetch player data returns hero stats
- [ ] **Invalid region:** Returns 400 error
- [ ] **Missing params:** Returns 400 error
- [ ] **Caching:** Second identical request shows `"cached": true`
- [ ] **Vercel deployment:** Production URL works
- [ ] **Vercel KV:** Cache persists across requests
- [ ] **Environment vars:** API token works in production

Use `./test-api.sh` to run all tests automatically!

---

## 🔒 Security Best Practices

✅ **Already Implemented:**

- API token stored in environment variables (never committed)
- `.env` added to `.gitignore`
- CORS headers configured for web access
- Error messages don't leak sensitive info

✅ **Recommended:**

- Rotate API tokens periodically
- Monitor Vercel logs for abuse
- Consider rate limiting for public APIs
- Use Vercel's built-in DDoS protection

---

## 📊 Monitoring & Debugging

### View Logs (Local)

```bash
# Logs appear in terminal where `npm run dev` is running
# Look for:
# - "Cache hit" / "Cache miss"
# - "Fetching from HeroesProfile API"
# - Any error messages
```

### View Logs (Production)

```bash
# Using Vercel CLI
vercel logs

# Or in Vercel dashboard:
# Project → Deployments → Select deployment → Functions
```

### Check Cache Performance

Look for these indicators in responses:

- `"cached": true` - Fast response from cache ⚡
- `"cached": false` - Fresh fetch from API 🐌
- `"cache_key"` - Unique identifier for this request
- `"cache_ttl"` - Time until cache expires (seconds)

---

## 🚨 Troubleshooting

### "API token not configured"

**Cause:** `HEROES_PROFILE_TOKEN` not set in environment

**Fix (Local):**

```bash
./setup-env.sh
# Or manually edit .env
```

**Fix (Production):**

1. Vercel dashboard → Settings → Environment Variables
2. Add `HEROES_PROFILE_TOKEN`
3. Redeploy: `vercel --prod`

---

### "KV is not defined"

**Cause:** Vercel KV database not created

**Fix:**

1. Go to Vercel dashboard
2. Select project → Storage → Create Database
3. Choose KV → Create
4. Redeploy: `vercel --prod`

---

### CORS Errors

**Cause:** Frontend can't access API due to CORS policy

**Fix:**

- API already includes `Access-Control-Allow-Origin: *`
- Verify you're using the correct API URL
- Check browser console for specific error

---

### "Player not found" (404)

**Cause:** Invalid battletag or player doesn't exist

**Fix:**

- Verify battletag format: `name#12345`
- Check region code: `1` (NA), `2` (EU), `3` (KR), `5` (CN)
- Verify player exists on https://heroesprofile.com/

---

## 💰 Cost Estimate

### Vercel

- **Free Tier:** 100GB bandwidth, 100GB-hrs serverless execution
- **Cost:** $0/month for personal projects

### Vercel KV (Redis)

- **Free Tier:** 256 MB storage, 10,000 commands/day
- **Cost:** $0/month (well within limits for this use case)

### HeroesProfile API

- Check their pricing: https://api.heroesprofile.com/
- Caching reduces API calls significantly!

**Total: $0/month for normal usage** 🎉

---

## 🎯 Next Steps

### Immediate:

1. ✅ Test locally with your API token
2. ✅ Deploy to Vercel
3. ✅ Set up Vercel KV
4. ✅ Verify caching works

### Future Enhancements:

- [ ] Add more HeroesProfile endpoints (matchups, talents, etc.)
- [ ] Implement player search/autocomplete
- [ ] Add team composition analysis
- [ ] Create historical stats tracking
- [ ] Build admin dashboard for cache management

---

## 📚 Documentation Reference

| Document        | Purpose                                |
| --------------- | -------------------------------------- |
| QUICKSTART.md   | 5-minute setup guide (start here!)     |
| API_README.md   | Complete API documentation             |
| DEPLOYMENT.md   | Detailed deployment instructions       |
| ENV_TEMPLATE.md | Environment variable reference         |
| README.md       | Project overview and full feature list |

---

## 🎉 You're All Set!

Your backend is ready to fetch player hero data from HeroesProfile with Redis caching on Vercel!

**Test it now:**

```bash
# 1. Start local dev server
vercel dev

# 2. Run test suite (in another terminal)
./test-api.sh

# 3. Deploy when ready
vercel --prod
```

**Questions?** Check the docs or open an issue!

Happy coding! 🚀🎮
