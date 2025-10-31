/**
 * Vercel Serverless Function: Fetch Player Hero Data
 * 
 * Endpoint: /api/player/heroes
 * Query Params:
 *   - battletag: Player's battletag (e.g., "oldpa#21616")
 *   - region: Region code (1=NA, 2=EU, 3=KR, 5=CN)
 * 
 * Example: /api/player/heroes?battletag=oldpa#21616&region=2
 */

// Import Redis client
import { createClient } from 'redis';

// Create Redis client (optional for local development)
let redis = null;
let redisConnected = false;

async function getRedisClient() {
  if (redis && redisConnected) {
    return redis;
  }

  // Check if Redis URL is available
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (!redisUrl) {
    console.log('Redis URL not found - caching disabled');
    return null;
  }

  try {
    redis = createClient({ url: redisUrl });
    
    redis.on('error', (err) => {
      console.log('Redis Client Error:', err);
      redisConnected = false;
    });

    await redis.connect();
    redisConnected = true;
    console.log('Redis connected successfully');
    return redis;
  } catch (error) {
    console.log('Redis connection failed - caching disabled:', error.message);
    redis = null;
    redisConnected = false;
    return null;
  }
}

// CORS headers for allowing requests from your frontend
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Cache settings
const CACHE_TTL = 60 * 60 * 24 * 14; // 14 days in seconds
const HEROES_PROFILE_API = 'https://api.heroesprofile.com/api';

export default async function handler(req, res) {
  // Set CORS headers for all responses
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }

  try {
    // Extract query parameters
    const { battletag, region, game_type, start_date, end_date, no_cache } = req.query;
    
    // Parse no_cache parameter (supports ?no_cache=true or ?no_cache=1)
    const skipCache = no_cache === 'true' || no_cache === '1';

    // Validate required parameters
    if (!battletag) {
      return res.status(400).json({ 
        error: 'Missing parameter',
        message: 'battletag is required (e.g., "oldpa#21616")'
      });
    }

    if (!region) {
      return res.status(400).json({ 
        error: 'Missing parameter',
        message: 'region is required (1=NA, 2=EU, 3=KR, 5=CN)'
      });
    }

    // Validate region
    const validRegions = ['1', '2', '3', '5'];
    if (!validRegions.includes(region)) {
      return res.status(400).json({ 
        error: 'Invalid region',
        message: 'region must be one of: 1 (NA), 2 (EU), 3 (KR), 5 (CN)'
      });
    }

    // Create cache key
    const cacheKey = `player:${battletag}:${region}:${game_type || 'all'}:${start_date || ''}:${end_date || ''}`;

    // Get Redis client
    const redisClient = await getRedisClient();

    // Try to get from cache (only if Redis is available and cache is not skipped)
    if (redisClient && !skipCache) {
      try {
        const cachedDataStr = await redisClient.get(cacheKey);
        if (cachedDataStr) {
          console.log(`Cache hit for ${cacheKey}`);
          const cachedData = JSON.parse(cachedDataStr);
          return res.status(200).json({
            ...cachedData,
            cached: true,
            cache_key: cacheKey,
            redis_available: true
          });
        }
        console.log(`Cache miss for ${cacheKey}`);
      } catch (error) {
        console.log(`Cache read error: ${error.message} - fetching fresh data`);
      }
    } else if (skipCache) {
      console.log(`Cache skipped (no_cache=true) for ${cacheKey}`);
    } else {
      console.log('Redis not available - skipping cache check');
    }

    // Get API token from environment
    const apiToken = process.env.HEROES_PROFILE_TOKEN;
    if (!apiToken) {
      console.error('Missing HEROES_PROFILE_TOKEN environment variable');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'API token not configured'
      });
    }

    // Build API URL
    const params = new URLSearchParams({
      api_token: apiToken,
      battletag: battletag,
      region: region,
      mode: 'json'
    });

    // Add optional parameters
    if (game_type) params.append('game_type', game_type);
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);

    const heroDataUrl = `${HEROES_PROFILE_API}/Player/Hero/All?${params.toString()}`;
    const mmrUrl = `${HEROES_PROFILE_API}/Player/MMR?${params.toString()}`;

    console.log(`Fetching from HeroesProfile API:`);
    console.log(`  - Hero Data: ${heroDataUrl.replace(apiToken, '[REDACTED]')}`);
    console.log(`  - Player MMR: ${mmrUrl.replace(apiToken, '[REDACTED]')}`);

    // Fetch both hero data and player MMR in parallel
    const [heroResponse, mmrResponse] = await Promise.all([
      fetch(heroDataUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotS-Draft-Tool/1.0'
        }
      }),
      fetch(mmrUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotS-Draft-Tool/1.0'
        }
      })
    ]);

    // Check hero data response
    if (!heroResponse.ok) {
      const errorText = await heroResponse.text();
      console.error(`HeroesProfile Hero API error: ${heroResponse.status} - ${errorText}`);
      
      return res.status(heroResponse.status).json({ 
        error: 'HeroesProfile API error',
        message: `Hero API returned ${heroResponse.status}: ${errorText}`,
        status: heroResponse.status
      });
    }

    // Check MMR response (non-fatal if it fails)
    let mmrData = null;
    if (!mmrResponse.ok) {
      const errorText = await mmrResponse.text();
      console.warn(`HeroesProfile MMR API error: ${mmrResponse.status} - ${errorText}`);
      // Don't fail the whole request if MMR fetch fails
    } else {
      mmrData = await mmrResponse.json();
    }

    const heroData = await heroResponse.json();

    // Check if the hero response is valid
    if (!heroData || typeof heroData !== 'object') {
      return res.status(500).json({ 
        error: 'Invalid response',
        message: 'HeroesProfile API returned invalid hero data'
      });
    }

    // Filter hero data: only keep Quick Match and Hero League, filter heroes with < 15 games
    const allowedGameTypes = ['Quick Match', 'Storm League'];
    const filteredHeroData = {};
    
    for (const gameType of allowedGameTypes) {
      if (heroData[gameType] && typeof heroData[gameType] === 'object') {
        const filteredHeroes = {};
        
        for (const [heroName, stats] of Object.entries(heroData[gameType])) {
          // Only keep heroes with 15+ games
          if (stats.games_played && stats.games_played >= 10) {
            filteredHeroes[heroName] = stats;
          }
        }
        
        // Only add game type if it has any heroes left after filtering
        if (Object.keys(filteredHeroes).length > 0) {
          filteredHeroData[gameType] = filteredHeroes;
        }
      }
    }

    // Extract player MMR data (remove battletag wrapper if present)
    // Also filter to only Quick Match and Hero League
    let playerMMR = null;
    if (mmrData) {
      // The MMR API returns data wrapped in the battletag key
      // e.g., { "oldpa#21616": { "Quick Match": {...} } }
      // Extract the inner data
      const battletagKeys = Object.keys(mmrData);
      if (battletagKeys.length > 0) {
        const allMMRData = mmrData[battletagKeys[0]];
        
        // Filter MMR data to only allowed game types
        playerMMR = {};
        for (const gameType of allowedGameTypes) {
          if (allMMRData[gameType]) {
            playerMMR[gameType] = allMMRData[gameType];
          }
        }
        
        // If no allowed game types found, set to null
        if (Object.keys(playerMMR).length === 0) {
          playerMMR = null;
        }
      }
    }

    // Combine both datasets with battletag at top level
    const data = {
      battletag: battletag,
      ...filteredHeroData,
      player_mmr: playerMMR
    };

    // Store in cache 
    if (redisClient) {
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(data));
        console.log(`Cached data for ${cacheKey} (TTL: ${CACHE_TTL}s)`);
      } catch (error) {
        console.log(`Cache write error: ${error.message} - data not cached`);
      }
    } else if (skipCache) {
      console.log(`Cache write skipped (no_cache=true) for ${cacheKey}`);
    }

    // Return the data
    return res.status(200).json({
      ...data,
      cached: false,
      no_cache: skipCache,
      cache_key: cacheKey,
      cache_ttl: redisClient && !skipCache ? CACHE_TTL : 0,
      redis_available: !!redisClient
    });

  } catch (error) {
    console.error('Error in /api/player/heroes:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Apply CORS headers to all responses
export const config = {
  api: {
    bodyParser: false,
  },
};

