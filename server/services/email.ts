import { createTransport } from 'nodemailer';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EmailModel } from '../models/v1/Email';
import { generateUrl, generateUrlApi } from './inject';

dotenv.config({ path: '.env' });

const EmailMod = EmailModel();

let transporterNM;
if (process.env.EMAIL_HOST
  && process.env.EMAIL_PORT
  && process.env.EMAIL_USER
  && process.env.EMAIL_PASSWORD
) {
  // const nodemailerConfig: Transport = {
  //   host: process.env.EMAIL_HOST,
  //   port: process.env.EMAIL_PORT,
  //   name: 'dk_email',
  //   version: '1.0.0',
  //   secure: false,
  //   auth: {
  //     user: process.env.EMAIL_USER,
  //     pass: process.env.EMAIL_PASSWORD,
  //   },
  // };
  const configString = `${process.env.EMAIL_SECURE ? 'smtps' : 'smtp'}://${process.env.EMAIL_USER}:${process.env.EMAIL_PASSWORD}@${process.env.EMAIL_HOST}`;
  // if (process.env.EMAIL_SECURE) {
  //   nodemailerConfig.secure = (process.env.EMAIL_SECURE === 'true');
  // }
  transporterNM = createTransport(configString);
} else {
  transporterNM = {
    sendMail: (mailOptions, cb) => {
      console.error('email were not init proprely');
      if (cb) {
        cb(null, null);
      }
    },
  };
}

export const loadEmail = (name) => {
  try {
    const directoryPath = join(process.cwd(), '/emails');
    let template = readFileSync(`${directoryPath}/${name}.html`, 'utf8');
    template = template.split('%URLFRONT%').join(generateUrl());
    template = template.split('%URLAPI%').join(generateUrlApi());
    return template;
  } catch (e) {
    console.error('loadEmail Error:', e.stack);
    return null;
  }
};

export const sendMail = (mailOptions): Promise<any> => Promise.all([
  new EmailMod(mailOptions).save(),
  transporterNM.sendMail(mailOptions),
]);

export const sendTokenEmail = (email: string, token: string): Promise<any> => {
  let template = loadEmail('token');
  template = template.split('%TOKEN%').join(token);
  const mailOptions = {
    id_from: 'from first step pipe register',
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `CashStory token : ${token} - Email Verification`,
    text: `CashStory token : ${token} - Email Verification`,
    html: template,
  };
  return sendMail(mailOptions);
};
