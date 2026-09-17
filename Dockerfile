# syntax=docker/dockerfile:1

# Stage 1: build the React client. Kept separate so the .NET SDK image never needs Node installed.
FROM node:22-alpine AS spa
WORKDIR /spa
COPY Trumpfish.WebClient/package.json Trumpfish.WebClient/package-lock.json ./
# The cache mount keeps the downloaded packages out of the image layer and lets a rebuild reuse them when the lock file changed.
RUN --mount=type=cache,target=/root/.npm npm ci
COPY Trumpfish.WebClient/ ./
RUN npm run build

# Stage 2: restore and publish the server. SkipSpaBuild makes the build reuse the bundle from the spa stage
# instead of shelling out to npm, and drops the esproj reference that the .NET SDK image cannot restore.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Trumpfish.Server/Trumpfish.Server.csproj Trumpfish.Server/
COPY Model/Model.csproj Model/
# Restored into the layer rather than into a mounted cache. A cache mount is never part of the layer and never
# travels with the layer cache that the pipeline exports, so a runner reusing this step would inherit an assets
# file naming packages that are not on its disk, and the publish below would fail looking for them.
RUN dotnet restore Trumpfish.Server/Trumpfish.Server.csproj -p:SkipSpaBuild=true
COPY Model/ Model/
COPY Trumpfish.Server/ Trumpfish.Server/
# The double dummy solver, if this working copy has it built. The project file picks it up when it is there and leaves the
# analysis endpoint reporting itself unavailable when it is not, so the image builds either way. See native/README.md.
COPY native/ native/
COPY --from=spa /spa/dist/ Trumpfish.WebClient/dist/
# --no-restore trusts the restore above, whose packages now live in a layer of their own and are always present.
RUN dotnet publish Trumpfish.Server/Trumpfish.Server.csproj \
    --no-restore \
    --configuration Release \
    --output /app/publish \
    -p:SkipSpaBuild=true

# Stage 3: runtime.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

# The runtime image ships without an HTTP client, and the health probe below needs one. Installed before the user is dropped.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish ./

# The data protection key ring is mounted here in production. Created ahead of the volume so it carries the right owner.
RUN mkdir -p /app/keys && chown $APP_UID /app/keys

# App Service probes this port; pair it with the WEBSITES_PORT app setting.
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

# The start-period covers the first run against an empty database, where migrations and the seed files come first.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl --fail --silent --show-error http://localhost:8080/healthz || exit 1

USER $APP_UID
ENTRYPOINT ["dotnet", "Trumpfish.Server.dll"]
