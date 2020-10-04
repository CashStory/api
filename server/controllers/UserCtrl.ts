import { Response } from 'express';
import { Types } from 'mongoose';
import { IWp, WorkspaceModel } from '../models/v1/Workspace';
import {
  IFavorite, IWorspaceConfig, IUser, UserModel, IWorspaceList,
} from '../models/v1/User';
import BaseCtrl from './BaseCtrl';

import { sendMail, sendTokenEmail, loadEmail } from '../services/email';
import { RequestAuth } from '../models/v1/Auth';
import { loadAllAuth } from '../services/auth';
import { redisCacheLifeTime } from '../services/inject';

export default class UserController extends BaseCtrl {
  Model = UserModel();

  WpModel = WorkspaceModel();

  constructor() {
    super();
    loadAllAuth(this.saveTransaction, this.Model, this.createUser);
  }

  createTmp = async (req: RequestAuth, res: Response): Promise<Response> => {
    if (!req.body.email) {
      return res.status(400).json({ error: 'email missing' });
    }
    try {
      let doc: IUser = await this.Model.findOne({ email: req.body.email });
      if (!doc) {
        doc = await new this.Model({ email: req.body.email, tmpAccount: true }).save();
      } else {
        doc.tmpToken = `${Math.floor(Math.random() * (999999 - 100000)) + 100000}`;
        doc.save();
      }
      if (doc.tmpAccount) {
        await sendTokenEmail(req.body.email, doc.tmpToken);
        const newValJson = doc.toJSON();
        if (newValJson.services) {
          delete newValJson.services;
        }
        return res.status(201).json(newValJson);
      }
      return res.status(400).json({ error: 'user already exist' });
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  };

  updateTmp = async (req: RequestAuth, res: Response): Promise<Response> => {
    if (!req.body.email) {
      return res.status(400).json({ error: 'email missing' });
    }
    if (req.body.fullName && req.body.fullName.indexOf(' ') > -1
      && !req.body.lastName && !req.body.firstName) {
      const fullNameList = req.body.fullName.split(' ');
      req.body.firstName = fullNameList.shift();
      req.body.lastName = fullNameList.join('');
    }
    const userUpdate: Partial<IUser> = {
      email: req.body.email,
      phoneNumber: req.body.phoneNumber,
      password: req.body.password,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
    };
    const userUpdateQuery = this.unsetBadFields(userUpdate);
    try {
      const doc: IUser = await this.Model.findOne({ email: req.body.email, tmpAccount: true });
      if (!doc) {
        return res.status(400).json({ error: 'user doesnt exist' });
      }
      Object.keys(userUpdateQuery.$set).forEach((key) => {
        if (userUpdateQuery.$set[key]) {
          doc[key] = userUpdateQuery.$set[key];
        }
      });
      doc.save();
      return res.status(200).json(doc);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  };

  upgradeTmp = async (req: RequestAuth, res: Response): Promise<Response> => {
    if (!req.body.email || !req.body.token) {
      return res.status(400).json({ error: 'email or token missing' });
    }
    try {
      const doc: IUser = await this.Model
        .findOne({ email: req.body.email, tmpAccount: true, tmpToken: req.body.token });
      if (doc) {
        doc.creatorId = doc._id;
        doc.tmpAccount = false;
        doc.save();
        const jsonDoc = doc.toJSON();
        await this.sendRegisterEmail(jsonDoc);
        this.saveTransaction({ user: { _id: doc._id, role: doc.toObject().role } }, 'create', jsonDoc, {}, {});
        return res.status(200).json(jsonDoc);
      }
      return res.status(400).json({ error: 'wrong token or email' });
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  };

  sendRegisterEmail = async (doc: IUser) => {
    try {
      let template = loadEmail('register');
      template = template.split('%FIRSTNAME%').join(doc.firstName);
      if (doc.lastName) {
        template = template.split('%LASTNAME%').join(doc.lastName);
      } else {
        template = template.split('%LASTNAME%').join('');
      }
      const mailOptionsUser = {
        id_from: doc._id,
        from: process.env.EMAIL_FROM,
        to: doc.email,
        subject: 'Successfully register to CashStory',
        text: 'Successfully register to CashStory',
        html: template,
      };
      let templateUs = loadEmail('register-us');
      templateUs = templateUs.split('%EMAIL%').join(doc.email);
      templateUs = templateUs.split('%FIRSTNAME%').join(doc.firstName);
      if (doc.company) {
        templateUs = templateUs.split('%COMPANYNAME%').join(doc.company.name);
      } else {
        templateUs = templateUs.split('%COMPANYNAME%').join('');
      }
      templateUs = templateUs.split('%ROLE%').join(doc.userRole);
      templateUs = templateUs.split('%MANAGER%').join(doc.manager);
      templateUs = templateUs.split('%MOBILE%').join(doc.phoneNumber);
      const mailOptionsAdmin = {
        id_from: doc._id,
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_ADMIN,
        subject: `New User: ${doc.email}`,
        text: 'New User',
        html: templateUs,
      };
      return Promise.all([
        sendMail(mailOptionsUser),
        sendMail(mailOptionsAdmin),
      ]);
    } catch (err) {
      console.error('email error', err);
      return Promise.resolve();
    }
  };

  getMe = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const doc: IUser = await this.Model.findOne({ _id: req.auth.user._id, tmpAccount: false })
        .cache(redisCacheLifeTime(), `${req.auth.user._id}_getme`);
      const jsonObj = doc.toJSON();
      this.saveTransaction(req.auth, 'getMe', jsonObj, {}, {});
      return res.status(200).json(jsonObj);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  };

  deleteMe = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const doc: IUser = await this.Model.findOne({ _id: req.auth.user._id, tmpAccount: false })
        .cache(redisCacheLifeTime(), `${req.auth.user._id}_getme`);
      const oldDoc = doc.toJSON();
      this.saveTransaction(req.auth, 'deleteMe', oldDoc, {}, {});
      await this.Model.deleteOne({ _id: req.auth.user._id });
      return res.status(200).json(oldDoc);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  };

  addEvent = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const prev: any = req.params.prev ? JSON.parse(req.params.prev) : req.body.prev;
      const next: any = req.params.next ? JSON.parse(req.params.next) : req.body.next;
      const metadata: any = req.params.meta ? JSON.parse(req.params.meta) : req.body.meta;
      this.saveTransaction(req.auth, 'event', prev, next, metadata, 'event');
      return res.status(200).json(next);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  };

  updateCurrentWp = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const workspaceCurrent: IWp = req.body;
      const updatedUser = this.unsetBadFields({ workspaceCurrent });
      const oldVal = await this.Model.findOne({ _id: req.auth.user._id, tmpAccount: false })
        .cache(redisCacheLifeTime(), `${req.auth.user._id}_getme`);
      const oldValJson = oldVal.toJSON();
      const newVal = await this.Model.findOneAndUpdate(
        { _id: req.auth.user._id, tmpAccount: false }, updatedUser, { new: true },
      );
      const newValJson = newVal.toJSON();
      this.saveTransaction(req.auth, 'updateCurrentWp', oldValJson, newValJson, {});
      return res.status(200).json(newVal);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  };

  addFavorite = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const favorite: IFavorite = req.body;
      const workspaceId: string = favorite.wp.id;
      const doc: IUser = await this.Model.findOne({ _id: req.auth.user._id, tmpAccount: false })
        .cache(redisCacheLifeTime(), `${req.auth.user._id}_getme`);
      const oldObj = doc.toJSON();
      const workspaces = doc.workspaces as any as Map<string, IWorspaceConfig>;
      const workspace = workspaces.get(workspaceId);
      workspace.favorites.boxes.push(favorite);
      doc.save();
      const newObj = doc.toJSON();
      this.saveTransaction(req.auth, 'addFav', oldObj, newObj, {
        query: { _id: req.auth.user._id, tmpAccount: false },
      });
      return res.status(200).json(newObj);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  };

  delFavorite = async (req: RequestAuth, res: Response): Promise<Response> => {
    const favorite: IFavorite = req.body;
    const workspaceId: string = favorite.wp.id;
    try {
      const doc: IUser = await this.Model.findOne({ _id: req.auth.user._id, tmpAccount: false })
        .cache(redisCacheLifeTime(), `${req.auth.user._id}_getme`);
      const oldObj = doc.toJSON();
      const workspaces = doc.workspaces as any as Map<string, IWorspaceConfig>;
      const workspace = workspaces.get(workspaceId);
      const favoritesBox = workspace.favorites.boxes as Types.Array<IFavorite>;
      favoritesBox.remove(favorite._id);
      doc.save();
      const newObj = doc.toJSON();
      this.saveTransaction(req.auth, 'deleteFav', oldObj, newObj, {
        query: { _id: req.auth.user._id, tmpAccount: false },
      });
      return res.status(200).json(newObj);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  };

  updateMe = async (req: RequestAuth, res: Response): Promise<Response> => {
    const userUpdate: Partial<IUser> = {
      email: req.body.email,
      picture: req.body.picture,
      phoneNumber: req.body.phoneNumber,
      password: req.body.password,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      company: req.body.company,
      userRole: req.body.userRole,
      manager: req.body.manager,
    };
    const userUpdateQuery = this.unsetBadFields(userUpdate);
    try {
      const doc: IUser = await this.Model.findOne({ _id: req.auth.user._id, tmpAccount: false })
        .cache(redisCacheLifeTime(), `${req.auth.user._id}_getme`);
      const oldObj = doc.toJSON();
      Object.keys(userUpdateQuery.$set).forEach((key) => {
        if (userUpdateQuery.$set[key]) {
          doc[key] = userUpdateQuery.$set[key];
        }
      });
      doc.save();
      const newObj = doc.toJSON();
      this.saveTransaction(req.auth, 'updateMe', oldObj, newObj, {
        query: { _id: req.auth.user._id, tmpAccount: false },
      });
      return res.status(200).json(newObj);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  };

  updateMyPasswd = async (req: RequestAuth, res: Response): Promise<Response> => {
    const passedObj = req.body.passwordObj;
    try {
      const doc: IUser = await this.Model.findOne({ _id: req.auth.user._id, tmpAccount: false });
      const isCorrectPassword = await doc.comparePassword(passedObj.currentPassword);
      if (!isCorrectPassword) {
        const error = 'Invalid Current Password';
        res.status(404).json({ error });
        return Promise.reject(error);
      }
      doc.password = passedObj.newPassword;
      const oldObj = doc.toJSON();
      doc.save();
      const newObj = doc.toJSON();
      this.saveTransaction(req.auth, 'updateMe', oldObj, newObj, {
        query: { _id: req.auth.user._id, tmpAccount: false },
      });
      return res.status(200).json(newObj);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
      return Promise.reject(err);
    }
  };

  resetpwd = async (req: RequestAuth, res: Response): Promise<Response> => {
    if (!req.body.email) {
      return res.status(500).send({ error: 'no email' });
    }
    const password = Math.random().toString(36).substring(2, 15)
      + Math.random().toString(36).substring(2, 15);
    let template = loadEmail('reset-pwd');
    template = template.split('%PASSWORD%').join(password);
    const mailOptions = {
      id_from: 'Reset pwd page',
      from: process.env.EMAIL_FROM,
      to: req.body.email,
      subject: 'Reset Password',
      text: 'Reset Password',
      html: template,
    };
    try {
      const doc: IUser = await this.Model.findOne({ email: req.body.email, tmpAccount: false });
      doc.password = password;
      doc.reset = true;
      doc.save();
      await sendMail(mailOptions);
      this.saveTransaction(req.auth, 'resetPwd', {}, {}, {});
      return res.json({ email: 'send' });
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  };

  createUser = async (profile, registerSource): Promise<any> => {
    const userNew: Partial<IUser> = {
      email: profile.nameID,
      firstName: (profile.firstname) ? profile.firstname : '',
      lastName: (profile.lastname) ? profile.lastname : '',
      registerReferer: registerSource,
    };
    if (profile.profilePic) {
      userNew.picture = profile.profilePic;
    }
    try {
      const obj: IUser = await new this.Model(userNew).save();
      await this.sendRegisterEmail(obj);
      return Promise.resolve(obj);
    } catch (err) {
      console.error(err);
      return Promise.reject(err);
    }
  };

  duplicateWS = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const ipWs: IWorspaceList = req.body;
      const oldId = Object.keys(req.body)[0];
      const doc: IUser = await this.Model.findOne({ _id: req.auth.user._id, tmpAccount: false });
      const wpdoc = await this.WpModel.findOne({ _id: oldId }, { _id: 0 });
      wpdoc.name = ipWs[`${oldId}`].name;
      wpdoc.creatorId = doc._id;
      const userWpDoc = await this.WpModel.updateOne(wpdoc, { }, { upsert: true, new: true });
      const oldObj = doc.toJSON();
      doc.workspaces = { [`${userWpDoc.upserted[0]._id}`]: ipWs[oldId] };
      doc.save();
      const newObj = doc.toJSON();
      this.saveTransaction(req.auth, 'duplicateWS', oldObj, newObj, {
        query: { _id: req.auth.user._id, tmpAccount: false },
      });
      return res.status(200).json(newObj);
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: err.message });
    }
  };
}
