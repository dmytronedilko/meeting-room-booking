#!/bin/sh
set -e

echo "Applying database migrations..."
# Run the bundled Drizzle migrator directly — npm/npx is stripped from the
# runtime image, and it needs no CLI (it uses drizzle-orm's programmatic
# migrator over the SQL files copied to ./drizzle).
node migrate.js

echo "Seeding demo data..."
node seed.js

echo "Starting API..."
exec node main.js
