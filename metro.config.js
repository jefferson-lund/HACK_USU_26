const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('mjs');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'is-any-array') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/is-any-array/lib/index.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
