FROM alekzonder/puppeteer
WORKDIR /app
COPY package.json /app
RUN sed -i -e s'#"puppeteer": .*##' /app/package.json
RUN npm install
COPY index.js /app
