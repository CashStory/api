import * as multer from 'multer';
import * as mongoose from 'mongoose';
import { extname } from 'path';
import * as GridFSStorage from 'multer-gridfs-storage';
import { RequestAuth } from '../models/v1/Auth';

const checkFileType = (file, cb) => {
  // Check file type
  // allowed ext
  const filetypes = /jpeg|jpg|pdf|png|gif|json|xlsx|xlsm|xls|csv|txt/;
  // check ext
  const checkedExtname = filetypes.test(extname(file.originalname).toLowerCase());
  // check mime
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && checkedExtname) {
    return cb(null, true);
  }
  return cb('error: Images only !');
};

export const downloadFile = (filename: string, res) => {
  const gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    chunkSizeBytes: 1024,
    bucketName: 'fs',
  });
  return gridFSBucket.find({ filename })
    .toArray((err, files) => {
      if (err || !files || files.length === 0) {
        return res.status(404).json({
          responseCode: 1,
          responseMessage: `error ${err}`,
        });
      }
      res.set('Content-Type', files[0].contentType);
      const readStream = gridFSBucket.openDownloadStreamByName(files[0].filename);
      return readStream.pipe(res);
    });
};

const authUser = (req: RequestAuth) => {
  if (req && req.auth && req.auth.user && req.auth.user._id) {
    return req.auth.user._id;
  }
  return null;
};

export const uploadFile = () => {
  const randomName = `${Math.floor(Math.random() * (999999 - 100000)) + 100000}`;
  const storage = new GridFSStorage({
    db: mongoose.connection,
    file: (req: RequestAuth, file) => {
      const metadata = {
        originalname: file.originalname,
        createdAt: Date.now(),
        creatorId: authUser(req),
      };
      const filename = `${randomName}-${Date.now()}.${file.originalname.split('.')[file.originalname.split('.').length - 1]}`;
      return {
        metadata,
        filename,
        chunkSizeBytes: 1024,
        bucketName: 'fs',
      };
    },
  });

  return multer({
    storage,
    limits: { fileSize: 999999999 },
    fileFilter: (req, fil, cb) => {
      checkFileType(fil, cb);
    },
  }).single('myImage');
};
