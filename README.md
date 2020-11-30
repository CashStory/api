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
`npm start`: execute TypeScript compiler and Express server.

Files are being watched. Any change automatically creates a new bundle, restart Express server.

### Production mode
`npm start serve.prod`: run the project with a production bundle at [localhost:3000](http://localhost:3000) 


## Running linters
Run `yarn start lint` to execute all lint


### Author
* [Martin donadieu](https://github.com/riderx)
