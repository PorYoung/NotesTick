FROM node:18

# Create app directory
WORKDIR /approot

COPY ../ .

RUN sh deploy/build.sh

RUN cd electron

EXPOSE 3322

CMD ["npm", "run", "serve" ]