import { VCR } from './VCR';

export type MockOpenAIChatCompletion = {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  system_fingerprint?: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: 'stop' | 'length' | 'tool_calls';
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

export type MockOpenAIEmbedding = {
  object: 'list';
  data: Array<{ object: 'embedding'; index: number; embedding: number[] }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
};

type RealOpenAIClient = {
  chat?: { completions: { create: (...args: unknown[]) => Promise<MockOpenAIChatCompletion> } };
  embeddings?: { create: (...args: unknown[]) => Promise<MockOpenAIEmbedding> };
};

/**
 * Mock OpenAI client backed by VCR fixtures.
 *
 * - Fixture file present → returns body, no real call
 * - No fixture + realClient → calls real API, redacts sensitive fields, writes fixture
 * - 4xx/5xx fixture → throws with status + message, mirroring real SDK behavior
 */
export const createMockOpenAIClient = (realClient?: RealOpenAIClient) => {
  const vcr = new VCR();

  const client = {
    chat: {
      completions: {
        create: async (...args: unknown[]): Promise<MockOpenAIChatCompletion> => {
          const fixture = await vcr.call(
            'openai/chatCompletion',
            () =>
              realClient?.chat
                ? realClient.chat.completions.create(...args)
                : Promise.reject(new Error('No real OpenAI client — add fixture or pass realClient')),
            { redact: ['id', 'system_fingerprint'] },
          );
          if (fixture.status >= 400) {
            const msg = (fixture.body as { message?: string })?.message ?? 'Unknown error';
            throw new Error(`OpenAI API error (${fixture.status}): ${msg}`);
          }
          return fixture.body as MockOpenAIChatCompletion;
        },
      },
    },
    embeddings: {
      create: async (...args: unknown[]): Promise<MockOpenAIEmbedding> => {
        const fixture = await vcr.call(
          'openai/embedding',
          () =>
            realClient?.embeddings
              ? realClient.embeddings.create(...args)
              : Promise.reject(new Error('No real OpenAI client — add fixture or pass realClient')),
        );
        if (fixture.status >= 400) {
          const msg = (fixture.body as { message?: string })?.message ?? 'Unknown error';
          throw new Error(`OpenAI API error (${fixture.status}): ${msg}`);
        }
        return fixture.body as MockOpenAIEmbedding;
      },
    },
  };

  return { client };
};

export type MockOpenAIClient = ReturnType<typeof createMockOpenAIClient>['client'];
