import * as passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import { MetadataReader, toPassportConfig } from 'passport-saml-metadata';
import { BasicStrategy } from 'passport-http';
import { ExtractJwt, Strategy as JWTstrategy } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import { readFileSync, readdir } from 'fs';
import { join } from 'path';
import { Response, NextFunction } from 'express';
import { generateUrlApi, ssoCreateUserIfNotExist, getLinkedInSSOConfig } from './inject';
import { IUser, UserModel } from '../models/v1/User';
import { Auth, RequestAuth } from '../models/v1/Auth';
import { WorkspaceModel } from '../models/v1/Workspace';

const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;

const samlApps: string[] = [];
const Model = WorkspaceModel();
const UserMod = UserModel();

passport.serializeUser<any, any>((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

const getActiveApps = (): string[] => samlApps;

const cookieExtractor = (req: RequestAuth) => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies.auth;
  }
  return token;
};

const loadAllAuth = (saveTransaction, model, createNewuser) => {
  const directoryPath = join(process.cwd(), '/saml/meta');
  // passsing directoryPath and callback function
  try {
    readdir(directoryPath, (err, files) => {
      // handling error
      if (err) {
        return console.error(`Unable to scan directory: ${err}`);
      }
      // listing all files using forEach
      return files.forEach((file) => {
        console.log('Load saml', file); // eslint-disable-line no-console
        try {
          const metadataXml = readFileSync(`${directoryPath}/${file}`, 'utf-8');
          const config = toPassportConfig(new MetadataReader(metadataXml, {}));
          [config.name] = file.split('.');
          config.issuer = config.name;
          config.createIfNotExist = ssoCreateUserIfNotExist;
          config.callbackUrl = `${generateUrlApi()}/auth/saml/${config.name}/acs`;
          samlApps.push(config.name);
          passport.use(new SamlStrategy(config, async (profile, done): Promise<Response> => {
            try {
              let user: IUser = await model.findOne({ email: profile.nameID, tmpAccount: false });
              let created = false;
              if (!user) {
                // check settings and create the user
                if (config.createIfNotExist()) {
                  user = await createNewuser(profile, config.name);
                  created = true;
                } else {
                  return done({ error: 'createIfNotExist is false', message: 'Ask your admin to add you ' }, false);
                }
              }
              const auth: Auth = {
                user: {
                  _id: user._id,
                  role: user.toObject().role,
                },
              };
              const jsonUser = user.toJSON();
              if (created) {
                saveTransaction(auth, `register_saml_${config.name}`, jsonUser, {}, {});
              }
              saveTransaction(auth, `login_saml_${config.name}`, jsonUser, {}, {});
              return done(null, { auth, user });
            } catch (errR) {
              return done({ error: errR, message: 'Unknow error, pleas contact an admin' }, false);
            }
          }));
        } catch (errR) {
          console.error(`Unable to init SAML: ${file} ${errR}`);
        }
      });
    });
  } catch (err) {
    console.error(`Unable to init SAML: ${err}`);
  }

  passport.use('login', new LocalStrategy(
    {
      usernameField: 'username',
      session: false,
    },
    async (email: any, password: any, done: any) => {
      try {
        const user: IUser = await model.findOne({ email, tmpAccount: false });
        if (!user) {
          return done({ error: 'User dont\' exist', message: 'Wrong User or Key' }, false);
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done({ error: 'Wrong password', message: 'Wrong User or Key' }, false);
        }
        const auth: Auth = {
          user: {
            _id: user._id,
            role: user.toObject().role,
          },
        };
        const jsonUser = user.toJSON();
        saveTransaction(auth, 'login_jwt', jsonUser, {}, {});
        return done(null, { auth, user });
      } catch (err) {
        return done({ error: err, message: 'Unknow error, pleas contact an admin' }, false);
      }
    },
  ));

  passport.use('basic', new BasicStrategy(async (email: string, password: string, done) => {
    try {
      const user: IUser = await model.findOne({ email, tmpAccount: false });
      if (!user) {
        return done({ error: 'Wrong User or Key' }, false, { message: 'user dont\' exist' });
      }
      const isMatch = await user.compareApiKey(password);
      if (!isMatch) {
        return done({ error: 'Wrong User or Key' }, false, { message: 'Wrong password' });
      }
      const auth: Auth = {
        user: {
          _id: user._id,
          role: user.toObject().role,
        },
      };
      const jsonUser = user.toJSON();
      saveTransaction(auth, 'login_basic', jsonUser, {}, {});
      return done(null, { auth, user });
    } catch (err) {
      return done({ error: err, message: 'Unknow error, pleas contact an admin' }, false);
    }
  }));

  passport.use('auth-check-from-cookie', new JWTstrategy(
    {
      secretOrKey: process.env.SIGN_KEY,
      jwtFromRequest: cookieExtractor,
      session: false,
    },
    (token: any, done: any) => {
      try {
        return done(null, token);
      } catch (error) {
        return done({ error }, false, { message: 'Unknow error' });
      }
    },
  ));

  passport.use('auth-check', new JWTstrategy(
    {
      secretOrKey: process.env.SIGN_KEY,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      session: false,
    },
    (token: any, done: any) => {
      try {
        return done(null, token);
      } catch (error) {
        return done({ error }, false, { message: 'Unknow error' });
      }
    },
  ));
  const LinkedInAutConfigurator = getLinkedInSSOConfig();
  if (LinkedInAutConfigurator.clientID !== '' && LinkedInAutConfigurator.clientSecret !== '') {
    samlApps.push(LinkedInAutConfigurator.name);
    passport.use(new LinkedInStrategy(
      {
        clientID: LinkedInAutConfigurator.clientID,
        clientSecret: LinkedInAutConfigurator.clientSecret,
        callbackURL: `${generateUrlApi()}/auth/oauth/linkedin/callback`,
        scope: ['r_emailaddress', 'r_liteprofile'],
      },
      async (accessToken, refreshToken, profile, done) => {
        // asynchronous verification, for effect...
        process.nextTick(async () => {
          console.log('Profile :--', profile); // eslint-disable-line no-console
          const email = profile.emails[0].value;
          const authName = LinkedInAutConfigurator.name;
          try {
            let user: IUser = await model.findOne({ email, tmpAccount: false });
            let created = false;
            if (!user) {
              // check settings and create the user
              if (ssoCreateUserIfNotExist()) {
                const UserData = {
                  nameID: email,
                  firstname: (profile.name.givenName) ? profile.name.givenName : '',
                  lastname: (profile.name.familyName) ? profile.name.familyName : '',
                  profilePic: (profile.photos[0].value) ? profile.photos[0].value : '',
                };
                user = await createNewuser(UserData, authName);
                created = true;
              } else {
                return done({ error: 'createIfNotExist is false', message: 'Ask your admin to add you ' }, false);
              }
            } else {
              // Update Profile data
              if (profile.name.givenName) user.firstName = profile.name.givenName;
              if (profile.name.familyName) user.lastName = profile.name.familyName;
              if (profile.photos[0].value) user.picture = profile.photos[0].value;
              await user.save();
            }
            const auth: Auth = {
              user: {
                _id: user._id,
                role: user.toObject().role,
              },
            };
            const jsonUser = user.toJSON();
            if (created) {
              saveTransaction(auth, `register_auth_${authName}`, jsonUser, {}, {});
            }
            saveTransaction(auth, `login_auth_${authName}`, jsonUser, {}, {});
            return done(null, { auth, user });
          } catch (err) {
            return done({ error: err, message: 'Unknown error, pleas contact an admin' }, false);
          }
        });
      },
    ));
  }
};

// eslint-disable-next-line max-len
const checkAuth = (minRole: string, req: RequestAuth, res: Response, next: NextFunction) => async (err: any, auth: Auth) => {
  if (err) {
    res.status(401).json({ error: err });
    return;
  }
  if (!auth) {
    res.status(401).json({ error: 'invalid login' });
    return;
  }
  try {
    req.auth = auth;
    if (req.auth.user.role !== 'admin' && minRole === 'owner') {
      try {
        const reqUserId = req.params.workspaceId || req.params.id;
        const wsData = await Model.findOne({ _id: reqUserId });
        // eslint-disable-next-line no-console
        console.log(wsData.creatorId.toString());
        // eslint-disable-next-line no-console
        console.log(req.auth.user._id.toString());
        if (typeof wsData.creatorId.toString() !== 'undefined' && wsData.creatorId.toString() !== req.auth.user._id.toString()) {
          const userData = await UserMod.findOne({ _id: req.auth.user._id });
          if (wsData.shared_users.some((e) => e.email === userData.email)) {
            wsData.shared_users.forEach(async (el) => {
              if (el.email.toString() === userData.email.toString()) {
                if (el.role === 'view' && req.method !== 'GET') {
                  throw new Error('Unable to perform actions on this workspace');
                }
              }
            });
          } else if (wsData.linkShared) {
            if (req.method !== 'GET') {
              throw new Error('Unable to perform actions on this workspace');
            }
          } else {
            throw new Error('Unable to perform actions on this workspace');
          }
        }
      } catch (eRr) {
        res.status(401).json({ error: eRr.message });
      }
    }
    if (minRole === 'admin' && req.auth.user.role !== 'admin') {
      res.status(401).json({ error: 'invalid user role' });
      return;
    }
    next();
  } catch (errR) {
    console.error('auth error', errR);
    res.status(401).json({ error: errR });
  }
};

export {
  passport, getActiveApps, checkAuth, loadAllAuth,
};
