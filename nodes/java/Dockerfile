FROM openjdk:8
COPY AppServerAgent*.zip /tmp
RUN unzip -d /opt/appdynamics /tmp/AppServerAgent*.zip
RUN mkdir -p /app/dependency-jars
COPY entrypoint.sh /app
RUN chmod +x /app/entrypoint.sh
COPY target/javanode-1.0-SNAPSHOT.jar /app
COPY target/dependency-jars /app/dependency-jars
RUN cp /opt/appdynamics/javaagent.jar /app/
RUN cd /opt/appdynamics/ver*/external-services/ ; [ -f netviz.zip ] && unzip netviz.zip || echo "No netviz.zip found"
WORKDIR /app
EXPOSE 80
CMD ["/app/entrypoint.sh"]
