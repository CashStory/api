import { Response } from 'express';
import { RequestAuth } from '../models/v1/Auth';
import { uploadFile, downloadFile } from '../services/upload';
import { IEmail } from '../models/v1/Email';
import BaseCtrl from './BaseCtrl';
import { sendMail, loadEmail } from '../services/email';

export default class FileCtrl extends BaseCtrl {
  Model = null;

  getModelName = () => 'fs';

  upload = (req: RequestAuth, res: Response): Promise<Response> => uploadFile()(req, res, (err) => {
    if (err) {
      return console.error('upload error', err);
    }
    if (req.file === undefined) {
      return console.error('error: no file selected!');
    }
    this.saveTransaction(req.auth, 'upload', {}, {}, { query: { filename: req.file.filename } });
    return res.json({ filename: req.file.filename });
  });

  getOne = (req: RequestAuth, res: Response) => {
    const selector = req.params.filename;
    this.saveTransaction(req.auth, 'getFile', {}, {}, { query: { filename: selector } });
    return downloadFile(selector, res);
  };

  notification = async (req: RequestAuth, res: Response): Promise<Response> => {
    if (req.body.email !== '') {
      let template = loadEmail('notification');
      template = template.split('%EMAIL%').join(req.body.email);
      template = template.split('%OBJECT%').join(req.body.object);
      template = template.split('%CONTENT%').join(req.body.content);
      template = template.split('%URLIMAGE%').join(req.body.image_url);
      template = template.split('%URLLINK%').join(req.body.link_url);
      const mailOptions: Partial<IEmail> = {
        from: process.env.EMAIL_FROM,
        to: req.body.email,
        subject: req.body.object,
        text: req.body.content,
        html: template,
      };
      try {
        this.saveTransaction(req.auth, 'sendNotif', {}, {}, { query: { body: req.body } });
        await sendMail(mailOptions);
        return res.json({ email: 'send' });
      } catch (err) {
        return res.status(500).send({ error: err });
      }
    }
    return res.status(500).send({ error: 'no email provided' });
  };

  send = async (req: RequestAuth, res: Response): Promise<Response> => {
    if (req.body.email !== '') {
      let template = loadEmail('contact-us');
      template = template.split('%EMAIL%').join(req.body.email);
      template = template.split('%OBJECT%').join(req.body.object);
      template = template.split('%CONTENT%').join(req.body.content);
      template = template.split('%FILENAME%').join(req.body.filename);
      const mailOptions: Partial<IEmail> = {
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_FROM,
        subject: 'Contact_Us',
        text: 'Contact_Us',
        html: template,
      };
      let templateConfirm = loadEmail('contact-confirm');
      templateConfirm = templateConfirm.split('%OBJECT%').join(req.body.object);
      templateConfirm = templateConfirm.split('%CONTENT%').join(req.body.content);
      templateConfirm = templateConfirm.split('%FILENAME%').join(req.body.filename);
      const mailOptionsClient: Partial<IEmail> = {
        from: process.env.EMAIL_FROM,
        to: req.body.email,
        subject: 'Mail send to Cashstory.com',
        text: 'Mail send to Cashstory.com',
        html: templateConfirm,
      };
      try {
        this.saveTransaction(req.auth, 'sendFile', {}, {}, { query: { body: req.body } });
        await sendMail(mailOptions);
        await sendMail(mailOptionsClient);
        return res.json({ email: 'send' });
      } catch (err) {
        return res.status(500).send({ error: err });
      }
    }
    return res.status(500).send({ error: 'no email provided' });
  };
}
