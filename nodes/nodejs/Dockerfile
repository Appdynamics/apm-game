FROM node:11
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x /app/node.sh
EXPOSE 80
CMD ["/app/node.sh"]
