export type SendEmailOptions = {
  to: string | string[];
  from: string;
  subject: string;
  html: string;
  replyTo?: string;
  tags?: string[];
  metadata?: Record<string, string>;
};

export type SendEmailResult = {
  id: string;
  success: boolean;
};

export type EmailClient = {
  send: (options: SendEmailOptions) => Promise<SendEmailResult>;
};
