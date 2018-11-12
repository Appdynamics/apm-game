#!/bin/bash
env CUSTOM_CODE_DIR="../../scripts" APP_CONFIG="$(<../frontend.json)" APM_CONFIG="$(<../appdynamics.json)" nodemon index.js 8000
