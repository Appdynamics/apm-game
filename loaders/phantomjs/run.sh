#!/bin/bash
env LOAD_CONFIG="$(<../example.json)" APM_CONFIG="$(<../../nodes/appdynamics.json)" phantomjs loader.js
