import * as express from 'express';
import * as dotenv from 'dotenv';
import * as morgan from 'morgan';
import {
  promBeforeEach, promAfterEach, initPrometeus, stopPrometeus,
} from './services/prometheus';
import routes from './routes';
import appVersion from './services/appVersion';
import slack from './services/slack';
import HealthCheck from './services/HealthCheck';
import { initDb, closeDb, connection } from './services/mongoose';
import { seedDb } from './services/seedDb';
import { passport } from './services/auth';

const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const cookieParser = require('cookie-parser');

const app: express.Express = express();
seedDb();
initPrometeus(app);
promBeforeEach(app);
app.use(morgan('tiny'));
dotenv.config({ path: '.env' });
app.set('port', (process.env.PORT || 3000));
/* end of redirection */
app.use(passport.initialize());
app.use(cookieParser());
app.use(passport.session());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/', HealthCheck);

promAfterEach(app);
routes(app);

const mongodb = initDb(process.env.MONGODB_URI);

mongodb
  .then(() => {
    console.log('mongo connected'); // eslint-disable-line no-console
    app.use(session({
      secret: 'secret',
      store: new MongoStore({ mongooseConnection: connection }),
      proxy: true,
      resave: true,
      saveUninitialized: true,
    }));
  }).catch((err) => {
    console.error('mongo error', err);
  });
const server = app.listen(app.get('port'), () => {
  appVersion.then((res) => {
    // eslint-disable-next-line no-console
    console.log(`DarkKnight PID ${process.pid},
    version ${JSON.stringify(res)},
    port ${app.get('port')}, http://localhost:${app.get('port')}`);
    slack.send(`DarkKnight started, ${JSON.stringify(res)}`)
      .catch((err) => {
        console.error(`DarkKnight slack error ${err}`);
      });
  }).catch((err) => {
    console.error(`DarkKnight appVersion error ${err}`);
  });
});
function shutdown(callback, code = 1) {
  // shutdown connections
  stopPrometeus();
  if (server) {
    server.close((err) => {
      if (err) {
        console.error('server close error', err);
        process.exit(code);
      }
      return callback ? callback(code) : null;
    });
  } else {
    process.exit(1);
  }
  closeDb();
  console.log('DarkKnight shutdown'); // eslint-disable-line no-console
  slack.send('DarkKnight shutdown')
    .catch((err) => {
      console.error(`DarkKnight slack error ${err}`);
    });
  process.exit(code);
}
app.on('error', (error: any) => {
  if (error.syscall !== 'listen') {
    throw error;
  }
  switch (error.code) {
    case 'EACCES':
      console.error('Port requires elevated privileges');
      shutdown(process.exit);
      break;
    case 'EADDRINUSE':
      console.error('Port is already in use');
      shutdown(process.exit);
      break;
    default:
      throw error;
  }
});

process.once('SIGUSR2', () => {
  console.error('SIGUSR2');
  shutdown(process.exit);
});

process.on('SIGINT', () => {
  console.error('SIGINT');
  shutdown(process.exit);
});

process.on('SIGTERM', () => {
  console.error('SIGTERM');
  shutdown(process.exit);
});

if (process.env.NODE_ENV === 'production') {
  process.on('exit', () => {
    console.error('exit');
    shutdown(null);
  });
}

export default app;
