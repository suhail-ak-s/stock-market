#!/bin/bash

# Copy the npm version of package.json
cp package.npm.json package.json

# Build the package
npm run build

# Publish to npm
npm publish

# Restore the original package.json
git checkout package.json 