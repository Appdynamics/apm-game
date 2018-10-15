#!/bin/bash
if [ "$WITH_AGENT" -eq "1" ]
then
	echo "Running with agent..."
  # The additional "-Dappdynamics.dockerMonitoring=true" is only a hint for the machine agent to add this container to docker monitoring.
  node index.js 8000 -Dappdynamics.dockerMonitoring=true
else
	echo "Running without agent..."
	node index.js 8000
fi
