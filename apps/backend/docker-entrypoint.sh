#!/bin/sh
set -e

echo "Applying database migrations..."
# Call the prisma binary directly — npm/npx is stripped from the runtime image.
./node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma

echo "Seeding demo data..."
node seed.js

echo "Starting API..."
exec node main.js
