import { VCR } from './VCR';

/**
 * Mock Anthropic message response type
 */
export type MockAnthropicMessage = {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

/**
 * Create a mock Anthropic client for testing.
 *
 * Supports VCR for pre-loaded responses, falls back to deterministic mock.
 *
 * @example
 * const { client, vcr } = createMockAnthropicClient();
 * vcr.add({ id: 'msg-1', content: [{ type: 'text', text: 'Hello!' }], ... });
 * const response = await client.messages.create({ ... });
 */
export const createMockAnthropicClient = () => {
  const vcr = new VCR<MockAnthropicMessage>();

  const client = {
    messages: {
      create: async (): Promise<MockAnthropicMessage> => {
        // Try VCR first
        const recorded = vcr.get();
        if (recorded) return recorded;

        // Fallback to deterministic mock
        return {
          id: `mock-msg-${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                response: 'Mock response for testing',
                confidence: 0.95,
              }),
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        };
      },
    },
    vcr, // Expose VCR for test setup
  };

  return { client, vcr };
};

/**
 * Type for the mock client (use when injecting into app)
 */
export type MockAnthropicClient = ReturnType<typeof createMockAnthropicClient>['client'];
