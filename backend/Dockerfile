FROM gradle:8.12-jdk21 AS build
WORKDIR /app
COPY build.gradle settings.gradle ./
COPY src ./src
RUN gradle --no-daemon bootJar

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/build/libs/*.jar app.jar
EXPOSE 8080
EXPOSE 5005
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
