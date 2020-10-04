import * as dotenv from 'dotenv';

const SlackBot = require('slack');

dotenv.config({ path: '.env' });

let slack; // eslint-disable-line import/no-mutable-exports
if (process.env.SLACKTEE_TOKEN && process.env.SLACK_NAME && process.env.SLACK_CHANNEL) {
  const slackBot = new SlackBot({ token: process.env.SLACKTEE_TOKEN });
  slack = {
    send: (message) => slackBot.chat.postMessage({
      token: process.env.SLACKTEE_TOKEN,
      channel: process.env.SLACK_CHANNEL,
      icon_emoji: ':robot_face:',
      text: message,
    }),
  };
} else {
  slack = {
    send: (message) => new Promise((resolve) => {
      console.error('slack was not init proprely', message);
      resolve();
    }),
  };
}
export default slack;
