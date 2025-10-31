# HotS Draft Tool API

Backend API for the Heroes of the Storm Draft Tool, built with Vercel Serverless Functions and Redis for caching.

## 🚀 Base URL

**Local Development:**

```
http://localhost:3000
```

**Production:**

```
https://your-project.vercel.app
```

---

## 🔐 CORS Configuration

All API endpoints include CORS headers to allow cross-origin requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

This allows the frontend to make requests from any domain. Perfect for public APIs and GitHub Pages deployment.

## 📡 Endpoints

### 1. Health Check

Check if the API is running.

**Endpoint:** `GET /api/health`

**Example:**

```bash
curl https://your-project.vercel.app/api/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-10-23T14:00:00.000Z",
  "message": "HotS Draft Tool API is running",
  "endpoints": {
    "health": "/api/health",
    "playerHeroes": "/api/player/heroes?battletag=BATTLETAG&region=REGION"
  }
}
```

---

### 2. Get Player Hero Data

Fetch all hero statistics for a given player.

**Endpoint:** `GET /api/player/heroes`

**Query Parameters:**

| Parameter    | Required | Type    | Description                                         | Example        |
| ------------ | -------- | ------- | --------------------------------------------------- | -------------- |
| `battletag`  | ✅       | string  | Player's battletag (URL-encoded)                    | `oldpa#21616`  |
| `region`     | ✅       | string  | Region code: `1` (NA), `2` (EU), `3` (KR), `5` (CN) | `2`            |
| `game_type`  | ❌       | string  | Filter by game type (e.g., "Storm League")          | `Storm League` |
| `start_date` | ❌       | string  | Filter from date (YYYY-MM-DD or MM-DD-YYYY)         | `2024-01-01`   |
| `end_date`   | ❌       | string  | Filter to date (YYYY-MM-DD or MM-DD-YYYY)           | `2024-12-31`   |
| `no_cache`   | ❌       | boolean | Bypass cache, fetch fresh data (`true` or `1`)      | `true`         |

**Example Request:**

```bash
# Basic request
curl "https://your-project.vercel.app/api/player/heroes?battletag=oldpa%2321616&region=2"

# With optional parameters
curl "https://your-project.vercel.app/api/player/heroes?battletag=oldpa%2321616&region=2&game_type=Storm%20League&start_date=2024-01-01"

# Bypass cache and fetch fresh data
curl "https://your-project.vercel.app/api/player/heroes?battletag=oldpa%2321616&region=2&no_cache=true"
```

**Response:**

```json
{
  "battletag": "oldpa#21616",
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
  },
  "Hero League": {
    "Diablo": {
      "wins": 23,
      "losses": 15,
      "games_played": 38,
      "win_rate": 60.53,
      "mmr": 2700
    }
  },
  "player_mmr": {
    "Quick Match": {
      "mmr": 2456,
      "games_played": 542,
      "games_played_last_90_days": 23,
      "league_tier": "platinum"
    },
    "Hero League": {
      "mmr": 2672,
      "games_played": 189,
      "games_played_last_90_days": 12,
      "league_tier": "diamond"
    }
  },
  "cached": false,
  "cache_key": "player:oldpa#21616:2:all::",
  "cache_ttl": 1209600,
  "redis_available": true
}

**Note:** Only "Quick Match" and "Hero League" data are returned. Heroes with less than 15 games played are filtered out to reduce storage costs.
```

**Response Fields:**

- **`battletag`**: The player's battletag (string)
- **Hero Data by Game Type**: Only "Quick Match" and "Hero League" game types are returned
  - Each game type contains hero statistics for heroes with 15+ games played
  - `wins`: Number of wins
  - `losses`: Number of losses
  - `games_played`: Total games played (minimum 15)
  - `win_rate`: Win rate percentage
  - `mmr`: Hero-specific MMR
- **`player_mmr`**: Player's overall MMR data (filtered to Quick Match and Hero League only)
  - Direct object with game types as keys (battletag wrapper removed for cleaner structure)
  - For each game type: `mmr`, `games_played`, `games_played_last_90_days`, `league_tier`
  - This represents the player's overall skill, not hero-specific
- `cached`: `true` if data was served from cache, `false` if fetched fresh
- `no_cache`: `true` if cache was bypassed (only present when `no_cache` parameter used)
- `cache_key`: The cache key used for this request
- `cache_ttl`: Cache time-to-live in seconds (14 days = 1209600s, or 0 if cache bypassed)
- `redis_available`: `true` if Redis caching is available, `false` if not

**Data Filtering:**

- Only "Quick Match" and "Hero League" game types are stored (other modes excluded)
- Heroes with fewer than 15 games played are filtered out
- This reduces storage costs while maintaining useful data

**Error Responses:**

_Missing battletag:_

```json
{
  "error": "Missing parameter",
  "message": "battletag is required (e.g., \"oldpa#21616\")"
}
```

_Invalid region:_

```json
{
  "error": "Invalid region",
  "message": "region must be one of: 1 (NA), 2 (EU), 3 (KR), 5 (CN)"
}
```

_HeroesProfile API error:_

```json
{
  "error": "HeroesProfile API error",
  "message": "API returned 404: Player not found",
  "status": 404
}
```

---

## 🔐 Authentication

The API uses the HeroesProfile API token stored in environment variables. No authentication is required from the client side.

---

## 💾 Caching

All responses are cached using Redis with a **14-day TTL** (1,209,600 seconds).

**Cache Key Format:**

```
player:{battletag}:{region}:{game_type}:{start_date}:{end_date}
```

**Benefits:**

- ⚡ Faster response times for repeated requests
- 💰 Reduces API calls to HeroesProfile
- 🌍 Global edge caching via Vercel

---

## 🛠️ Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
HEROES_PROFILE_TOKEN=your_api_token_here
```

### 3. Run Development Server

```bash
vercel dev
```

The API will be available at `http://localhost:3000`

### 4. Test Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Player heroes
curl "http://localhost:3000/api/player/heroes?battletag=oldpa%2321616&region=2"
```

---

## 🚢 Deployment

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Set Up Redis

1. Go to your Vercel project dashboard
2. Navigate to **Storage** → **Create Database**
3. Select **KV** (Redis)
4. Click **Create**

Vercel will automatically inject the KV connection variables into your functions.

### 4. Set Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add:
   - **Key**: `HEROES_PROFILE_TOKEN`
   - **Value**: Your HeroesProfile API token
   - **Environments**: Production, Preview, Development

### 5. Deploy

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

---

## 📊 Usage from Frontend

### JavaScript Example

```javascript
async function getPlayerHeroes(battletag, region) {
  const params = new URLSearchParams({
    battletag: battletag,
    region: region,
  });

  const response = await fetch(
    `https://your-project.vercel.app/api/player/heroes?${params}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data = await response.json();
  return data;
}

// Usage
try {
  const heroData = await getPlayerHeroes("oldpa#21616", "2");
  console.log("Hero stats:", heroData);
  console.log("From cache?", heroData.cached);
} catch (error) {
  console.error("Error:", error.message);
}
```

---

## 🔧 Troubleshooting

### Issue: "API token not configured"

**Solution:** Ensure `HEROES_PROFILE_TOKEN` is set in your `.env` file (local) or Vercel environment variables (production).

### Issue: "Redis connection failed"

**Solution:** Make sure you've created a Redis database in your Vercel project dashboard (Storage → Redis) and it's linked to your project. The API will work without Redis but without caching.

### Issue: CORS errors

**Solution:** The API includes CORS headers by default. If you still see errors, check that your frontend is using the correct API URL.

---

## 📚 Resources

- [HeroesProfile API Documentation](https://api.heroesprofile.com/docs/1.0/Player/Hero/All)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Vercel Redis Documentation](https://vercel.com/docs/storage/vercel-kv)
- [Redis Node.js Client](https://github.com/redis/node-redis)

---

## 📝 License

Same as the main project.
