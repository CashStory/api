import { Response } from 'express';
import { IUser, UserModel } from '../models/v1/User';
import BaseCtrl from './BaseCtrl';
import { WorkspaceModel } from '../models/v1/Workspace';
import { RequestAuth } from '../models/v1/Auth';
import { redisCacheLifeTime, redisCacheCustomKeys } from '../services/inject';

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
}
