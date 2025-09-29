#!/bin/bash

# deployment-cleanup.sh
echo "🚀 Starting Docker deployment cleanup and restart..."

echo "1️⃣  Stopping all running containers..."
docker compose down

echo "2️⃣  Removing all build cache..."
docker builder prune -af

echo "3️⃣  Removing all unused images..."
docker image prune -af

echo "4️⃣  Removing all unused volumes..."
docker volume prune -af

echo "5️⃣  Cleaning up system..."
docker system prune -af

echo "6️⃣  Removing all unused networks..."
docker network prune -f

echo "7️⃣  Starting services in detached mode..."
docker compose up -d

echo "✅ Deployment completed successfully!"
echo "📊 Checking running containers:"
docker compose ps