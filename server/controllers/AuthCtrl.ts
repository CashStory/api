import { Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { existsSync } from 'fs';
import BaseCtrl from './BaseCtrl';
import { RequestAuth } from '../models/v1/Auth';
import { passport, getActiveApps } from '../services/auth';
import { generateUrl, getDomain } from '../services/inject';
import { UserModel } from '../models/v1/User';

const path = require('path');

const redirctConf = {
  failureRedirect: `${generateUrl()}`,
  successRedirect: `${generateUrl()}`,
  failureFlash: true,
};

export default class AuthCtrl extends BaseCtrl {
  Model = null;

  getModelName = () => 'auth';

  getActiveVendors = async (req: RequestAuth, res: Response): Promise<Response> => {
    try {
      return res.status(200).json(getActiveApps());
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  };

  renderIcon = async (req: RequestAuth, res: Response) => {
    const { provider } = req.params;
    const iconPath = path.join(process.cwd(), `/saml/icon/${provider}.png`);
    const defaultPath = path.join(process.cwd(), '/saml/icon/cashstory.png');
    try {
      if (existsSync(iconPath)) {
        return res.sendFile(iconPath);
      }
      console.error('Cannot find SAML icon');
      return res.sendFile(defaultPath);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  };

  register = async (req, res: Response): Promise<any> => {
    const UserMod = UserModel();
    const userFound = await UserMod.findOne({ email: req.body.email });
    if (!userFound) {
      const userData = {
        email: req.body.email,
        password: req.body.password,
        firstName: req.body.full_name,
      };
      await new UserMod(userData).save();
      return res.status(200).json(userData);
    }
    return res.status(500).json({ message: 'Email already registred' });
  };

  login = async (req: RequestAuth, res: Response, next: NextFunction): Promise<any> => {
    const { provider } = req.params;
    return passport.authenticate(provider, (err, profile) => {
      if (err) {
        console.error('Auth', err.error);
        this.saveTransaction({ user: { _id: null, role: null } }, 'login', {}, {}, { error: err.error, username: req.body.username });
        return res.status(200).json({ error: err.message });
      }
      if (provider === 'login') {
        const token = jwt.sign(profile.auth, process.env.SIGN_KEY, { expiresIn: '10d' });
        const jsonUser = profile.user.toJSON();
        this.saveTransaction(profile.auth, 'login', jsonUser, {}, {});
        return res.status(200).json({ token });
      }
      return res.status(500).json({ error: 'wrong provider' });
    })(req, res, next);
  };

  getAcsSaml = async (req: RequestAuth, res: Response, next: NextFunction): Promise<any> => {
    const { provider } = req.params;
    passport.authenticate(provider, (err, profile) => {
      if (err) {
        return next(err); // will generate a 500 error
      }
      const cookieDomain = redirctConf.successRedirect.replace(/(^\w+:|^)\/\//, '');
      if (!profile) {
        res.cookie('auto-login-token', 'auth-failed', {
          maxAge: 900000, httpOnly: false, domain: cookieDomain, path: '/', secure: true,
        });
        return res.redirect(`${redirctConf.successRedirect}`);
      }
      const token = jwt.sign(profile.auth, process.env.SIGN_KEY, { expiresIn: '10d' });
      const jsonUser = profile.user.toJSON();
      this.saveTransaction(profile.auth, 'login-with-saml', jsonUser, {}, {});
      res.cookie('auto-login-token', token, {
        maxAge: 900000, httpOnly: false, domain: `.${getDomain()}`, path: '/',
      });
      return res.redirect(`${redirctConf.successRedirect}`);
    })(req, res, next);
  };

  authCallBack = async (req: RequestAuth, res: Response, next: NextFunction): Promise<any> => {
    const { provider } = req.params;
    passport.authenticate(provider, (err, profile) => {
      if (err) {
        return next(err); // will generate a 500 error
      }
      const cookieDomain = redirctConf.successRedirect.replace(/(^\w+:|^)\/\//, '');
      if (err || !profile) {
        res.cookie('auto-login-token', 'auth-failed', {
          maxAge: 900000, httpOnly: false, domain: cookieDomain, path: '/', secure: true,
        });
        return res.redirect(`${redirctConf.successRedirect}`);
      }
      const token = jwt.sign(profile.auth, process.env.SIGN_KEY, { expiresIn: '10d' });
      const jsonUser = profile.user.toJSON();
      this.saveTransaction(profile.auth, `login-with-auth-${provider}`, jsonUser, {}, {});
      res.cookie('auto-login-token', token, {
        maxAge: 900000, httpOnly: false, domain: `.${getDomain()}`, path: '/',
      });
      return res.redirect(`${redirctConf.successRedirect}`);
    })(req, res, next);
  };
}
