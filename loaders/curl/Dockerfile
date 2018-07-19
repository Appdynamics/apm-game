FROM alpine:latest
RUN apk add --no-cache curl util-linux
WORKDIR /usr/bin/
COPY loader.sh /usr/bin
RUN chmod +x /usr/bin/loader.sh
RUN ls /usr/bin/
ENTRYPOINT ["/usr/bin/loader.sh"]
