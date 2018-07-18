#!/bin/bash
echo "RUNNING PHP!"
#!/bin/sh
set -e

php /usr/local/bin/agent-setup.php /usr/local/etc/php/conf.d/appdynamics_agent.ini

echo $APM_CONFIG

# first arg is `-f` or `--some-option`
if [ "${1#-}" != "$1" ]; then
	set -- apache2-foreground "$@"
fi

exec "$@"
