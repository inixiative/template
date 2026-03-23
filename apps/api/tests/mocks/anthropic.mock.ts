import { VCR } from './VCR';

export type MockAnthropicMessage = {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence: string | null;
  usage: { input_tokens: number; output_tokens: number };
};

type RealAnthropicClient = {
  messages: { create: (...args: unknown[]) => Promise<MockAnthropicMessage> };
};

/**
 * Mock Anthropic client backed by VCR fixtures.
 *
 * - Fixture file present → returns body, no real call
 * - No fixture + realClient → calls real API, redacts id, writes fixture
 * - 4xx/5xx fixture → throws with status + message, mirroring real SDK behavior
 *
 * @example
 * const { client } = createMockAnthropicClient();
 * const msg = await client.messages.create({ model: 'claude-sonnet-4-6', ... });
 *
 * // Error path — point VCR at an error fixture directly
 * const fixture = await vcr.call('anthropic/errors/rateLimited', () => realFn());
 * // fixture.status === 429, caller throws
 */
export const createMockAnthropicClient = (realClient?: RealAnthropicClient) => {
  const vcr = new VCR();

  const client = {
    messages: {
      create: async (...args: unknown[]): Promise<MockAnthropicMessage> => {
        const fixture = await vcr.call(
          'anthropic/chatCompletion',
          () =>
            realClient
              ? realClient.messages.create(...args)
              : Promise.reject(new Error('No real Anthropic client — add fixture or pass realClient')),
          { redact: ['id'] },
        );
        if (fixture.status >= 400) {
          const msg = (fixture.body as { message?: string })?.message ?? 'Unknown error';
          throw new Error(`Anthropic API error (${fixture.status}): ${msg}`);
        }
        return fixture.body as MockAnthropicMessage;
      },
    },
  };

  return { client };
};

export type MockAnthropicClient = ReturnType<typeof createMockAnthropicClient>['client'];
