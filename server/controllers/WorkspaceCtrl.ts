import { Response } from 'express';
import { IUser, IWorspaceList, UserModel } from '../models/v1/User';
import BaseCtrl from './BaseCtrl';
import { WorkspaceModel } from '../models/v1/Workspace';
import { RequestAuth } from '../models/v1/Auth';
import { redisCacheLifeTime, redisCacheCustomKeys } from '../services/inject';
import { sendMail, loadEmail } from '../services/email';

const userMod = UserModel();
export default class WorkspaceCtrl extends BaseCtrl {
  Model = WorkspaceModel();

  isAllowed = async (req, res, next) => {
    try {
      let user: IUser = await userMod.findOne({ _id: req.auth.user._id, tmpAccount: false });
      user = user.toJSON();
      const workspaceIds = Object.keys(user.workspaces);
      if (workspaceIds.indexOf(req.params.id) > -1 && req.auth.user.role === 'admin') {
        next();
      }
      return res.status(401).json({ error: 'invalid user' });
    } catch (err) {
      return res.status(401).json({ error: 'could not find user' });
    }
  };

  /*
  * Add a new Box to the existing section
  * @prop position Adds the sorting index which it should be ordered at UI when a new box is added
  */

  addNewBoxToExistingSection = async (req: RequestAuth, res: Response): Promise<Response> => {
    if (!req.body || !req.body.name) {
      return res.status(400).json({ error: 'Box name is missing in request the body' });
    }
    try {
      const customKey = `${req.params.workspaceId}_getWorkspace`;
      const oldVal = await this.Model.findOne({ _id: req.params.workspaceId }).cache(
        redisCacheLifeTime(), customKey,
      );
      redisCacheCustomKeys.customKeys = { collectionName: 'workspaces', key: customKey };

      const boxes = oldVal.sections.find((section) => section.id === Number(req.params.sectionId));
      // eslint-disable-next-line arrow-body-style
      const boxesWithPosition = boxes.box.map((elem, index) => {
        return { ...elem, position: elem.position ? elem.position : index };
      });
      const maxPosition = Math.max(...boxesWithPosition.map((o) => o.position), 0);
      req.body.position = maxPosition ? maxPosition + 1 : boxes.box.length;

      const oldValJson = oldVal.toJSON();
      const newVal = await this.Model.findOneAndUpdate(
        { _id: req.params.workspaceId, sections: { $elemMatch: { id: req.params.sectionId } } },
        { $push: { 'sections.$.box': req.body } }, { upsert: false, new: true },
      );
      const newValJson = newVal.toJSON();
      this.saveTransaction(req.auth, 'update', oldValJson, newValJson, {});
      return res.status(200).json(newVal);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  };

  /*
  * Delete Box from existing section
  */
  deleteBoxFromSection = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const customKey = `${req.params.workspaceId}_getWorkspace`;
      const oldVal = await this.Model.findOne({ _id: req.params.workspaceId }).cache(
        redisCacheLifeTime(), customKey,
      );
      redisCacheCustomKeys.customKeys = { collectionName: 'workspaces', key: customKey };
      const oldValJson = oldVal.toJSON();
      const newVal = await this.Model.findOneAndUpdate(
        { _id: req.params.workspaceId, sections: { $elemMatch: { id: req.params.sectionId } } },
        { $pull: { 'sections.$.box': { _id: req.params.boxId } } }, { upsert: false, new: true },
      );
      const newValJson = newVal.toJSON();
      this.saveTransaction(req.auth, 'update', oldValJson, newValJson, {});
      return res.status(200).json(newVal);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  };

  /*
  * update existing box details
  */
  updateExistingBox = async (req: RequestAuth, res: Response): Promise<Response> => {
    if (!req.body || !req.body.name) {
      return res.status(400).json({ error: 'Box name is missing in request the body' });
    }
    try {
      const customKey = `${req.params.workspaceId}_getWorkspace`;
      const oldVal = await this.Model.findOne({ _id: req.params.workspaceId }).cache(
        redisCacheLifeTime(), customKey,
      );
      redisCacheCustomKeys.customKeys = { collectionName: 'workspaces', key: customKey };
      const oldValJson = oldVal.toJSON();
      await this.Model.updateOne(
        {
          _id: req.params.workspaceId,
          sections: { $elemMatch: { id: req.params.sectionId } },
          'sections.box': { $elemMatch: { _id: req.params.boxId } },
        },
        { $set: { 'sections.$[outer].box.$[inner]': req.body } },
        {
          arrayFilters: [{ 'outer.id': req.params.sectionId }, { 'inner._id': req.params.boxId }],
          upsert: false,
        },
      );
      const newVal = await this.Model.findOne({ _id: req.params.workspaceId });
      const newValJson = newVal.toJSON();
      this.saveTransaction(req.auth, 'update', oldValJson, newValJson, {});
      return res.status(200).json(newVal);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  };

  /*
  * update existing boxes with sorting indexes
  */
  updateExistingBoxPositions = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const customKey = `${req.params.workspaceId}_getWorkspace`;
      const oldVal = await this.Model.findOne({ _id: req.params.workspaceId }).cache(
        redisCacheLifeTime(), customKey,
      );
      redisCacheCustomKeys.customKeys = { collectionName: 'workspaces', key: customKey };
      const oldValJson = oldVal.toJSON();

      const promises = [];
      req.body.forEach((el) => {
        promises.push(this.Model.updateOne(
          {
            _id: req.params.workspaceId,
            sections: { $elemMatch: { id: req.params.sectionId } },
            'sections.box': { $elemMatch: { _id: el.id } },
          },
          { $set: { 'sections.$[outer].box.$[inner].position': el.position } },
          {
            arrayFilters: [{ 'outer.id': req.params.sectionId }, { 'inner._id': el.id }],
            upsert: false,
          },
        ));
      });
      await Promise.all(promises);
      const newVal = await this.Model.findOne({ _id: req.params.workspaceId });
      const newValJson = newVal.toJSON();
      this.saveTransaction(req.auth, 'updateboxpositions', oldValJson, newValJson, {});
      return res.status(200).json(newVal);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  };

  // workspace sharing APIs
  getShare = async (req: RequestAuth, res: Response): Promise<Response> => {
    const shareVal = await this.Model.findOne({ _id: req.params.id, creatorId: req.auth.user._id });
    return res.status(200).json(shareVal);
  };

  getTemplates = async (req: RequestAuth, res: Response): Promise<Response> => {
    const templates = await this.Model.aggregate([
      { $match: { is_template:true } },
      { $project: { "sections.box.login" : 0} }
    ]);
    return res.status(200).json(templates);
  };

  sendInvite = async (emailId, ws) => {
    let template = loadEmail('workspace-invite');
    template = template.split('%SHARED_WS%').join(`${ws.name}`);
    const mailOptions = {
      id_from: ws.creatorId,
      from: process.env.EMAIL_FROM,
      to: emailId,
      subject: 'Workspace Shared - Join CashStory to access',
      text: 'Workspace Shared - Join CashStory to access',
      html: template,
    };
    await sendMail(mailOptions);
    return true;
  };

  addShare = async (req: RequestAuth, res: Response): Promise<Response> => {
    const wp = {
      name: 'My Workspace',
      news: {
        name: 'News',
        lang: 'en',
      },
      favorites: {
        name: 'Favorites',
        boxes: [],
      },
    };
    const oldVal = await this.Model.findOne({
      _id: req.params.id, creatorId: req.auth.user._id,
    });
    const oldValJson = oldVal.toJSON();
    if (!(oldVal.shared_users.some((someEl) => someEl.email === req.body.email))) {
      const userDoc: IUser = await userMod.findOne({ email: req.body.email, tmpAccount: false });
      if (userDoc) {
        const ipWs: IWorspaceList = { [`${req.params.id}`]: { ...wp, ...oldVal } };
        userDoc.workspaces = ipWs;
        await userDoc.save();
      } else {
        await this.sendInvite(req.body.email, oldVal);
      }
      oldVal.shared_users.push(req.body);
    } else {
      Object.keys(oldVal.shared_users).forEach(async (key) => {
        if (oldVal.shared_users[key].email === req.body.email) {
          oldVal.shared_users[key].role = req.body.role;
        }
      });
    }
    await oldVal.save();
    const newValJson = oldVal.toJSON();
    this.saveTransaction(req.auth, 'addShare', oldValJson, newValJson, {});
    return res.status(200).json(oldVal);
  };

  toggleLink = async (req: RequestAuth, res: Response): Promise<Response> => {
    const oldVal = await this.Model.findOne({
      _id: req.params.id, creatorId: req.auth.user._id,
    });
    if (!oldVal.linkShared) {
      oldVal.linkShared = true;
    } else {
      oldVal.linkShared = false;
    }
    oldVal.save();
    return res.status(200).json(oldVal);
  };

  deleteShare = async (req: RequestAuth, res: Response): Promise<Response> => {
    let oldVal = await this.Model.findOne({
      _id: req.params.id, creatorId: req.auth.user._id,
    });
    const oldValJson = oldVal.toJSON();
    const userVal = await userMod.findOne({ email: req.params.email });
    if (userVal) {
      const workspaces = userVal.workspaces as any as Map<Object, IWorspaceList>;
      workspaces.forEach(async (ws, key) => {
        if (key === req.params.id) {
          workspaces.delete(key);
          userVal.workspaces = workspaces as any as IWorspaceList;
        }
      });
      userVal.save();
    }
    await oldVal.updateOne({
      $pull: {
        shared_users: { email: req.params.email },
      },
    });
    oldVal = await this.Model.findOne({
      _id: req.params.id, creatorId: req.auth.user._id,
    });
    const newValJson = oldVal.toJSON();
    this.saveTransaction(req.auth, 'deleteShare', oldValJson, newValJson, {});
    return res.status(200).json(newValJson);
  };

  requestAccess = async (req: RequestAuth, res: Response): Promise<Response> => {
    const userData = await userMod.findOne({ _id: req.auth.user._id });
    const wsData = await this.Model.findOne({ _id: req.body.id });
    const ownerData = await userMod.findOne({ _id: wsData.creatorId });
    let template = loadEmail('request-access');
    template = template.split('%REQUESTED_EMAIL%').join(`${userData.email}`);
    template = template.split('%WORKSPACE_NAME%').join(`${wsData.name}`);
    template = template.split('%WORKSPACE_ID%').join(`${wsData.id}`);
    const mailOptions = {
      id_from: req.auth.user._id,
      from: process.env.EMAIL_FROM,
      to: ownerData.email,
      subject: 'Request to share workspace',
      text: 'Request to share workspace',
      html: template,
    };
    await sendMail(mailOptions);
    return res.status(200).json({ status: 'success' });
  };
}
