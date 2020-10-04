import {
  Document, Schema, Model, model,
} from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IEmail extends Document {
  _id: ObjectId;
  creatorId: ObjectId;
  id_from: string;
  text: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}

const emailSchema = new Schema(
  {
    _id: {
      type: ObjectId,
      auto: true,
    },
    creatorId: ObjectId,
    id_from: String,
    text: String,
    from: String,
    to: String,
    subject: String,
    html: String,
  },
  { timestamps: true },
);

export const EmailModel = (): Model<IEmail> => model<IEmail>('email', emailSchema);
