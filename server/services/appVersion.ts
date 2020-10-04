import * as npmVersion from 'npm-version';
import * as nodeVersion from 'node-version';
import { version } from '../../info.json';

export default new Promise((resolve, reject) => {
  if (process.env.NODE_ENV !== 'test') {
    npmVersion((errNpm, currentNpmVersion) => {
      if (errNpm) {
        reject(errNpm);
      } else {
        resolve({
          version,
          pid: process.pid,
          node: nodeVersion.original,
          npm: currentNpmVersion,
        });
      }
    });
  }
});
