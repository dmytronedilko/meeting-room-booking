const { composePlugins, withNx } = require('@nx/webpack');

// Options (entry points, tsConfig, generatePackageJson, ...) come from
// the `build` target in project.json.
module.exports = composePlugins(withNx(), (config) => config);
