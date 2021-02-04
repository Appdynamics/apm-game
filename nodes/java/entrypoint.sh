#!/bin/bash
HOST_IP=$(ip -4 route show default | cut -d' ' -f3)
sed -i -e "s#netviz.agent.host.address=.*#netviz.agent.host.address=${HOST_IP}#" /opt/appdynamics/ver*/external-services/netviz/netviz-service.properties
LIVEDEBUG=""
OPENTELEMETRY=""

if [ "${WITH_LIVEDEBUG:-0}" -eq "1" ] && [ -f rook.jar ]
then
	echo "Running with livedebug..."
	LIVEDEBUG="-javaagent:rook.jar"
fi

if [ "${WITH_OTEL:-0}" -eq "1" ] && [ -f opentelemetry-javaagent-all.jar ]
then
	echo "Running with opentelemetry..."
	OPENTELEMETRY="-javaagent:opentelemetry-javaagent-all.jar -Dotel.trace.exporter=otlp -Dotel.metrics.exporter=none -Dotel.resource.attributes=service.name=${APPDYNAMICS_AGENT_TIER_NAME} -Dotel.exporter.otlp.endpoint=http://opentelemetry-collector:55680/"
	echo "${OPENTELEMETRY}"
fi

if [ "$WITH_AGENT" -eq "1" ]
then
	echo "Running with agent..."
	if [ "$WITH_ANALYTICS" -eq "1" ]
	then
		java -javaagent:/opt/appdynamics/javaagent.jar ${LIVEDEBUG} ${OPENTELEMETRY} -Djava.security.egd=file:/dev/urandom -Dappdynamics.socket.collection.bci.enable=true -Dappdynamics.analytics.agent.url=http://machine-agent:9090/v2/sinks/bt  -jar "javanode-1.0-SNAPSHOT.jar" 80
	else
		# Also without analytics we want to have docker monitoring, so the additional -Dappdynamics.dockerMonitoring=true is a hint for the machine agent.
		java -javaagent:/opt/appdynamics/javaagent.jar ${LIVEDEBUG} ${OPENTELEMETRY} -Djava.security.egd=file:/dev/urandom -Dappdynamics.socket.collection.bci.enable=true -Dappdynamics.dockerMonitoring=true -jar "javanode-1.0-SNAPSHOT.jar" 80
	fi
else
	echo "Running without agent..."
	echo java ${OPENTELEMETRY} -jar "javanode-1.0-SNAPSHOT.jar" 80
	java ${OPENTELEMETRY} -jar "javanode-1.0-SNAPSHOT.jar" 80
fi
