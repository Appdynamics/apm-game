FROM openjdk:8
RUN mkdir /app
RUN mkdir /app/classes
COPY JavaNode.java /app
COPY jetty-all-uber.jar /app
WORKDIR /app
EXPOSE 80
RUN javac -d classes -cp jetty-all-uber.jar JavaNode.java
CMD ["java", "-cp", "classes:jetty-all-uber.jar", "com.appdynamics.apmgame.JavaNode"]
