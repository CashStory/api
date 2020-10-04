import { Response } from 'express';
import { Model } from 'mongoose';
import { ObjectID } from 'mongodb';
import { RequestAuth, Auth } from '../models/v1/Auth';
import { LogModel, ILog } from '../models/v1/Log';
import { redisCacheLifeTime, redisCacheCustomKeys } from '../services/inject';

const LogMod = LogModel();
const minLimit = 20;

export interface IQuery {
  sort: any;
  search: any;
  page: PageQuery;
}
export interface PageQuery {
  skip: number;
  limit: number;
  search: any;
  lastId: ObjectID;
  firstId: ObjectID;
}
export interface IQueryError {
  error: string | any;
}
abstract class BaseCtrl {
  abstract Model: Model<any>;

  getModelName = () => this.Model.collection.collectionName;

  cleanContext = (obj) => {
    const clean = {};
    const keys = Object.keys(obj);
    keys.forEach((key) => {
      const cleanKey = key.replace('$', '_');
      if (obj[cleanKey] && typeof (obj[cleanKey]) === 'object') {
        clean[cleanKey] = this.cleanContext(obj[key]);
      } else {
        clean[cleanKey] = obj[key];
      }
    });
    return clean;
  };

  saveTransaction = async (auth: Auth, action: string, prevData = {},
    newData = {}, context = {}, collectionName: string = null)
  : Promise<any> => {
    if (auth && auth.user && auth.user._id) {
      const newContext = this.cleanContext(context);
      const newLog: Partial<ILog> = {
        action,
        prevData,
        newData,
        context: newContext,
        collectionName: collectionName || this.getModelName(),
        creatorId: auth.user._id,
      };
      try {
        await new LogMod(newLog).save();
      } catch (err) {
        console.error('Error saveLog', err, JSON.stringify(newLog, null, 2));
      }
    }
    return Promise.resolve();
  };

  static validateQuerySort(req: RequestAuth): any {
    let sort: any = {};
    if (req.query.sort) {
      try {
        sort = JSON.parse(<string>req.query.sort);
      } catch (err) {
        throw new Error(`invalid sort ${err}`);
      }
    }
    return sort;
  }

  static simpleValidation(req: RequestAuth): any {
    return (req.params.docId) ? { _id: new ObjectID(req.params.docId) } : {};
  }

  validateQuerySearch(req: RequestAuth): any {
    let search: any = {};
    if (req.query.search) {
      try {
        search = JSON.parse(<string>req.query.search);
        if (search._id) {
          search._id = new ObjectID(search._id);
        }
      } catch (err) {
        throw new Error(`invalid search ${err}`);
      }
    }
    if (this.Model) {
      try {
        const keys = Object.keys(search);
        keys
          .forEach((element) => {
            if (!this.Model.schema.obj[element]) {
              throw new Error(`invalid search key ${element}`);
            }
          });
      } catch (err) {
        throw new Error(`invalid search key ${err}`);
      }
    }
    return search;
  }

  static validateQueryLimit(req: RequestAuth): number {
    let limit = minLimit;
    if (req.query.limit) {
      try {
        limit = Number(req.query.limit);
        limit = limit > 0 ? limit : minLimit;
      } catch (err) {
        throw new Error(`invalid limit ${err}`);
      }
    }
    return limit;
  }

  static validateQuerySkip(req: RequestAuth): number {
    let skip = 0;
    if (req.query.skip) {
      try {
        skip = Number(req.query.skip);
        skip = skip > 0 ? skip : 0;
      } catch (err) {
        throw new Error(`invalid skip ${err}`);
      }
    }
    return skip;
  }

  static validateQueryFirstId(req: RequestAuth): ObjectID {
    let firstId: ObjectID = null;
    if (req.query.lastId && !req.query.sort) {
      try {
        firstId = new ObjectID(<string>req.query.firstId);
      } catch (err) {
        throw new Error(`invalid firstId ${err}`);
      }
    }
    return firstId;
  }

  static validateQueryLastId(req: RequestAuth): ObjectID {
    let lastId: ObjectID = null;
    if (req.query.lastId && !req.query.sort) {
      try {
        lastId = new ObjectID(<string>req.query.lastId);
      } catch (err) {
        throw new Error(`invalid lastId ${err}`);
      }
    }
    return lastId;
  }

  static validateQueryPage(req: RequestAuth, search: any): PageQuery {
    const pageQuery: PageQuery = {
      search,
      limit: BaseCtrl.validateQueryLimit(req),
      skip: BaseCtrl.validateQuerySkip(req),
      lastId: BaseCtrl.validateQueryLastId(req),
      firstId: BaseCtrl.validateQueryFirstId(req),
    };
    if (pageQuery.skip > 0 && !req.query.sort && (pageQuery.lastId || pageQuery.firstId)) {
      pageQuery.skip = 0;
    }
    if (pageQuery.lastId) {
      pageQuery.search = Object.assign(search, { _id: { $gt: pageQuery.lastId } });
    } else if (pageQuery.firstId) {
      pageQuery.search = Object.assign(search, { _id: { $lt: pageQuery.firstId } });
    }
    return pageQuery;
  }

  validateQuery(req: RequestAuth): IQuery {
    return {
      sort: BaseCtrl.validateQuerySort(req),
      search: this.validateQuerySearch(req),
      page: BaseCtrl.validateQueryPage(req, this.validateQuerySearch(req)),
    };
  }

  static isEmpty(data) {
    const keys = Object.keys(data);
    return !keys.length;
  }

  unsetBadFields(updateData) {
    const toUpdate: any = { $set: {}, $unset: {} };
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === null || (this.Model && !this.Model.schema.obj[key])) {
        toUpdate.$unset[key] = '';
      } else {
        toUpdate.$set[key] = updateData[key];
      }
    });
    if (BaseCtrl.isEmpty(toUpdate.$unset)) {
      delete toUpdate.$unset;
    }
    return toUpdate;
  }

  // Get all
  getAll = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      let count = 0;
      const query = this.validateQuery(req);
      let customKey = `${req.url}_getAll`;
      const docs = await this.Model.find(query.page.search)
        .limit(query.page.limit)
        .skip(query.page.skip)
        .sort(query.sort)
        .cache(redisCacheLifeTime(), customKey);
      redisCacheCustomKeys.customKeys = { collectionName: this.getModelName(), key: customKey };
      if (query.search) {
        customKey = `${customKey}_count`;
        count = await this.Model.find(query.search)
          .cache(redisCacheLifeTime(), customKey)
          .countDocuments();
        redisCacheCustomKeys.customKeys = { collectionName: this.getModelName(), key: customKey };
      } else {
        count = docs.length;
      }
      const context = {
        ...query,
        count,
      };
      context.page.search = null;
      this.saveTransaction(req.auth, 'getAll', {}, {}, context);
      return res.set('x-total-count', `${count}`).status(200).json(docs);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  };

  // Count all
  count = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const customKey = `${this.getModelName()}_count`;
      const count = await this.Model.estimatedDocumentCount()
        .cache(redisCacheLifeTime(), customKey);
      redisCacheCustomKeys.customKeys = { collectionName: this.getModelName(), key: customKey };
      this.saveTransaction(req.auth, 'count', { count }, {}, {});
      return res.status(200).json(count);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  };

  // Insert
  insert = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      if (req.auth && req.auth.user) {
        req.body.creatorId = req.auth.user._id;
      }
      delete req.body._id;
      delete req.body.createdAt;
      delete req.body.updatedAt;
      const doc = await new this.Model(req.body).save();
      const jsonDoc = doc.toJSON();
      this.saveTransaction(req.auth, 'insert', jsonDoc, {}, {});
      return res.status(201).json(jsonDoc);
    } catch (err) {
      console.error('Error get', err, req.body);
      return res.status(400).json({ error: err.message });
    }
  };

  // Get by id
  get = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const customKey = `${this.getModelName()}_${req.params.id}_getbyid`;
      const doc = await this.Model.findOne({ _id: req.params.id }).cache(
        redisCacheLifeTime(), customKey,
      );
      redisCacheCustomKeys.customKeys = { collectionName: this.getModelName(), key: customKey };
      const jsonDoc = doc.toJSON();
      this.saveTransaction(req.auth, 'get', {}, {}, { query: { _id: req.params.id } });
      return res.status(200).json(jsonDoc);
    } catch (err) {
      console.error('Error get', err);
      return res.status(500).json({ error: err.message });
    }
  };

  // Update by id
  update = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const customKey = `${this.getModelName()}_${req.params.id}_getbyid`;
      const doc = await this.Model.findOne({ _id: req.params.id }).cache(
        redisCacheLifeTime(), customKey,
      );
      redisCacheCustomKeys.customKeys = { collectionName: this.getModelName(), key: customKey };
      const oldDoc = doc.toJSON();
      delete req.body.createdAt;
      delete req.body.updatedAt;
      const safeUpdate = this.unsetBadFields(req.body);
      const newVal = await this.Model.findOneAndUpdate(
        { _id: req.params.id }, safeUpdate, { new: true },
      );
      const newDoc = newVal.toJSON();
      this.saveTransaction(req.auth, 'update', oldDoc, newDoc, {});
      return res.status(200).json(newDoc);
    } catch (err) {
      console.error('Error update', err);
      return res.status(400).json({ error: err.message });
    }
  };

  // Delete by id
  delete = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      const customKey = `${this.getModelName()}_${req.params.id}_getbyid`;
      const doc = await this.Model.findOne({ _id: req.params.id }).cache(
        redisCacheLifeTime(), customKey,
      );
      redisCacheCustomKeys.customKeys = { collectionName: this.getModelName(), key: customKey };
      const oldDoc = doc.toJSON();
      this.saveTransaction(req.auth, 'delete', oldDoc, {}, { query: { _id: req.params.id } });
      await this.Model.deleteOne({ _id: req.params.id });
      return res.status(200).json(oldDoc);
    } catch (err) {
      console.error('Error delete', err);
      return res.status(400).json({ error: err.message });
    }
  };
}

export default BaseCtrl;
