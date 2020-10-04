import { Response } from 'express';
import { RequestAuth } from '../models/v1/Auth';

const dialogflow = require('dialogflow');

class DialogFlowService {
  projectId = null;

  sessionClient = null;

  constructor() {
    if (DialogFlowService.isDialogFlowConfig()) {
      this.projectId = process.env.DIALOGFLOW_ID;

      const privateKey = (process.env.NODE_ENV === 'production')
        ? JSON.parse(process.env.DIALOGFLOW_PRIVATE_KEY) : process.env.DIALOGFLOW_PRIVATE_KEY;
      const clientEmail = process.env.DIALOGFLOW_CLIENT_EMAIL;
      const config = {
        credentials: {
          private_key: privateKey,
          client_email: clientEmail,
        },
      };

      this.sessionClient = new dialogflow.SessionsClient(config);
    }
  }

  static isDialogFlowConfig() {
    return process.env.DIALOGFLOW_PRIVATE_KEY
    && process.env.DIALOGFLOW_CLIENT_EMAIL
    && process.env.DIALOGFLOW_ID;
  }

  async sendTextMessage(userId, text, languageCode) {
    // Define session path
    const sessionPath = this.sessionClient.sessionPath(this.projectId, userId);
    // The text query request.
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text,
          languageCode,
        },
      },
    };
    try {
      const responses = await this.sessionClient.detectIntent(request);
      // console.log('DialogFlow.sendTextMessageToDialogFlow: Detected intent');
      return responses;
    } catch (err) {
      console.error('DialogFlow.sendTextMessageToDialogFlow ERROR:', err);
      throw err;
    }
  }

  post = async (req: RequestAuth, res: Response): Promise<Response> => {
    if (DialogFlowService.isDialogFlowConfig()) {
      try {
        const obj = await this.sendTextMessage(req.auth.user._id, req.body.text, req.body.lang);
        return res.status(201).json(obj);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
    return res.status(400).json({ error: 'dialogflow not set' });
  };
}
const dialogFlow = new DialogFlowService();
export default dialogFlow;
