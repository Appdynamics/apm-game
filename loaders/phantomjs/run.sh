#!/bin/bash
env LOADER_CONFIG="$(<../example.json)" APM_CONFIG="$(<../../nodes/appdynamics.json)" phantomjs loader.js
