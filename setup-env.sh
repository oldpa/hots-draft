#!/bin/bash

# Setup script for creating .env file

echo "🔧 Setting up environment variables..."
echo ""

# Check if .env already exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled. Keeping existing .env file."
        exit 0
    fi
fi

# Prompt for API token
echo "Please enter your HeroesProfile API token:"
echo "(Get one from: https://api.heroesprofile.com/)"
read -p "Token: " api_token

if [ -z "$api_token" ]; then
    echo "❌ Error: API token cannot be empty"
    exit 1
fi

# Create .env file
cat > .env << EOF
# HeroesProfile API Token
# Get your API token from: https://api.heroesprofile.com/
HEROES_PROFILE_TOKEN=$api_token

# Vercel KV (automatically provided by Vercel when deployed)
# No need to set these locally, Vercel will inject them
# KV_REST_API_URL=
# KV_REST_API_TOKEN=
EOF

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "📁 Location: $(pwd)/.env"
echo ""
echo "🚀 Next steps:"
echo "   1. Run: npm run dev"
echo "   2. Test: curl http://localhost:3000/api/health"
echo ""

