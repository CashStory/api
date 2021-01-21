import {
  Response, NextFunction, Router, Express, static as Static,
} from 'express';
import { join } from 'path';
import FileCtrl from './controllers/FileCtrl';
import UserCtrl from './controllers/UserCtrl';
import WorkspaceCtrl from './controllers/WorkspaceCtrl';
import SmartTableCtrl from './controllers/SmartTableCtrl';
import { promBeforeEach, promAfterEach } from './services/prometheus';
import {
  proxyAll, checkIframeAllowed, getStatic, runNotebook,
} from './services/webrender';
import { passport, checkAuth } from './services/auth';
import AuthCtrl from './controllers/AuthCtrl';
import { RequestAuth } from './models/v1/Auth';
import { apiServe, apiDoc } from './services/apiDoc';

export default function routes(app: Express) {
  const router = Router();
  const file = new FileCtrl();
  const user = new UserCtrl();
  const workspace = new WorkspaceCtrl();
  const smartTable = new SmartTableCtrl();
  const auth = new AuthCtrl();

  const isAuth = (minRole: string = 'any') => async (req: RequestAuth, res: Response, next: NextFunction): Promise<void> => {
    // if (!req.headers.authorization && req.query.authorization) {
    //   req.headers.authorization = req.query.authorization;
    // } not secure for now
    if (req.headers.authorization && req.headers.authorization.indexOf('Basic ') !== -1) {
      passport.authenticate('basic', { session: false }, checkAuth(minRole, req, res, next))(req, res, next);
    } else {
      passport.authenticate('auth-check', checkAuth(minRole, req, res, next))(req, res, next);
    }
  };

  const linkedinSyncMiddlWr = (req: RequestAuth, res: Response, next: NextFunction) => {
    req.params.provider = 'linkedin';
    // Set the session as an identifier for auth vs profile sync
    passport.authenticate('auth-check-from-cookie', checkAuth('any', req, res, next))(req, res, next);
    next();
  };

  promBeforeEach(router);
  try {
    // Notifications
    router.route('/notifications/send').post(isAuth(), file.notification);

    // Upload
    router.route('/files/').post(file.upload);
    router.route('/files/:filename').get(file.getOne);
    router.route('/files/send').post(file.send);

    // Auth
    router.route('/auth/resetpwd').post(user.resetpwd);
    router.route('/auth/saml').get(auth.getActiveVendors);
    router.route('/auth/register').post(auth.register);
    router.route('/auth/:provider').all(auth.login);
    router.route('/auth/saml/:provider/acs').post(auth.getAcsSaml);
    router.route('/auth/oauth/:provider/callback').get(auth.authCallBack);
    router.route('/auth/:provider/icon').get(auth.renderIcon);

    // Me
    router.route('/users/me').get(isAuth(), user.getMe);
    router.route('/users/me').put(isAuth(), user.updateMe);
    router.route('/users/me').delete(isAuth(), user.deleteMe);
    router.route('/users/me/event').post(isAuth(), user.addEvent);
    router.route('/users/me/wp').put(isAuth(), user.updateCurrentWp);
    router.route('/users/me/password').put(isAuth(), user.updateMyPasswd);

    router.route('/users/me/favorite').post(isAuth(), user.addFavorite);
    router.route('/users/me/favorite/del').post(isAuth(), user.delFavorite);
    router.route('/users/profileSync/linkedin').get(linkedinSyncMiddlWr, auth.login);

    // User tmp funnel subscription
    router.route('/users/tmp').post(user.createTmp);
    router.route('/users/tmp').put(user.updateTmp);
    router.route('/users/tmp/upgrade').post(user.upgradeTmp);
    // User
    router.route('/users').get(isAuth('admin'), user.getAll);
    router.route('/users').post(isAuth('admin'), user.insert);
    router.route('/users/count').get(isAuth('admin'), user.count);
    router.route('/users/:id').get(isAuth('admin'), user.get);
    router.route('/users/:id').put(isAuth('admin'), user.update);
    router.route('/users/:id').delete(isAuth('admin'), user.delete);

    // workspace
    router.route('/workspaces/duplicate').post(isAuth('owner'), user.duplicateWS);
    router.route('/workspaces/templates').get(isAuth(), workspace.getTemplates);
    router.route('/workspaces/templates/:id').post(isAuth(), workspace.applyTemplates);
    router.route('/workspaces').get(isAuth('admin'), workspace.getAll);
    router.route('/workspaces/count').get(isAuth('admin'), workspace.count);
    router.route('/workspaces').post(isAuth('admin'), workspace.insert);
    router.route('/workspaces/:id').get(isAuth('owner'), workspace.get);
    router.route('/workspaces/:id').put(isAuth('owner'), workspace.update);
    router.route('/workspaces/:id').delete(isAuth('admin'), workspace.delete);

    // workspace share apis
    router.route('/workspaces/request').post(isAuth(), workspace.requestAccess);
    router.route('/workspaces/share/:id').get(isAuth(), workspace.getShare);
    router.route('/workspaces/share/:id').post(isAuth(), workspace.addShare);
    router.route('/workspaces/share/:id/link').post(isAuth(), workspace.toggleLink);
    router.route('/workspaces/share/:id/:email').delete(isAuth(), workspace.deleteShare);

    // workspace box
    router.route('/workspaces/:workspaceId/section/:sectionId/box').post(isAuth('owner'), workspace.addNewBoxToExistingSection);
    router.route('/workspaces/:workspaceId/section/:sectionId/box/:boxId').put(isAuth('owner'), workspace.updateExistingBox);
    router.route('/workspaces/:workspaceId/section/:sectionId/box/:boxId').delete(isAuth('owner'), workspace.deleteBoxFromSection);
    router.route('/workspaces/:workspaceId/section/:sectionId/box').put(isAuth('owner'), workspace.updateExistingBoxPositions);

    // Smarttable
    router.route('/smarttables/:databaseId/:collectionId')
      .get(isAuth(), smartTable.isAllowed, smartTable.catchExistingModel, smartTable.get);
    router.route('/smarttables/:databaseId/:collectionId/allowed')
      .get(isAuth(), smartTable.isAllowedQuery);
    router.route('/smarttables/:databaseId/:collectionId/count')
      .get(isAuth(), smartTable.isAllowed, smartTable.catchExistingModel, smartTable.count);
    router.route('/smarttables/:databaseId/:collectionId')
      .post(isAuth(), smartTable.isAllowed, smartTable.catchExistingModel, smartTable.insert);
    router.route('/smarttables/:databaseId/:collectionId/:docId')
      .get(isAuth(), smartTable.isAllowed, smartTable.catchExistingModel, smartTable.getOne);
    router.route('/smarttables/:databaseId/:collectionId/:docId')
      .put(isAuth(), smartTable.isAllowed, smartTable.catchExistingModel, smartTable.update);
    router.route('/smarttables/:databaseId/:collectionId/all')
      .delete(isAuth(), smartTable.isAllowed, smartTable.catchExistingModel, smartTable.deleteAll);
    router.route('/smarttables/:databaseId/:collectionId/:docId')
      .delete(isAuth(), smartTable.isAllowed, smartTable.catchExistingModel, smartTable.delete);

    router.route('/notebook/:jupyterName/:token/start').get(runNotebook);
    router.route('/notebook/:jupyterName/:token').get(getStatic);
    router.route('/proxy').all(proxyAll);
    router.route('/test_iframe').post(isAuth(), checkIframeAllowed);
  // router.route('/proxy').all(isAuth(), proxyAll);
  } catch (e) {
    throw new Error(e);
  }

  // Apply the routes to our application with the prefix /api
  app.use('/docs', apiServe, apiDoc);

  const publicPath = join(process.cwd(), '/public');
  app.use('/public', Static(publicPath));
  app.use('/api/v1', router);
  promAfterEach(router);
}
