#!/bin/bash
sed -i -e "s/maxHeapSize=300m/maxHeapSize=${APPDYNAMICS_PROXY_MAX_HEAP_SIZE:-300m}/" /opt/appdynamics/appdynamics-php-agent/proxy/runProxy
sed -i -e "s/minHeapSize=50m/minHeapSize=${APPDYNAMICS_PROXY_MIN_HEAP_SIZE:-50m}/" /opt/appdynamics/appdynamics-php-agent/proxy/runProxy
sed -i -e "s/maxPermSize=120m/maxPermSize=${APPDYNAMICS_PROXY_MAX_PERM_SIZE:-120m}/" /opt/appdynamics/appdynamics-php-agent/proxy/runProxy
cd /opt/appdynamics/appdynamics-php-agent || exit
./proxy/runProxy -d ./proxy -r "${APPDYNAMICS_PROXY_CONTROL_DIR:-/tmp}" "${APPDYNAMICS_PROXY_COMMUNICATION_DIR:-/tmp}" "${APPDYNAMICS_PROXY_LOG_DIR:-/tmp}"
