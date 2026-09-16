// Expo's standard monorepo Metro config (https://docs.expo.dev/guides/monorepos/).
// Needed from SDK 54 on: newer Metro/Expo CLI no longer auto-detects the
// workspace root the way SDK 51's did, and without this the bundler resolves
// `./index` relative to the monorepo root instead of this package.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Only the shared workspace package needs to be watched outside this app.
// Watching the whole repository makes Metro's Windows fallback watcher crawl
// generated output such as apps/web/.next, which can disappear mid-crawl.
config.watchFolders = [path.resolve(workspaceRoot, 'packages/shared')];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [config.resolver.blockList]),
  /[\\/]\.next[\\/]/,
  /[\\/]\.git[\\/]/,
  /[\\/]\.turbo[\\/]/,
  /[\\/]coverage[\\/]/,
  // apps/web's and apps/api's own build output specifically — NOT a bare
  // `dist`/`build` pattern, which would also match legitimate npm packages
  // that ship their main entry under node_modules/<pkg>/dist (e.g.
  // whatwg-url-minimum) and break resolution.
  /apps[\\/](web|api)[\\/](dist|build)[\\/]/,
  // Nested node_modules of sibling workspace apps — module resolution only
  // ever needs the two paths in nodeModulesPaths above; watching these too
  // is pure extra crawl surface for no benefit.
  /apps[\\/](web|api)[\\/]node_modules[\\/]/,
];

module.exports = config;
