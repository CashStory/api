export const generateUrl = () => {
  if (!process.env.FRONT_URI) {
    return 'http://localhost:4200/';
  }
  return `${process.env.FRONT_URI}/`;
};

export const generateUrlApi = () => {
  if (!process.env.BACK_URI) {
    return 'http://localhost:3000/api/v1';
  }
  return `${process.env.BACK_URI}`;
};

export const ssoCreateUserIfNotExist = () => process.env.SSO_CREATE_IF_NOT_EXIST || false;

export const redisCacheLifeTime = () => Number(process.env.DEFAULT_CACHE_LOCKING_TIME) || 0;
export const redisCacheCustomKeys = {
  users: [],
  workspaces: [],

  get userKeys() {
    return this.users;
  },

  get workspaceKeys() {
    return this.workspaces;
  },

  set customKeys(value) {
    if (!this[value.collectionName].includes(value.key)) {
      this[value.collectionName].push(value.key);
    }
  },

  set clearKeys(collectionName) {
    this[collectionName].length = 0;
  },

};

export const getDomain = () => {
  const url = generateUrl();
  const match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
  if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
    let hostName = (match[2] || url);
    const parts = hostName.split('.').reverse();
    if (parts != null && parts.length > 1) {
      hostName = `${parts[1]}.${parts[0]}`;
    }
    return hostName;
  }
  return 'localhost';
};

export const getLinkedInSSOConfig = () => ({
  name: 'linkedin',
  clientID: (process.env.LINKEDIN_SSO_CLIENT_ID || ''),
  clientSecret: (process.env.LINKEDIN_SSO_SECRET || ''),
  callbackURL: `${generateUrlApi()}auth/oauth/linkedin/callback`,
});
