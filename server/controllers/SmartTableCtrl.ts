import { Response, NextFunction } from 'express';
import { connection } from 'mongoose';
import * as querystring from 'querystring';
import { generateUrlApi } from '../services/inject';
import { RequestAuth, ISmartTable } from '../models/v1/Auth';
import BaseCtrl from './BaseCtrl';
import {
  WorkspaceModel, IWorspace,
} from '../models/v1/Workspace';
import { IUser, UserModel } from '../models/v1/User';

const userMod = UserModel();
const workspaceMod = WorkspaceModel();

export default class SmartTableCtrl extends BaseCtrl {
  Model = null;

  getModelName = () => 'SmartTable';

  static checkRights(method, smartTable: ISmartTable): boolean {
    // console.log('rights', method, smartTable.rights);
    if ((!smartTable.rights && method === 'GET')
      || (smartTable.rights && smartTable.rights.indexOf(method) > -1)) {
      return true;
    }
    return false;
  }

  catchExistingModel = (req: RequestAuth, res: Response, next: NextFunction): void => {
    const exeptions = ['logs', 'emails'];

    const dbNameAbs = req.params.databaseId.split('-')[0];
    const dbMongoAbs = connection.db.databaseName.split('-')[0];
    // Protect DB like prod go to preprod or the reverse.
    if (dbMongoAbs === dbNameAbs) {
      req.params.databaseId = connection.db.databaseName;
    }
    if (connection.db.databaseName === req.params.databaseId
      && exeptions.indexOf(req.params.collectionId) === -1) {
      let url = `${generateUrlApi()}/${req.params.collectionId}`;
      if (req.path === '/count') {
        url += '/count';
      } else if (req.params.docId) {
        url += `/${req.params.docId}`;
      } else if (req.query.constructor === Object && Object.entries(req.query).length > 1) {
        url += `?${querystring.stringify(<querystring.ParsedUrlQueryInput>req.query)}`;
      }
      res.redirect(307, url);
      return;
    }
    next();
  };

  isAllowedQuery = async (req: RequestAuth, res: Response): Promise<Response> => {
    let user: IUser = await userMod.findOne({ _id: req.auth.user._id, tmpAccount: false });
    if (!user) {
      return res.status(200).json({ allowed: false });
    }
    user = user.toJSON();
    const workspaceIds = Object.keys(user.workspaces);
    if (req.auth.user.role === 'admin') {
      return res.status(200).json({ allowed: true });
    }
    const workspace: IWorspace = await workspaceMod.findOne({
      _id: { $in: workspaceIds },
      'sections.box.smartTable.database': req.params.databaseId,
      'sections.box.smartTable.collection': req.params.collectionId,
    });
    if (workspace) {
      return res.status(200).json({ allowed: true });
    }
    return res.status(200).json({ allowed: false });
  };

  isAllowed = async (req: RequestAuth, res: Response, next: NextFunction): Promise<void> => {
    let user: IUser = await userMod.findOne({ _id: req.auth.user._id, tmpAccount: false });
    if (!user) {
      return;
    }
    user = user.toJSON();
    const workspaceIds = Object.keys(user.workspaces);

    if (req.auth.user.role === 'admin') {
      next();
      return;
    } if (req.params.databaseId === 'api-news' && req.params.collectionId === 'news') {
      req.params.workspaceId = 'public';
      next();
      return;
    }
    const workspace: IWorspace = await workspaceMod.findOne({
      _id: { $in: workspaceIds },
      'sections.box.smartTable.database': req.params.databaseId,
      'sections.box.smartTable.collection': req.params.collectionId,
    });
    if (workspace) {
      req.params.workspaceId = String(workspace._id);
      next();
      return;
    }
    res.status(401).json({ error: 'invalid database, rights or collection' });
  };

  getOne = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const db = connection.useDb(req.params.databaseId);
      const collection = await db.collection(req.params.collectionId);
      const doc = await collection.findOne({ _id: req.params.docId });
      const context = {
        docId: req.params.docId,
        databaseId: req.params.databaseId,
        collectionId: req.params.collectionId,
        workspaceId: req.params.workspaceId,
      };
      this.saveTransaction(req.auth, 'getAll', {}, {}, context, collection.collectionName);
      return res.status(200).json(doc);
    } catch (error) {
      return res.status(400).json({ error });
    }
  };

  get = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      let count = 0;
      const query = this.validateQuery(req);
      const db = connection.useDb(req.params.databaseId);
      const collection = await db.collection(req.params.collectionId);
      const docs = await collection.find(query.page.search).limit(query.page.limit)
        .skip(query.page.skip).sort(query.sort)
        .toArray();
      if (query.search) {
        count = (await collection.countDocuments(query.search)) as unknown as number;
      } else {
        count = docs.length;
      }
      const context = {
        ...query,
        count,
        databaseId: req.params.databaseId,
        collectionId: req.params.collectionId,
        workspaceId: req.params.workspaceId,
      };
      context.page.search = null;
      this.saveTransaction(req.auth, 'getAll', {}, {}, context, collection.collectionName);
      return res.set('x-total-count', `${count}`).status(200).json(docs);
    } catch (error) {
      return res.status(400).json({ error });
    }
  };

  count = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const db = connection.useDb(req.params.databaseId);
      const collection = db.collection(req.params.collectionId);
      const doc = await collection.estimatedDocumentCount();
      const context = {
        databaseId: req.params.databaseId,
        collectionId: req.params.collectionId,
        workspaceId: req.params.workspaceId,
      };
      this.saveTransaction(req.auth, 'count', { count: doc }, {}, context, collection.collectionName);
      return res.status(200).json(doc);
    } catch (error) {
      return res.status(400).json({ error });
    }
  };

  insert = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const db = connection.useDb(req.params.databaseId);
      const collection = db.collection(req.params.collectionId);
      const newDocs = Array.isArray(req.body) ? req.body : [req.body];
      const doc = await collection.insertMany(newDocs);
      const context = {
        databaseId: req.params.databaseId,
        collectionId: req.params.collectionId,
        workspaceId: req.params.workspaceId,
      };
      this.saveTransaction(req.auth, 'insert', newDocs, {}, context, collection.collectionName);
      return res.status(200).json(doc);
    } catch (error) {
      return res.status(400).json({ error });
    }
  };

  unsetBadFields(updateData) {
    const updateFormated = { $set: {}, $unset: {} };
    Object.keys(updateData).forEach((key) => {
      if (!updateData[key] || (this.Model && !this.Model.schema.obj[key])) {
        updateFormated.$unset[key] = 1;
      } else {
        updateFormated.$set[key] = updateData[key];
      }
    });
    if (BaseCtrl.isEmpty(updateFormated.$unset)) {
      delete updateFormated.$unset;
    }
    return updateFormated;
  }

  update = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const db = connection.useDb(req.params.databaseId);
      const collection = db.collection(req.params.collectionId);
      const updateFilter = BaseCtrl.simpleValidation(req);
      const oldObj = await collection.findOne(updateFilter);
      delete req.body._id;
      const updateData = this.unsetBadFields(req.body);
      const doc = await collection.findOneAndUpdate(updateFilter, updateData,
        { returnOriginal: true });
      const context = {
        updateFilter,
        databaseId: req.params.databaseId,
        collectionId: req.params.collectionId,
        workspaceId: req.params.workspaceId,
      };
      this.saveTransaction(req.auth, 'update', oldObj, updateData, context, collection.collectionName);
      return res.status(200).json(doc);
    } catch (error) {
      return res.status(400).json({ error });
    }
  };

  delete = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const db = connection.useDb(req.params.databaseId);
      const collection = await db.collection(req.params.collectionId);
      const validatedQuery = BaseCtrl.simpleValidation(req);
      const oldDoc = await collection.findOne(validatedQuery);
      await collection.deleteOne(validatedQuery);
      const context = {
        validatedQuery,
        databaseId: req.params.databaseId,
        collectionId: req.params.collectionId,
        workspaceId: req.params.workspaceId,
      };
      this.saveTransaction(req.auth, 'delete', oldDoc, {}, context, collection.collectionName);
      return res.status(200).json(oldDoc);
    } catch (error) {
      return res.status(400).json({ error });
    }
  };

  deleteAll = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const db = connection.useDb(req.params.databaseId);
      await db.dropCollection(req.params.collectionId);
      const context = {
        databaseId: req.params.databaseId,
        collectionId: req.params.collectionId,
        workspaceId: req.params.workspaceId,
      };
      this.saveTransaction(req.auth, 'deleteAll', {}, {}, context, req.params.collectionId);
      return res.status(200).json({});
    } catch (error) {
      return res.status(400).json({ error });
    }
  };
}
