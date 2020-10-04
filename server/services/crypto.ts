// import { AES, enc } from 'crypto-js';
import * as bcrypt from 'bcryptjs';
import * as generatePassword from 'password-generator';

export const createApiKey = (): string => `DK_${generatePassword(48)}`;

export const isPassMatch = (candidatePwd, password): Promise<boolean> => new Promise((resolve) => {
  bcrypt.compare(candidatePwd, password, (err, isMatch) => resolve(err ? false : isMatch));
});

export const encodePass = (password: string): string => {
  let hash = null;
  try {
    const passwordStr = String(password);
    const saltRounds = 10;
    const salt = bcrypt.genSaltSync(saltRounds);
    hash = bcrypt.hashSync(passwordStr, salt);
  } catch (err) {
    console.error(err);
  }
  return hash;
};
