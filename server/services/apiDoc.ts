import * as swaggerUi from 'swagger-ui-express';
import * as swaggerDocument from '../swagger.json';

const swaggerDoc = swaggerDocument;
// const url = process.env.BACK_URI || 'http://localhost:3000/api/v1';
// swaggerDoc.servers[0].url = url;
const options = {
  explorer: false,
  customSiteTitle: 'CashStory | Augmented Financial Analytics',
  customFavIcon: '/public/favicon.ico',
  swaggerOptions: {
    docExpansion: 'none',
  },
  customJs: '/public/api_doc_custom.js',
  customCssUrl: '/public/api_doc_custom.css',
};

const apiDoc = swaggerUi.setup(swaggerDoc, options);
const apiServe = swaggerUi.serve;
export { apiServe, apiDoc };
