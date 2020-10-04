import { Response, NextFunction } from 'express';
import * as proxy from 'express-http-proxy';
import axios, { Method, ResponseType } from 'axios';
import objectToQuery from 'object-to-querystring';
import { RequestAuth } from '../models/v1/Auth';

const regexHtml = /\s+(href|src)=['"](.*?)['"]/g;
const regexCss = /url\(['"]?(.*?)['"]?\)/g;
const singleUSerApiVersion = process.env.SINGLEUSER_VERSION || 'v1';
const singleUSerApiPath = process.env.SINGLEUSER_PATH || '.jupyter-single-user.dev.svc.cluster.local';
const htmlError = `
<body>
<div class="bg">
<h1>This box is not accessible for the moment</h1>
<p>Please copy this error and contact bob@cashstory.com for more info :</p>
<pre id="json" class="error">{ERROR}</pre>
</div>
<style>
body {
  font-family: "Roboto", Arial, Helvetica, sans-serif;
  color:white;
  margin:0px;
  height: 100vh;
}
.jstring { color: lightcyan; }
.number { color: darkorange; }
.boolean { color: blue; }
.null { color: magenta; }
.key { color: black; }

.bg{
  background-color: #43C181;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.error {
  max-width: 80%;
  margin-top: 30px;
  padding-top: 40px;
  padding-bottom: 40px;
  padding-right: 15px;
  padding-left: 15px;
  border-radius: 50px;
  background: #43C181;
  white-space: pre-wrap;
  box-shadow:  20px 20px 60px #39a46e,
               -20px -20px 60px #4dde94;
}
</style>
</body>`;

const convertJupHost = (jupyterNameB64) => {
  const b = Buffer.from(jupyterNameB64, 'base64');
  const s = b.toString();
  return `${s}${singleUSerApiPath}`;
};

export const getStatic = (req: RequestAuth, res: Response): Promise<any> => {
  const { token, jupyterName } = req.params;
  if (!jupyterName || !token) {
    res.status(200).json({ error: 'missing jupyterName or token' });
    return Promise.resolve();
  }
  const url = `http://jupyter-${convertJupHost(jupyterName)}:5000/${singleUSerApiVersion}/static/${token}`;
  if (url.indexOf('http://jupyter-') !== 0) {
    res.status(400).json({ error: 'not a static' });
    return Promise.resolve();
  }
  const method = 'get';
  const responseType: any = 'stream';
  return axios.request({
    url,
    method,
    responseType,
  })
    .then((response) => {
      res.set('Content-Type', response.headers['content-type']);
      return response.data.pipe(res);
    })
    .catch((error) => {
      console.error('error static', error);
      const page = htmlError.replace('{ERROR}', JSON.stringify(error, null, 2));
      res.set('Content-Type', 'text/html');
      return res.status(404).send(page);
    });
};
export const runNotebook = (req: RequestAuth, res: Response): Promise<any> => {
  const { token, jupyterName } = req.params;
  if (!jupyterName || !token) {
    res.status(200).json({ error: 'missing jupyterName or token' });
    return Promise.resolve();
  }
  const query = objectToQuery(req.query || {});
  const url: string = `http://jupyter-${convertJupHost(jupyterName)}:5000/${singleUSerApiVersion}/start/${token}${query}`;
  const responseType: ResponseType = 'json';
  return axios.request({
    url,
    method: <Method>req.method,
    responseType,
  })
    .then((response) => res.status(200).json(response.data))
    .catch((error) => {
      console.error('error notebook', error);
      return res.status(400).json(error);
    });
};

export const checkIframeAllowed = (req: RequestAuth, res: Response): Promise<any> => {
  const { url } = req.body;
  if (!url || url === 'null') {
    res.status(200).json({ htmlError, error: 'no url provided' });
    return Promise.resolve();
  }
  return axios.get(url)
    .then((response) => res.status(200).json({ htmlError, headers: response.headers }))
    .catch((error) => {
      // handle error
      console.error('test iframe', error);
      return res.status(200).json({ htmlError, error });
    });
};

export const proxyAll = (req: RequestAuth, res: Response, next: NextFunction): Promise<void> => {
  const url: string = <string>req.query.url;
  if (req.get('referer') && req.get('referer').indexOf(process.env.FRONT_URI) === -1) {
    console.error('Unallowed origin for proxy', req.get('origin'));
    const err = {
      error: 'Unallowed origin for proxy',
      origin: req.get('origin'),
    };
    const page = htmlError.replace('{ERROR}', JSON.stringify(err, null, 2));
    res.send(Buffer.from(page));
    return Promise.resolve();
  }
  return proxy(url, {
    proxyReqPathResolver: () => {
      const parts = url.split('?');
      const queryString = parts[1];
      const updatedPath = parts[0];
      const path = updatedPath + (queryString ? `?${queryString}` : '');
      return encodeURI(path);
    },
    userResHeaderDecorator: (headers) => {
      headers['referrer-policy'] = 'unsafe-url'; // eslint-disable-line no-param-reassign
      headers['content-security-policy'] = `frame-ancestors ${process.env.FRONT_URI}`; // eslint-disable-line no-param-reassign
      headers['Frame-Options'] = `ALLOW-FROM ${process.env.FRONT_URI}`; // eslint-disable-line no-param-reassign
      return headers;
    },
    proxyReqOptDecorator: (proxyReqOpts) => {
      proxyReqOpts.headers['Access-Control-Allow-Origin'] = '*'; // eslint-disable-line no-param-reassign
      return proxyReqOpts;
    },
    userResDecorator: (proxyRes, proxyResData) => {
      let cleanData;
      if (proxyRes.headers['content-type'] === 'text/css') {
        cleanData = proxyResData.toString('utf8').replace(regexCss, (match: string, p1: string) => {
          let newUrl = '';
          if (p1.indexOf('data:') === 0) {
            return p1;
          }
          if (p1.indexOf('http') !== -1) {
            newUrl = p1;
          } else if (p1.substr(0, 2) === '//') {
            newUrl = `http:${p1}`;
          } else {
            const searchURL = new URL(url);
            newUrl = `${searchURL.protocol}//${searchURL.host}/${p1}`;
          }
          return `url(${process.env.BACK_URI}/proxy?url=${newUrl});`;
        });
      } else if (proxyRes.headers['content-type'] === 'text/html') {
        cleanData = proxyResData.toString('utf8').replace(regexHtml, (match: string, p1: string, p2: string) => {
          let newUrl = '';
          if (p2.indexOf('http') !== -1) {
            newUrl = p2;
          } else if (p2.substr(0, 2) === '//') {
            newUrl = `http:${p2}`;
          } else {
            const searchURL = new URL(url);
            newUrl = `${searchURL.protocol}//${searchURL.host}/${p2}`;
          }
          return ` ${p1}="${process.env.BACK_URI}/proxy?url=${newUrl}"`;
        });
      } else {
        cleanData = proxyResData;
      }
      return cleanData;
    },
    proxyErrorHandler: (err, userRes, nextt) => {
      if (userRes.get('Content-Type') === 'text/html') {
        const page = htmlError.replace('{ERROR}', JSON.stringify(err, null, 2));
        return userRes.send(Buffer.from(page));
      }
      return nextt(err);
    },
  })(req, res, next);
};
