FROM php:7.3-apache
COPY appdynamics-php-agent-x64-linux-*.tar.bz2 /tmp/
RUN mkdir -p /opt/appdynamics/appdynamics-php-agent; tar xvfj /tmp/appdynamics-php-agent-x64-linux-*.tar.bz2 -C /opt/appdynamics/appdynamics-php-agent --strip 1
RUN /opt/appdynamics/appdynamics-php-agent/install.sh -s -a ACCOUNTNAME@ACCESSKEY CONTROLLERHOST CONTROLLERPORT APPLICATIONNAME TIERNAME NODENAME
RUN a2enmod rewrite
COPY entrypoint.sh /usr/local/bin/
COPY agent-setup.php /usr/local/bin
RUN chmod +x /usr/local/bin/entrypoint.sh
COPY index.php /var/www/html
COPY include_me.php /var/www/html
COPY htaccess.txt /var/www/html/.htaccess
RUN docker-php-ext-install pdo pdo_mysql
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
EXPOSE 80
CMD ["apache2-foreground"]
