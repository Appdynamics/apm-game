#!/bin/bash
if [ "$WITH_AGENT" -eq "1" ]
then
	echo "Running with agent..."
	if [ "$WITH_ANALYTICS" -eq "1" ]
	then
		java -javaagent:/opt/appdynamics/javaagent.jar -Djava.security.egd=file:/dev/urandom -Dappdynamics.analytics.agent.url=http://machine-agent:9090/v2/sinks/bt  -jar "javanode-1.0-SNAPSHOT.jar" 80
	else
		# Also without analytics we want to have docker monitoring, so the additional -Dappdynamics.dockerMonitoring=true is a hint for the machine agent.
		java -javaagent:/opt/appdynamics/javaagent.jar -Djava.security.egd=file:/dev/urandom -Dappdynamics.dockerMonitoring=true -jar "javanode-1.0-SNAPSHOT.jar" 80
	fi
else
	echo "Running without agent..."
	java -jar "javanode-1.0-SNAPSHOT.jar" 80
fi
