FROM node:8.9.1

RUN mkdir /app 
WORKDIR /app 

COPY yarn.lock package.json ./
RUN yarn 

COPY . /temp
RUN rm -rf /temp/node_modules && cp -Rv /temp/* /app 
EXPOSE 80
CMD npm start