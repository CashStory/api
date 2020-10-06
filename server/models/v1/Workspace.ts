import {
  Document, Schema, Model, model, set,
} from 'mongoose';
import { ObjectId } from 'mongodb';
import * as encrypt from 'mongoose-encryption';
import * as cachegoose from 'cachegoose';
import { ILogin, ISmartTable, loginSchema } from './Auth';
import { redisCacheCustomKeys } from '../../services/inject';

set('useCreateIndex', true);

export interface IBox extends Document {
  _id: ObjectId;
  name: string;
  color: string;
  backgroundColor: string;
  urlBg: string;
  iframe?: boolean;
  hideElements?: string[];
  login?: ILogin | string;
  smartTable?: ISmartTable;
  cors?: string;
  class?: string;
  injectCSS?: string;
  buttons?: {
    notebookUrl?: string;
    expandCollapse: boolean;
    openNewWindow: boolean;
    backTo: boolean;
  };
  zoom: number;
  authMethod?: string;
  url?: string;
  autoExpand?: boolean;
  position: number;
}

export interface IWp {
  id: string;
  name?: string;
  section?: number;
  box?: string;
  logo?: ILogo;
  bobVoice?: boolean;
}

const Box = new Schema(
  {
    iframe: Boolean,
    hideElements: [String],
    name: String,
    color: String,
    backgroundColor: String,
    urlBg: String,
    login: loginSchema,
    smartTable: Object,
    class: String,
    injectCSS: String,
    cors: String,
    buttons: {
      notebookUrl: String,
      expandCollapse: Boolean,
      openNewWindow: Boolean,
      backTo: Boolean,
    },
    zoom: Number,
    authMethod: String,
    url: String,
    autoExpand: Boolean,
    position: Number,
  },
);

export interface IMenu extends Document {
  title: string;
  icon: string;
  sectionId: number;
}

const Menu = new Schema(
  {
    title: String,
    icon: String,
    sectionId: Number,
  },
  { _id: false },
);

export interface ILogo extends Document {
  url: string;
  name: string;
}

export const Logo = new Schema(
  {
    url: String,
    name: String,
  },
  { _id: false },
);

export interface ISection extends Document {
  id: number;
  title: string;
  description: string;
  box: [IBox];
}

const Section = new Schema(
  {
    id: Number,
    title: String,
    description: String,
    box: [Box],
  },
  { _id: false },
);

export interface IWorspace extends Document {
  _id: ObjectId;
  name: string;
  creatorId: ObjectId;
  logo: ILogo;
  bobVoice?: boolean;
  linkShared: Boolean;
  menu: IMenu[];
  shared_users: IShared[];
  sections: ISection[];
}

export interface IShared extends Document {
  email: string;
  role: string;
}

const Shared = new Schema(
  {
    email: String,
    role: String,
  },
  { _id: false },
);

export const workspaceSchema = new Schema(
  {
    _id: {
      type: ObjectId,
      auto: true,
    },
    name: String,
    creatorId: ObjectId,
    logo: Logo,
    bobVoice: Boolean,
    linkShared: Boolean,
    menu: [Menu],
    shared_users: [Shared],
    sections: [Section],
  },
  { timestamps: true },
);

workspaceSchema.plugin(encrypt.encryptedChildren);

workspaceSchema.set('toJSON', {
  transform(doc, ret) {
    // eslint-disable-next-line no-param-reassign
    delete ret.__v;
    return ret;
  },
});

export const clearRedisCache = () => {
  if (typeof cachegoose.clearCache === 'function') {
    redisCacheCustomKeys.workspaceKeys.forEach((key) => {
      cachegoose.clearCache(key, null);
    });
    redisCacheCustomKeys.clearKeys = 'workspaces';
  }
};

workspaceSchema.post('save', (doc: IWorspace, next) => {
  clearRedisCache();
  next();
});

workspaceSchema.post('update', (doc: IWorspace, next) => {
  clearRedisCache();
  next();
});

workspaceSchema.post('findOneAndUpdate', (doc: IWorspace, next) => {
  clearRedisCache();
  next();
});

workspaceSchema.post('deleteOne', (doc: IWorspace, next) => {
  clearRedisCache();
  next();
});

workspaceSchema.post('updateOne', (doc: IWorspace, next) => {
  clearRedisCache();
  next();
});

export const WorkspaceModel = (): Model<IWorspace> => model<IWorspace>('workspace', workspaceSchema);
