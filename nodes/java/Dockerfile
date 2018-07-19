FROM openjdk:8
RUN mkdir -p /app/dependency-jars
COPY target/javanode-1.0-SNAPSHOT.jar /app
COPY target/dependency-jars /app/dependency-jars
WORKDIR /app
EXPOSE 80
CMD ["java", "-jar", "javanode-1.0-SNAPSHOT.jar", "80"]
