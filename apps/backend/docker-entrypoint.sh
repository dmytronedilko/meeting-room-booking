#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy --schema ./prisma/schema.prisma

echo "Seeding demo data..."
node seed.js

echo "Starting API..."
exec node main.js
