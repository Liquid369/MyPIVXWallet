FROM nginx:alpine

RUN apk add --update nodejs npm
COPY . /src
WORKDIR /src
RUN npm i && npm run build && cp dist/* /usr/share/nginx/html

EXPOSE 80
