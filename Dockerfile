FROM node:18-alpine

RUN apk add --no-cache git

RUN apk add --no-cache libc6-compat

WORKDIR /usr/app

COPY ./package.json ./

RUN npm install

COPY ./ ./ 

CMD ["npm","start"]
