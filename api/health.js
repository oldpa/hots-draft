/**
 * Health Check Endpoint
 * 
 * Endpoint: /api/health
 * 
 * Simple endpoint to verify the API is running
 */

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Set CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'HotS Draft Tool API is running',
    endpoints: {
      health: '/api/health',
      playerHeroes: '/api/player/heroes?battletag=BATTLETAG&region=REGION'
    }
  });
}

