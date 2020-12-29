#!/bin/bash
HOST_IP=$(ip -4 route show default | cut -d' ' -f3)
sed -i -e "s#netviz.agent.host.address=.*#netviz.agent.host.address=${HOST_IP}#" /opt/appdynamics/ver*/external-services/netviz/netviz-service.properties
LIVEDEBUG=""
if [ "${WITH_LIVEDEBUG}" -eq "1" ] && [ -f rook.jar ]
then
	echo "Running with livedebug..."
	LIVEDEBUG="-javaagent:rook.jar"
fi
if [ "$WITH_AGENT" -eq "1" ]
then
	echo "Running with agent..."
	if [ "$WITH_ANALYTICS" -eq "1" ]
	then
		java -javaagent:/opt/appdynamics/javaagent.jar ${LIVEDEBUG} -Djava.security.egd=file:/dev/urandom -Dappdynamics.socket.collection.bci.enable=true -Dappdynamics.analytics.agent.url=http://machine-agent:9090/v2/sinks/bt  -jar "javanode-1.0-SNAPSHOT.jar" 80
	else
		# Also without analytics we want to have docker monitoring, so the additional -Dappdynamics.dockerMonitoring=true is a hint for the machine agent.
		java -javaagent:/opt/appdynamics/javaagent.jar ${LIVEDEBUG} -Djava.security.egd=file:/dev/urandom -Dappdynamics.socket.collection.bci.enable=true -Dappdynamics.dockerMonitoring=true -jar "javanode-1.0-SNAPSHOT.jar" 80
	fi
else
	echo "Running without agent..."
	java -jar "javanode-1.0-SNAPSHOT.jar" 80
fi
