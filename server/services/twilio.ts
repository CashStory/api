import * as Twilio from 'twilio';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });
const twilioNumber = process.env.TWILIO_NUMBER;
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_TOKEN;

let client;
if (twilioNumber
  && accountSid
  && accountSid.startsWith('AC')
  && authToken) {
  client = Twilio(accountSid, authToken);
} else {
  client = {
    messages: {
      create: (textContent) => {
        console.error('twiolio is not init proprely', textContent);
      },
    },
  };
}

export default {
  send: (textContent) => {
    textContent.from = twilioNumber; // eslint-disable-line no-param-reassign
    return client.messages.create(textContent);
  },
};
