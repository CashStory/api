import { Request } from 'express';
import { ObjectId } from 'mongodb';
import { Schema } from 'mongoose';
import * as encrypt from 'mongoose-encryption';

export interface ILogin {
  username: string;
  password: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface RequestAuth extends Request {
  auth: Auth;
}
export interface Auth {
  user: {
    role: string,
    _id: ObjectId,
  };
}

export enum IRights {
  GET = 'GET',
  PUT = 'PUT',
  DELETE = 'DELETE',
  POST = 'POST',
}
export interface ISmartTable {
  database: string;
  collection: string;
  settings: object;
  model?: string;
  rights?: IRights[];
}

export interface PassportProvider {
  name: string;
}

export const loginSchema: Schema<ILogin> = new Schema(
  {
    username: String,
    password: String,
  },
  { _id: false, timestamps: true },
);

const encKey = process.env.ENCRYPT_KEY;
const sigKey = process.env.SIGN_KEY;
if (!encKey || !sigKey) {
  console.error('Missing ENCRYPT_KEY or SIGN_KEY');
  process.exit(22);
}
loginSchema.plugin(encrypt, { encryptionKey: encKey, signingKey: sigKey });
