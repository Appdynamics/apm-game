FROM wernight/phantomjs
RUN mkdir /tmp/load
COPY loader.js /tmp/load
WORKDIR /tmp/load
CMD ["phantomjs", "loader.js"]
