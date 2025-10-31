# Redis Migration Summary

Date: October 30, 2025

## 🎯 Overview

Successfully migrated from `@vercel/kv` to direct `redis` client for better portability and control.

## 🔄 Changes Made

### 1. API Code (`api/player/heroes.js`)

**Replaced imports:**

```javascript
// Before
import { kv } from "@vercel/kv";

// After
import { createClient } from "redis";
```

**Added connection management:**

```javascript
async function getRedisClient() {
  if (redis && redisConnected) {
    return redis; // Reuse existing connection
  }

  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (!redisUrl) {
    console.log("Redis URL not found - caching disabled");
    return null;
  }

  try {
    redis = createClient({ url: redisUrl });
    redis.on("error", (err) => {
      console.log("Redis Client Error:", err);
      redisConnected = false;
    });
    await redis.connect();
    redisConnected = true;
    console.log("Redis connected successfully");
    return redis;
  } catch (error) {
    console.log("Redis connection failed:", error.message);
    return null;
  }
}
```

**Updated cache operations:**

```javascript
// READ - Before
const cachedData = await kv.get(cacheKey);

// READ - After
const cachedDataStr = await redisClient.get(cacheKey);
const cachedData = JSON.parse(cachedDataStr);

// WRITE - Before
await kv.set(cacheKey, data, { ex: CACHE_TTL });

// WRITE - After
await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(data));
```

**Updated response fields:**

- `kv_available` → `redis_available`

### 2. Dependencies (`package.json`)

**Removed:**

```json
"@vercel/kv": "^1.0.1"
```

**Kept:**

```json
"redis": "^5.9.0"
```

### 3. Environment Variables (`ENV_TEMPLATE.md`)

**Updated documentation:**

- Clarified that both `REDIS_URL` and `KV_URL` are supported
- Added examples for Vercel Redis and external Redis providers
- Updated instructions for Redis setup

### 4. Documentation (`API_README.md`)

**Updated all references:**

- "Vercel KV" → "Redis"
- `kv_available` → `redis_available`
- Updated cache TTL: 1 hour → 14 days (1,209,600 seconds)
- Added Redis Node.js client to resources
- Updated troubleshooting section

### 5. CORS Headers

**Added explicit header setting:**

```javascript
export default async function handler(req, res) {
  // Set CORS headers for all responses
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  // ... rest of handler
}
```

This fixes the CORS error when frontend and backend are on different domains.

## 🔐 Environment Variables

The API automatically checks for Redis URL in this order:

1. `REDIS_URL` (preferred)
2. `KV_URL` (fallback for Vercel KV compatibility)

**Example values:**

```bash
# Vercel Redis (automatically provided)
REDIS_URL=redis://default:password@redis-host.vercel.app:6379

# External Redis
REDIS_URL=redis://your-redis-url:6379

# Required for all environments
HEROES_PROFILE_TOKEN=your_api_token_here
```

## 📊 Key Differences

| Feature                | @vercel/kv      | redis (direct)                |
| ---------------------- | --------------- | ----------------------------- |
| **Setup**              | Automatic       | Manual connection             |
| **Serialization**      | Automatic       | Manual (JSON.stringify/parse) |
| **Portability**        | Vercel-specific | Any Redis provider            |
| **Connection Control** | Limited         | Full control                  |
| **Error Handling**     | Basic           | Comprehensive                 |
| **Provider Lock-in**   | Yes             | No                            |

## 🧪 Testing

### Local Testing

1. Pull environment variables:

   ```bash
   vercel env pull
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start development server:

   ```bash
   vercel dev
   ```

4. Test the API:

   ```bash
   curl "http://localhost:3000/api/player/heroes?battletag=oldpa%2321616&region=2"
   ```

5. Check console logs:
   - ✅ `Redis connected successfully`
   - ✅ `Cache miss for player:oldpa#21616:2:all::`
   - ✅ `Cached data for player:oldpa#21616:2:all:: (TTL: 1209600s)`
   - On second request: ✅ `Cache hit for player:oldpa#21616:2:all::`

### Production Testing

1. Deploy:

   ```bash
   git add .
   git commit -m "Migrate to direct Redis client + fix CORS"
   git push origin main
   ```

2. Check Vercel deployment logs for:

   - ✅ `Redis connected successfully`

3. Test API endpoint:

   ```bash
   curl -i "https://hots.vercel.app/api/player/heroes?battletag=oldpa%2321616&region=2"
   ```

4. Verify response headers:

   - ✅ `access-control-allow-origin: *`
   - ✅ `access-control-allow-methods: GET, OPTIONS`

5. Verify response JSON:
   - ✅ `"redis_available": true`
   - ✅ `"cached": false` (first request)
   - ✅ `"cached": true` (second request)

## 🐛 Bug Fixes

### 1. CORS Headers Not Applied

**Problem:**

- CORS headers were defined but never set on responses
- Cross-origin requests from frontend were blocked

**Solution:**

- Added `res.setHeader()` calls to apply CORS headers
- Headers now set at the start of every handler function

**Files affected:**

- `api/player/heroes.js`
- `api/health.js`

### 2. Redis Connection Management

**Problem:**

- No proper connection lifecycle management
- Potential connection leaks

**Solution:**

- Created `getRedisClient()` helper function
- Reuses existing connection if available
- Proper error handling and logging
- Graceful fallback when Redis unavailable

## 📁 Files Modified

- ✅ `api/player/heroes.js` - Redis client integration + CORS fix
- ✅ `api/health.js` - CORS fix
- ✅ `package.json` - Removed @vercel/kv dependency
- ✅ `ENV_TEMPLATE.md` - Updated Redis documentation
- ✅ `API_README.md` - Updated all references and examples
- ✅ `REDIS_MIGRATION.md` - This file (migration documentation)

## 🚀 Deployment Checklist

### Pre-Deployment

- [x] Code changes committed
- [x] Dependencies updated (`npm install`)
- [x] Local testing passed
- [x] Documentation updated

### Vercel Setup

- [ ] Redis database created in Vercel dashboard
- [ ] `HEROES_PROFILE_TOKEN` environment variable set
- [ ] Both projects pushed to GitHub:
  - Backend: `hots` repository
  - Frontend: `hots-one` repository (if separate)

### Post-Deployment

- [ ] Check deployment logs for "Redis connected successfully"
- [ ] Test health endpoint: `curl https://hots.vercel.app/api/health`
- [ ] Test player endpoint with cache miss (first request)
- [ ] Test player endpoint with cache hit (second request)
- [ ] Verify CORS headers present in responses
- [ ] Test from frontend: Add player and verify no CORS errors

## 💡 Benefits

1. **Portability**: Works with any Redis provider, not just Vercel
2. **Control**: Full control over connection management and error handling
3. **Standard**: Uses standard Redis commands (get, setEx, etc.)
4. **Debugging**: Better error messages and logging
5. **Flexibility**: Easy to switch Redis providers if needed
6. **Cost**: No vendor lock-in, can use cheaper alternatives

## 🎯 Result

- ✅ More portable codebase
- ✅ Better error handling
- ✅ Same functionality and performance
- ✅ Fixed CORS issues
- ✅ Improved documentation
- ✅ Ready for production deployment

---

**Migration completed successfully! 🎉**
