#!/bin/bash
if [ "${WITH_ANALYTICS}" == "1" ]
then
	sed -i -e "s/<enabled>false<\/enabled>/<enabled>true<\/enabled>/" /opt/appdynamics/monitors/analytics-agent/monitor.xml
	sed -i -e "s#ad\.controller\.url=http:\/\/localhost:8090#ad\.controller\.url=${APPDYNAMICS_ANALYTICS_CONTROLLER}#" /opt/appdynamics/monitors/analytics-agent/conf/analytics-agent.properties
	sed -i -e "s#http\.event\.endpoint=http:\/\/localhost:9080#http\.event\.endpoint=${APPDYNAMICS_ANALYTICS_EVENTS_SERVICE}#" /opt/appdynamics/monitors/analytics-agent/conf/analytics-agent.properties
	sed -i -e "s#http\.event\.name=customer1#http\.event\.name=${APPDYNAMICS_ANALYTICS_ACCOUNT_NAME}#" /opt/appdynamics/monitors/analytics-agent/conf/analytics-agent.properties
	sed -i -e "s#http\.event\.accountName=analytics-customer1#http\.event\.accountName=${APPDYNAMICS_ANALYTICS_GLOBAL_ACCOUNT_NAME}#" /opt/appdynamics/monitors/analytics-agent/conf/analytics-agent.properties
	sed -i -e "s#http\.event\.accessKey=your-account-access-key#http\.event\.accessKey=${APPDYNAMICS_ANALYTICS_ACCESS_KEY}#" /opt/appdynamics/monitors/analytics-agent/conf/analytics-agent.properties
fi
java ${MACHINE_AGENT_PROPERTIES} -jar /opt/appdynamics/machineagent.jar
