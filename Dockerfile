# syntax=docker/dockerfile:1

# Stage 1: build the React client. Kept separate so the .NET SDK image never needs Node installed.
FROM node:22-alpine AS spa
WORKDIR /spa
COPY Trumpfish.WebClient/package.json Trumpfish.WebClient/package-lock.json ./
RUN npm ci
COPY Trumpfish.WebClient/ ./
RUN npm run build

# Stage 2: restore and publish the server. SkipSpaBuild makes the build reuse the bundle from the spa stage
# instead of shelling out to npm, and drops the esproj reference that the .NET SDK image cannot restore.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Trumpfish.Server/Trumpfish.Server.csproj Trumpfish.Server/
COPY Model/Model.csproj Model/
RUN dotnet restore Trumpfish.Server/Trumpfish.Server.csproj -p:SkipSpaBuild=true
COPY Model/ Model/
COPY Trumpfish.Server/ Trumpfish.Server/
COPY --from=spa /spa/dist/ Trumpfish.WebClient/dist/
RUN dotnet publish Trumpfish.Server/Trumpfish.Server.csproj \
    --no-restore \
    --configuration Release \
    --output /app/publish \
    -p:SkipSpaBuild=true

# Stage 3: runtime.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish ./

# App Service probes this port; pair it with the WEBSITES_PORT app setting.
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

USER $APP_UID
ENTRYPOINT ["dotnet", "Trumpfish.Server.dll"]
