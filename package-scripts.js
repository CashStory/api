const npsUtils = require('nps-utils');

module.exports = {
  scripts: {
    default: npsUtils.series.nps('init.env', 'serve'),
    lint: {
      default: npsUtils.concurrent.nps('lint.back'), // default: npsUtils.concurrent.nps('lint.commit', 'lint.front', 'lint.html', 'lint.style', 'lint.back'),
      commit: 'commitlint --from=$(git rev-parse --abbrev-ref --symbolic-full-name @{u}) --to=HEAD',
      back: 'eslint --ext .ts ./server',
      fix: 'eslint --ext .ts ./server --fix',
    },
    build: {
      default: npsUtils.series.nps('build.back'),
      back: 'tsc -p server',
    },
    tag: {
      init: './scripts/init_git_ci.sh',
      done: './scripts/tag_git_ci.sh',
    },
    live: {
      back: 'tsc -w -p server',
    },
    nodemon: 'nodemon --delay 1 dist/server/app.js',
    init: {
      env: 'test -f .env || cp .env_template .env',
      // metadata: 'test -d dist/saml_metadata || cp -rv saml_metadata/ dist/saml_metadata/',
    },
    serve: {
      default: npsUtils.series.nps('serve.dev'),
      dev: npsUtils.concurrent.nps('live.back', 'nodemon'),
      prod: npsUtils.series.nps('build.back', 'serve.back'),
      back: 'node dist/server/app.js',
    },
  },
};
