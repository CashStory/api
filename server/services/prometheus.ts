import * as Prom from 'prom-client';

export const Prometheus = Prom;

let metricsInterval;

const httpRequestDurationMicroseconds = new Prom.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500],
});

export const promBeforeEach = (app) => {
  // Runs before each requests
  if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      res.locals.startEpoch = Date.now();
      next();
    });
  }
};

export const promAfterEach = (app) => {
  if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      const responseTimeInMs = Date.now() - res.locals.startEpoch;
      httpRequestDurationMicroseconds
        .labels(req.method, req.originalUrl, res.statusCode)
        .observe(responseTimeInMs);
      next();
    });
  }
};

export const initPrometeus = (app) => {
  if (process.env.NODE_ENV === 'production') {
    metricsInterval = Prometheus.collectDefaultMetrics();
    app.get('/metrics', (req, res) => {
      res.set('Content-Type', Prometheus.register.contentType);
      return res.end(Prometheus.register.metrics());
    });
  }
};

export const stopPrometeus = () => {
  clearInterval(metricsInterval);
  Prometheus.register.clear();
};
