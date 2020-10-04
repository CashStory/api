import * as mongoose from 'mongoose';
import * as cachegoose from 'cachegoose';

if (process.env.DEBUG === 'true') {
  mongoose.set('debug', true);
}
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);
let mongodb;

export const { connection } = mongoose;
export const initDb = (mongodbURI) => {
  mongodb = mongoose.connect(mongodbURI, {
    connectTimeoutMS: 500,
    poolSize: 10,
  });
  if (process.env.REDIS_PORT && process.env.REDIS_HOST) {
    cachegoose(mongoose, {
      engine: 'redis',
      port: Number(process.env.REDIS_PORT) || 6379,
      host: process.env.REDIS_HOST || 'localhost',
    });
  } else {
    cachegoose(mongoose, {});
  }
  return mongodb;
};

export const reloadModels = () => {
  delete mongoose.connection.models.Logs;
  delete mongoose.connection.models.Emails;
  delete mongoose.connection.models.Files;
  delete mongoose.connection.models.Users;
  delete mongoose.connection.models.Workspaces;
  mongoose['models' as any] = {};
};

export const closeDb = () => {
  if (mongodb) {
    mongoose.connection.close();
    mongoose.disconnect();
    mongodb = null;
    console.log('Disconnect to MongoDB'); // eslint-disable-line no-console
  }
};
