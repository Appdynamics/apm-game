#!/bin/bash
set -e

if [ "$WITH_AGENT" -eq "1" ]
then
	echo "[PHP] Running with agent..."
	php /usr/local/bin/agent-setup.php /usr/local/etc/php/conf.d/appdynamics_agent.ini
else
	echo "[PHP] Running without agent..."
	rm /usr/local/etc/php/conf.d/appdynamics_agent.ini
fi

# first arg is `-f` or `--some-option`
if [ "${1#-}" != "$1" ]; then
	set -- apache2-foreground "$@"
fi

exec "$@"
