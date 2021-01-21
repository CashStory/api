FROM node:alpine

ARG BUILD_DATE
ARG VCS_REF
ENV VERSION 1.3.13
LABEL org.label-schema.build-date=$BUILD_DATE \
  org.label-schema.name="DarkKnight API" \
  org.label-schema.description="API of cashstory" \
  org.label-schema.url="https://cashstory.com" \
  org.label-schema.vcs-ref=$VCS_REF \
  org.label-schema.vcs-url="https://github.com/CashStory/darkKnight" \
  org.label-schema.vendor="Cashstory, Inc." \
  org.label-schema.version=$VERSION \
  org.label-schema.schema-version="1.0"

ENV NPM_CONFIG_LOGLEVEL warn
ENV NODE_ENV production
ENV TZ Europe/Paris

# create workdir
RUN mkdir -p /app
WORKDIR /app

# Copy files
COPY . /app/
RUN mkdir /app/saml/meta
RUN chmod -R 777 /app/saml/meta

# install dependency
RUN npm i

CMD [ "node", "dist/server/app.js" ]
