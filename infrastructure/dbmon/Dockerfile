FROM openjdk:8
COPY db-agent-*.zip /tmp
RUN unzip -d /opt/appdynamics /tmp/db-agent*.zip
COPY entrypoint.sh /opt/appdynamics
RUN chmod +x /opt/appdynamics/entrypoint.sh
WORKDIR /opt/appdynamics/
CMD ["/opt/appdynamics/entrypoint.sh"]
