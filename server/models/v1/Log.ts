import {
  Document, Schema, Model, model,
} from 'mongoose';
import { ObjectId } from 'mongodb';

export interface ILog extends Document {
  _id: ObjectId;
  creatorId: ObjectId;
  action: string;
  prevData: object;
  newData: object;
  context: object;
  collectionName: string;
}

const logSchema = new Schema(
  {
    _id: {
      type: ObjectId,
      auto: true,
    },
    creatorId: ObjectId,
    action: String,
    prevData: Object,
    newData: Object,
    context: Object,
    collectionName: String,
  },
  { timestamps: true },
);

export const LogModel = (): Model<ILog> => model<ILog>('log', logSchema);
