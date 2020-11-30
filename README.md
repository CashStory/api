#  Workspaces Api 

Whole stack in [TypeScript](https://www.typescriptlang.org).

This project uses the [MEAN stack](https://en.wikipedia.org/wiki/MEAN_(software_bundle)):
* [**M**ongoose.js](http://www.mongoosejs.com) ([MongoDB](https://www.mongodb.com)): database
* [**E**xpress.js](http://expressjs.com): backend framework
* [**N**ode.js](https://nodejs.org): runtime environment

Other tools and technologies used:
* [JSON Web Token](https://jwt.io): user authentication
* [Bcrypt.js](https://github.com/dcodeIO/bcrypt.js): password encryption

## Prerequisites
1. Install [Node.js](https://nodejs.org) and [MongoDB](https://www.mongodb.com)
2. From project root folder install all the dependencies: `npm i`
3. create `.env` file with theses vars
```
MONGODB_URI=mongodb://URLOFYOURMONGO
MAX_WORKER=1
FRONT_URI=https://bob.dev.cashstory.com
FTP_URI=https://ftp.cashstory.com
FTP_AUTH_TOKEN=APIKEY
BACK_URI=https://darkknight.dev.cashstory.com
SECRET_TOKEN=RANDOMTOKEN
ENCRYPT_KEY= Result of => openssl rand -base64 32;
SIGN_KEY= Result of => openssl rand -base64 64;
TWILIO_NUMBER=TWIOLIOMOBILE
TWILIO_SID=TWIOLIOSID
TWILIO_TOKEN=TWIOLIOTOKEN
EMAIL_HOST=SMTPSERVER
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=EMAIL
EMAIL_PASSWORD=PASS
EMAIL_FROM=EMAIL
EMAIL_ADMIN=EMAIL1, EMAIL2
SLACK_WEBHOOK=WEBHOOKURL
SLACK_NAME=NAME
SLACK_CHANNEL=#CHANNEL
API_KEY_CLOCKIFY=APIKEY
API_KEY_WAKATIME=APIKEY
TZ=Europe/Paris
DK_ENV=dev
WORKSPACEDEFAULT=5eaa9b7c87e99ef2430a270a
DEBUG=true
NODE_ENV=production
```

## Run
### Development mode
`npm start`: [nps](https://github.com/kentcdodds/nps#readme) execute TypeScript compiler and Express server.

Express files are being watched. Any change automatically creates a new bundle, restart Express server.

### Production mode
`npm start serve.prod`: run the project with a production bundle at [localhost:3000](http://localhost:3000) 

## Deploy (with docker)
1. Exemple using docker-compose and image cashstory/node-git:latest
``` 
version: '3'

services:
  darkknight:
    image: registry.gitlab.com/bobcashstory/darkknight:dev
    container_name: darkknight-dev
    restart: always
    networks:
      - galaxy_cs-tier
    environment:
      - MONGODB_URI=URI
      - SECRET_TOKEN=TOKEN
      - PORT=8080
      - SLACKTEE_TOKEN=TOKEN
      - SLACK_NAME=NAME
      - SLACK_CHANNEL=#CHANNEL
      - FRONT_URI=https://bob.dev.cashstory.com
      - FTP_URI=https://ftp.cashstory.com
      - CS_DATABASE=darkknight-dev
      - EMAIL_HOST=HOST
      - EMAIL_PORT=PORT
      - EMAIL_SECURE=true
      - EMAIL_USER=apikey
      - EMAIL_PASSWORD=PASS
      - EMAIL_FROM=bob@cashstory.com
      - EMAIL_ADMIN=bob@cashstory.com, jeremy.ravenel@cashstory.com
      - DK_ENV=dev
      - API_KEY_CLOCKIFY=APIKEY+g5t
```
## Running linters
Run `yarn start lint` to execute all lint

## Wiki
To get more help about this project, [visit the official wiki](https://github.com/DavideViolante/Angular-Full-Stack/wiki).


### Author
* [Martin donadieu](https://github.com/riderx)
