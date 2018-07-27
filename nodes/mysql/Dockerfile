FROM mysql:5.7
RUN apt-get update && apt-get install -y --no-install-recommends php-cli && rm -rf /var/lib/apt/lists/*
COPY setup.php /tmp/
COPY setup.sh /docker-entrypoint-initdb.d/
