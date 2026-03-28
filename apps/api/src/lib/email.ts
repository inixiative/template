import { createConsoleClient, createResendClient, type EmailClient } from '@template/email/client';

const apiKey = process.env.RESEND_API_KEY;

export const emailClient: EmailClient = apiKey ? createResendClient(apiKey) : createConsoleClient();
