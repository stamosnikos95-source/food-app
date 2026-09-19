// Standard Expo + monorepo Metro config: without this, Metro (run with
// apps/mobile as projectRoot) never watches the workspace root, so it can't
// resolve packages that live in the root node_modules/.pnpm store or in
// sibling workspace packages (@food-app/design-tokens, @food-app/shared-types).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
