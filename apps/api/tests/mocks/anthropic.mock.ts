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

/** Default deterministic fallback when VCR is empty and no real client */
const defaultMessage: MockAnthropicMessage = {
  id: 'msg_SANITIZED_000',
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

/**
 * Create a mock Anthropic client for testing.
 *
 * Supports three modes via VCR:
 * 1. Playback — pre-loaded fixtures popped FIFO
 * 2. Error injection — queued errors thrown for unhappy path
 * 3. Auto-record — calls real client, sanitizes, saves fixture
 *
 * @param realClient - Optional real Anthropic client for auto-record mode
 *
 * @example
 * // Playback mode
 * const { client, vcr } = createMockAnthropicClient();
 * vcr.add(loadFixture('anthropic/chatCompletion'));
 * const response = await client.messages.create({ ... });
 *
 * // Auto-record mode (first run)
 * const { client, vcr } = createMockAnthropicClient(realAnthropicClient);
 * // VCR empty → calls real API, sanitizes, saves fixture, returns sanitized
 */
export const createMockAnthropicClient = (realClient?: { messages: { create: (...args: unknown[]) => Promise<MockAnthropicMessage> } }) => {
  const vcr = new VCR<MockAnthropicMessage>();

  const client = {
    messages: {
      create: async (...args: unknown[]): Promise<MockAnthropicMessage> => {
        // Try VCR first (playback or error injection)
        const recorded = vcr.get();
        if (recorded) return recorded;

        // Auto-record: call real client if provided
        if (realClient) {
          return vcr.playOrRecord(
            () => realClient.messages.create(...args),
            { fixtureName: 'anthropic/chatCompletion' },
          );
        }

        // Fallback to deterministic mock
        return { ...defaultMessage, id: `msg_mock_${Date.now()}` };
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
