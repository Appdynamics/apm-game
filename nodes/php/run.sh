#!/bin/bash
env APP_CONFIG="$(<../frontend.json)" APM_CONFIG="$(<../appdynamics.json)" php -S localhost:9001
