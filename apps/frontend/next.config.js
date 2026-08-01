//@ts-check

const { join } = require('node:path');
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  reactStrictMode: true,
  // Compact self-contained server bundle for the Docker image.
  output: 'standalone',
  // Required for standalone output in an Nx monorepo: trace files from the
  // workspace root so hoisted node_modules are included. Promoted out of
  // `experimental` in Next 15+.
  outputFileTracingRoot: join(__dirname, '../../'),
};

const plugins = [withNx];

module.exports = composePlugins(...plugins)(nextConfig);
