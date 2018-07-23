#!/bin/bash
env APP_CONFIG="$(<../frontend.json)" APM_CONFIG="$(<../appdynamics.json)" nodemon index.js 8000
