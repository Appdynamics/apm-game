#!/bin/bash
env APP_CONFIG="$(<../frontend.json)" APM_CONFIG="$(<../appdynamics.json)" mvn clean compile exec:java
