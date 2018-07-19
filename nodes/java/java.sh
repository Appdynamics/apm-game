#!/bin/bash
if [ "$WITH_AGENT" -eq "1" ]
then
	echo "Running with agent..."
	java -javaagent:/opt/appdynamics/javaagent.jar -jar "javanode-1.0-SNAPSHOT.jar" 80
else
	echo "Running without agent..."
	java -jar "javanode-1.0-SNAPSHOT.jar" 80
fi
