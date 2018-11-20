FROM php:7.1-apache
COPY appdynamics-php-agent-x64-linux-*.tar.bz2 /tmp/
RUN mkdir -p /opt/appdynamics/appdynamics-php-agent; tar xvfj /tmp/appdynamics-php-agent-x64-linux-*.tar.bz2 -C /opt/appdynamics/appdynamics-php-agent --strip 1
RUN /opt/appdynamics/appdynamics-php-agent/install.sh -s -a ACCOUNTNAME@ACCESSKEY CONTROLLERHOST CONTROLLERPORT APPLICATIONNAME TIERNAME NODENAME
RUN a2enmod rewrite
COPY entrypoint.sh /usr/local/bin/
COPY agent-setup.php /usr/local/bin
RUN chmod +x /usr/local/bin/entrypoint.sh
COPY index.php /var/www/html
COPY htaccess.txt /var/www/html/.htaccess
RUN docker-php-ext-install pdo pdo_mysql
# Patch agent so the analytics host is set to "analytics" (which is an alias for the machine agent host)
RUN /bin/bash -c '[ "$(strings -t d /opt/appdynamics/appdynamics-php-agent/php/modules/appdynamics_agent_php_7.1.so | grep ^3192960)" == "3192960 localhost" ] && (printf "analytics" > /tmp/analytics-patch ; dd if=/tmp/analytics-patch of=/opt/appdynamics/appdynamics-php-agent/php/modules/appdynamics_agent_php_7.1.so obs=1 seek=3192960 conv=notrunc)'
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
EXPOSE 80
CMD ["apache2-foreground"]
