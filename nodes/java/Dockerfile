FROM openjdk:8
COPY AppServerAgent*.zip /tmp
RUN unzip -d /opt/appdynamics /tmp/AppServerAgent*.zip
RUN mkdir -p /app/dependency-jars
COPY java.sh /app
COPY target/javanode-1.0-SNAPSHOT.jar /app
COPY target/dependency-jars /app/dependency-jars
COPY /opt/appdynamics/javaagent.jar /app/dependency-jars
WORKDIR /app
EXPOSE 80
CMD ["/app/java.sh"]
