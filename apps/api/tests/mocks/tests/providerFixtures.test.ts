import { describe, expect, test } from 'bun:test';
import { createMockAnthropicClient } from '../anthropic.mock';
import { createMockOpenAIClient } from '../openai.mock';

describe('Anthropic mock client', () => {
  test('returns message from fixture', async () => {
    const { client } = createMockAnthropicClient();
    const msg = await client.messages.create({ model: 'claude-sonnet-4-6' });

    expect(msg.type).toBe('message');
    expect(msg.role).toBe('assistant');
    expect(msg.content[0].type).toBe('text');
    expect(msg.stop_reason).toBe('end_turn');
  });
});

describe('OpenAI mock client', () => {
  test('returns chat completion from fixture', async () => {
    const { client } = createMockOpenAIClient();
    const msg = await client.chat.completions.create({ model: 'gpt-4o' });

    expect(msg.object).toBe('chat.completion');
    expect(msg.choices[0].finish_reason).toBe('stop');
    expect(msg.choices[0].message.role).toBe('assistant');
  });

  test('returns embedding from fixture', async () => {
    const { client } = createMockOpenAIClient();
    const result = await client.embeddings.create({ model: 'text-embedding-3-small' });

    expect(result.object).toBe('list');
    expect(result.data[0].embedding).toBeInstanceOf(Array);
  });
});
