FROM mcr.microsoft.com/dotnet/core/sdk:3.1 AS build-env
WORKDIR /app

# Copy csproj and restore as distinct layers
COPY *.csproj ./
RUN dotnet restore

# Copy everything else and build
COPY . ./
RUN dotnet publish -c Release -o out

# Build runtime image
FROM mcr.microsoft.com/dotnet/core/aspnet:3.1

RUN apt-get update && apt-get install -y \
  unzip \
  && rm -rf /var/lib/apt/lists/*

COPY AppDynamics-DotNetCore-linux-x64-*.zip /tmp
RUN unzip -d /opt/appdynamics /tmp/AppDynamics-DotNetCore-linux-x64-*.zip

COPY ./AppDynamicsConfig.json /opt/appdynamics/AppDynamicsConfig.json

WORKDIR /app
COPY --from=build-env /app/out .
COPY entrypoint.sh /app
#CMD ["dotnet", "dotnetcore.dll"]
CMD ["/app/entrypoint.sh"]
