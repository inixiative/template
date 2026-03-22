import { VCR } from './VCR';

/**
 * Mock OpenAI chat completion response type
 */
export type MockOpenAIChatCompletion = {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  system_fingerprint?: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

/**
 * Mock OpenAI embedding response type
 */
export type MockOpenAIEmbedding = {
  object: 'list';
  data: Array<{
    object: 'embedding';
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
};

/** Default deterministic chat fallback */
const defaultChatCompletion: MockOpenAIChatCompletion = {
  id: 'chatcmpl-SANITIZED_000',
  object: 'chat.completion',
  created: Math.floor(Date.now() / 1000),
  model: 'gpt-4o',
  system_fingerprint: 'fp_SANITIZED',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Mock response for testing',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 50,
    completion_tokens: 20,
    total_tokens: 70,
  },
};

/** Default deterministic embedding fallback */
const defaultEmbedding: MockOpenAIEmbedding = {
  object: 'list',
  data: [
    {
      object: 'embedding',
      index: 0,
      embedding: Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.01)),
    },
  ],
  model: 'text-embedding-3-small',
  usage: {
    prompt_tokens: 10,
    total_tokens: 10,
  },
};

type RealOpenAIClient = {
  chat?: { completions: { create: (...args: unknown[]) => Promise<MockOpenAIChatCompletion> } };
  embeddings?: { create: (...args: unknown[]) => Promise<MockOpenAIEmbedding> };
};

/**
 * Create a mock OpenAI client for testing.
 *
 * Supports three modes via VCR:
 * 1. Playback — pre-loaded fixtures popped FIFO
 * 2. Error injection — queued errors thrown for unhappy path
 * 3. Auto-record — calls real client, sanitizes, saves fixture
 *
 * @param realClient - Optional real OpenAI client for auto-record mode
 *
 * @example
 * const { client, chatVcr, embeddingVcr } = createMockOpenAIClient();
 * chatVcr.add(loadFixture('openai/chatCompletion'));
 */
export const createMockOpenAIClient = (realClient?: RealOpenAIClient) => {
  const chatVcr = new VCR<MockOpenAIChatCompletion>();
  const embeddingVcr = new VCR<MockOpenAIEmbedding>();

  const client = {
    chat: {
      completions: {
        create: async (...args: unknown[]): Promise<MockOpenAIChatCompletion> => {
          const recorded = chatVcr.get();
          if (recorded) return recorded;

          if (realClient?.chat) {
            return chatVcr.playOrRecord(() => realClient.chat!.completions.create(...args), {
              fixtureName: 'openai/chatCompletion',
            });
          }

          return { ...defaultChatCompletion, id: `chatcmpl-mock-${Date.now()}` };
        },
      },
    },
    embeddings: {
      create: async (...args: unknown[]): Promise<MockOpenAIEmbedding> => {
        const recorded = embeddingVcr.get();
        if (recorded) return recorded;

        if (realClient?.embeddings) {
          return embeddingVcr.playOrRecord(() => realClient.embeddings!.create(...args), {
            fixtureName: 'openai/embedding',
          });
        }

        return { ...defaultEmbedding };
      },
    },
    chatVcr,
    embeddingVcr,
  };

  return { client, chatVcr, embeddingVcr };
};

export type MockOpenAIClient = ReturnType<typeof createMockOpenAIClient>['client'];
