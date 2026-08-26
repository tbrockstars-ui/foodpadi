// Expo's standard monorepo Metro config (https://docs.expo.dev/guides/monorepos/).
// Needed from SDK 54 on: newer Metro/Expo CLI no longer auto-detects the
// workspace root the way SDK 51's did, and without this the bundler resolves
// `./index` relative to the monorepo root instead of this package.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
