export type EmailAuthMethod = {
  type: 'email';
  email: string;
  password: string;
  name?: string;
};

export type OAuthAuthMethod = {
  type: 'oauth';
  provider: string;
  callbackURL?: string;
};

export type SamlAuthMethod = {
  type: 'saml';
  provider: string;
  email?: string;
};

export type AuthMethod = EmailAuthMethod | OAuthAuthMethod | SamlAuthMethod;

export type AuthSession = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  session: {
    token: string;
    expiresAt: Date;
  };
};
