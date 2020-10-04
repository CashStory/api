import {
  Document, Schema, Model, model, Query,
} from 'mongoose';
import { ObjectId } from 'mongodb';
import * as encrypt from 'mongoose-encryption';
import * as cachegoose from 'cachegoose';
import { IWp } from './Workspace';
import { ILogin, loginSchema } from './Auth';
import { encodePass, isPassMatch, createApiKey } from '../../services/crypto';
import { redisCacheCustomKeys } from '../../services/inject';

interface ICompany {
  name: string;
  size: string;
  whatUse: string;
  kind: string;
}

const companySchema: Schema<ICompany> = new Schema(
  {
    name: {
      type: String,
      default: '',
    },
    size: {
      type: String,
      default: '',
    },
    whatUse: {
      type: String,
      default: '',
    },
    kind: {
      type: String,
      default: '',
    },
  },
  { _id: false },
);

export interface IFavorite {
  _id?: ObjectId;
  name: string;
  description: string;
  attachement?: string;
  attachement_type?: 'image' | 'video' | 'iframe';
  target?: string;
  wp?: IWp;
  target_type?: 'internal' | 'external' | 'external_same';
  column: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
}

const worspaceCurrentSchema: Schema<IWp> = new Schema(
  {
    id: ObjectId,
    section: Number,
    box: ObjectId,
  },
  { _id: false },
);

export interface IWorspaceConfig {
  name: string;
  news:
  {
    name: string;
    lang?: string;
    class?: string;
    sources?: string[];
    categories?: string[];
  };
  favorites:
  {
    name: string;
    class?: string;
    boxes?: IFavorite[];
  };
}
export interface IWorspaceList {
  [id: string]: IWorspaceConfig;
}
export interface IWallet {
  publicKey: string;
  privateKey: string;
}

const favBoxSchema: Schema<IFavorite> = new Schema(
  {
    name: String,
    description: String,
    attachement: String,
    attachement_type: String,
    target: String,
    link: String,
    wp: worspaceCurrentSchema,
    target_type: String,
    column: {
      type: Number,
      min: [1, 'Too few column'],
      max: [12, 'Too many column'],
    },
  },
);

const worspaceSchema: Schema<IWorspaceConfig> = new Schema(
  {
    name: String,
    news:
    {
      name: String,
      class: String,
      lang: String,
      sources: [String],
      categories: [String],
    },
    favorites:
    {
      name: String,
      class: String,
      boxes: [favBoxSchema],
    },
  },
  { _id: false },
);

export interface IService {
  authMethod: string;
  login: ILogin;
}
interface IServiceList {
  [name: string]: IService;
}
// serviceSchema
const serviceSchema: Schema<IService> = new Schema(
  {
    authMethod: String,
    login: loginSchema,
  },
  { _id: false },
);
serviceSchema.plugin(encrypt.encryptedChildren);

export interface IUser extends Document {
  _id: ObjectId;
  creatorId: ObjectId;
  tmpAccount: boolean;
  tmpToken: string;
  email: string;
  picture: string;
  phoneNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  company: ICompany;
  role: string;
  manager: string;
  userRole: string;
  reset: boolean;
  workspaceCurrent: IWp;
  workspaces: IWorspaceList;
  services: IServiceList;
  registerReferer: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  compareApiKey(candidatePassword: string): Promise<boolean>;
}

export const userSchema: Schema<IUser> = new Schema(
  {
    _id: {
      type: ObjectId,
      auto: true,
    },
    creatorId: ObjectId,
    tmpAccount: {
      type: Boolean,
      default: false,
    },
    tmpToken: {
      type: String,
      default: `${Math.floor(Math.random() * (999999 - 100000)) + 100000}`,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    picture: {
      type: String,
      default: '',
    },
    phoneNumber: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      bcrypt: true,
      default: encodePass('welcomebob'),
    },
    firstName: {
      type: String,
      default: 'demo',
    },
    lastName: {
      type: String,
      default: 'cashstory',
    },
    company: {
      type: companySchema,
      default: () => ({}),
    },
    role: {
      type: String,
      default: 'user',
    },
    manager: {
      type: String,
      default: '',
    },
    userRole: {
      type: String,
      default: '',
    },
    reset: {
      type: Boolean,
      default: false,
    },
    workspaceCurrent: {
      type: worspaceCurrentSchema,
      default: () => {
        const wp = {
          id: '5eaa9b7c87e99ef2430a270a',
          section: 0,
          box: null,
        };
        if (process.env.WORKSPACEDEFAULT) {
          wp.id = process.env.WORKSPACEDEFAULT;
        }
        return wp;
      },
    },
    workspaces: {
      type: Map,
      of: worspaceSchema,
      default: () => {
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
        const wps = {};
        if (process.env.WORKSPACEDEFAULT) {
          wps[process.env.WORKSPACEDEFAULT] = wp;
        } else {
          wps['5eaa9b7c87e99ef2430a270a'] = wp;
        }
        return wps;
      },
    },
    services: {
      type: Map,
      of: serviceSchema,
      default: {
        dkApi: {
          authMethod: 'dkApi',
          login: {
            username: 'API',
            password: createApiKey(),
          },
        },
      },
    },
  },
  { timestamps: true },
);

userSchema.plugin(encrypt.encryptedChildren);

// Before saving the user, hash the password
// FUNCTION KEYWORD ARE NECESSARY
// eslint-disable-next-line func-names
userSchema.pre<IUser>('save', function (next) {
  if (this.password && this.password.length > 0 && this.isModified('password')) {
    try {
      this.password = encodePass(this.password);
    } catch (err) {
      return next(err);
    }
  }
  return next();
});

// FUNCTION KEYWORD ARE NECESSARY
// eslint-disable-next-line func-names
userSchema.pre<Query<IUser>>('update', function (next) {
  const update: IUser = this.getUpdate();
  if (update.password && update.password.length > 0) {
    update.password = encodePass(update.password);
  }
  return next();
});

// FUNCTION KEYWORD ARE NECESSARY
// eslint-disable-next-line func-names
userSchema.pre<Query<IUser>>('findOneAndUpdate', function (next) {
  const update: IUser = this.getUpdate().$set;
  if (update.password && update.password.length > 0) {
    update.password = encodePass(update.password);
  }
  return next();
});

const clearRedisCache = (doc: any) => {
  if (typeof cachegoose.clearCache === 'function') {
    cachegoose.clearCache(`${doc._id}_getme`, null);
    redisCacheCustomKeys.userKeys.forEach((key) => {
      cachegoose.clearCache(key, null);
    });
    redisCacheCustomKeys.clearKeys = 'users';
  }
};

userSchema.post('save', (doc: IUser, next) => {
  clearRedisCache(doc);
  next();
});

userSchema.post('update', (doc: IUser, next) => {
  clearRedisCache(doc);
  next();
});

userSchema.post('findOneAndUpdate', (doc: IUser, next) => {
  clearRedisCache(doc);
  next();
});

userSchema.post('deleteOne', (doc: IUser, next) => {
  clearRedisCache(doc);
  next();
});

// FUNCTION KEYWORD ARE NECESSARY
// eslint-disable-next-line func-names
userSchema.methods.comparePassword = function (candidatePassword) {
  return isPassMatch(candidatePassword, this.password);
};

// FUNCTION KEYWORD ARE NECESSARY
// eslint-disable-next-line func-names
userSchema.methods.compareApiKey = function (candidatePassword) {
  return new Promise((resolve) => {
    if (this.services && this.services.has('dkApi') && typeof this.services.get('dkApi') !== 'boolean') {
      const dkApi: IService = this.services.get('dkApi');
      const decodedPass = dkApi.login.password;
      if (decodedPass && decodedPass.length > 0
        && candidatePassword && decodedPass === candidatePassword) {
        return resolve(true);
      }
    }
    return resolve(false);
  });
};
// Omit the password when returning a user
userSchema.set('toJSON', {
  transform(doc, ret) {
    // eslint-disable-next-line no-param-reassign
    delete ret.password;
    // eslint-disable-next-line no-param-reassign
    delete ret.tmpToken;
    // eslint-disable-next-line no-param-reassign
    delete ret.__v;
    return ret;
  },
});

export const UserModel = (): Model<IUser> => model<IUser>('user', userSchema);
