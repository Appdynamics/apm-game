#!/bin/bash
env APP_CONFIG="$(<../frontend.json)" APM_CONFIG="$(<../appdynamics.json)" php -S 127.0.0.1:9001
