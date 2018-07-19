FROM php:7.1-apache
COPY ../../agents/appdynamics-php-agent-x64-linux-*.tar.bz2 /tmp/
RUN mkdir /opt/appdynamics; tar xvfj /tmp/appdynamics-php-agent-x64-linux-*.tar.bz2 -C /opt/appdynamics
RUN /opt/appdynamics/appdynamics-php-agent/install.sh -s -a ACCOUNTNAME@ACCESSKEY CONTROLLERHOST CONTROLLERPORT APPLICATIONNAME TIERNAME NODENAME
RUN a2enmod rewrite
COPY entrypoint.sh /usr/local/bin/
COPY agent-setup.php /usr/local/bin
RUN chmod +x /usr/local/bin/entrypoint.sh
COPY index.php /var/www/html
COPY htaccess.txt /var/www/html/.htaccess
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
EXPOSE 80
CMD ["apache2-foreground"]