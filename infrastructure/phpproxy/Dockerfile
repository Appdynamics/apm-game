FROM php:7.4-apache
COPY appdynamics-php-agent-x64-linux-*.tar.bz2 /tmp/
RUN mkdir -p /opt/appdynamics/appdynamics-php-agent; tar xvfj /tmp/appdynamics-php-agent-x64-linux-*.tar.bz2 -C /opt/appdynamics/appdynamics-php-agent --strip 1
RUN /opt/appdynamics/appdynamics-php-agent/install.sh -s -a ACCOUNTNAME@ACCESSKEY CONTROLLERHOST CONTROLLERPORT APPLICATIONNAME TIERNAME NODENAME
COPY entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
