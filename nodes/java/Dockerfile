FROM maven:3-jdk-11 AS build
COPY AppServerAgent*.zip /tmp
RUN unzip -d /opt/appdynamics /tmp/AppServerAgent*.zip
WORKDIR /home/app
RUN cp /opt/appdynamics/javaagent.jar /home/app
COPY src /home/app/src
COPY pom.xml /home/app
RUN mvn -f /home/app/pom.xml clean package

FROM openjdk:11-jre
COPY AppServerAgent*.zip /tmp
RUN unzip -d /opt/appdynamics /tmp/AppServerAgent*.zip
RUN mkdir -p /app/dependency-jars
WORKDIR /app
COPY --from=build /home/app/target /app/
COPY entrypoint.sh /app
RUN chmod +x /app/entrypoint.sh
RUN cp /opt/appdynamics/javaagent.jar /app/
RUN cd /opt/appdynamics/ver*/external-services/ ; [ -f netviz.zip ] && unzip netviz.zip || echo "No netviz.zip found"
COPY extras/* /app/
EXPOSE 80
CMD ["/app/entrypoint.sh"]
