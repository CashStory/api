import * as mongoose from 'mongoose';
import { Router } from 'express';
import appVersion from './appVersion';

const HealthCheck = {
  readiness(req, res) {
    if (mongoose.connection.readyState === 0) {
      return res.status(500).json({});
    }
    return res.status(200).json({ status: 'ok' });
  },
  liveness(req, res) {
    return res.status(200).json({ status: 'ok' });
  },
  version(req, res) {
    return appVersion.then((version) => res.status(200).json(version));
  },
  restart(req, res) {
    if (process.env.NODE_ENV === 'production'
      && req.query
      && req.query.token === process.env.SIGN_KEY) {
      process.kill(process.pid, 'SIGTERM');
    }
    return res.status(200).json({ restart: 'ok' });
  },
};

const routerHealth = Router();
// Heathcheck
routerHealth.route('/liveness').post(HealthCheck.liveness);
routerHealth.route('/readiness').post(HealthCheck.readiness);
routerHealth.route('/').post(HealthCheck.version);
routerHealth.route('/liveness').get(HealthCheck.liveness);
routerHealth.route('/readiness').get(HealthCheck.readiness);
routerHealth.route('/restart').get(HealthCheck.restart);
routerHealth.route('/').get(HealthCheck.version);

export default routerHealth;
