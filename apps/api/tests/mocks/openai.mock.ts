import { VCR } from './VCR';

/**
 * Mock OpenAI chat completion response type
 */
export type MockOpenAIChatCompletion = {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
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

/**
 * Create a mock OpenAI client for testing.
 *
 * @example
 * const { client, chatVcr, embeddingVcr } = createMockOpenAIClient();
 * chatVcr.add({ id: 'chatcmpl-1', choices: [...], ... });
 */
export const createMockOpenAIClient = () => {
  const chatVcr = new VCR<MockOpenAIChatCompletion>();
  const embeddingVcr = new VCR<MockOpenAIEmbedding>();

  const client = {
    chat: {
      completions: {
        create: async (): Promise<MockOpenAIChatCompletion> => {
          const recorded = chatVcr.get();
          if (recorded) return recorded;

          return {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-4o',
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
        },
      },
    },
    embeddings: {
      create: async (): Promise<MockOpenAIEmbedding> => {
        const recorded = embeddingVcr.get();
        if (recorded) return recorded;

        // Generate deterministic 1536-dim embedding (text-embedding-3-small)
        const embedding = Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.01));

        return {
          object: 'list',
          data: [
            {
              object: 'embedding',
              index: 0,
              embedding,
            },
          ],
          model: 'text-embedding-3-small',
          usage: {
            prompt_tokens: 10,
            total_tokens: 10,
          },
        };
      },
    },
    chatVcr,
    embeddingVcr,
  };

  return { client, chatVcr, embeddingVcr };
};

export type MockOpenAIClient = ReturnType<typeof createMockOpenAIClient>['client'];
