#!/bin/bash
env APP_CONFIG="$(<../frontend.json)" APM_CONFIG="$(<../appdynamics.json)" mvn -e clean compile exec:java
