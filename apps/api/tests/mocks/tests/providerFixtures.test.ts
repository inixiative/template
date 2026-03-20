import { describe, expect, test } from 'bun:test';
import { createProviderFixtureLoader, loadFixture } from '../../helpers';
import type { MockAnthropicMessage } from '../anthropic.mock';
import type { MockOpenAIChatCompletion, MockOpenAIEmbedding } from '../openai.mock';

describe('loadFixture', () => {
  test('loads anthropic chat completion fixture', () => {
    const msg = loadFixture<MockAnthropicMessage>('anthropic/chatCompletion');
    expect(msg.type).toBe('message');
    expect(msg.role).toBe('assistant');
    expect(msg.id).toBe('msg_SANITIZED_000');
    expect(msg.content[0].type).toBe('text');
  });

  test('loads openai chat completion fixture', () => {
    const msg = loadFixture<MockOpenAIChatCompletion>('openai/chatCompletion');
    expect(msg.object).toBe('chat.completion');
    expect(msg.id).toBe('chatcmpl-SANITIZED_000');
    expect(msg.choices[0].finish_reason).toBe('stop');
  });

  test('loads openai embedding fixture', () => {
    const embed = loadFixture<MockOpenAIEmbedding>('openai/embedding');
    expect(embed.object).toBe('list');
    expect(embed.data[0].embedding).toBeInstanceOf(Array);
  });

  test('throws on missing fixture', () => {
    expect(() => loadFixture('nonexistent/fixture')).toThrow();
  });
});

describe('createProviderFixtureLoader', () => {
  test('loads provider-specific fixture', () => {
    const load = createProviderFixtureLoader('anthropic');
    const msg = load<MockAnthropicMessage>('chatCompletion');
    expect(msg.type).toBe('message');
  });

  test('falls back to shared fixture', () => {
    const load = createProviderFixtureLoader('anthropic');
    const err = load<{ error: { type: string } }>('errors/serverError');
    expect(err.error.type).toBe('server_error');
  });

  test('throws when neither provider nor shared fixture exists', () => {
    const load = createProviderFixtureLoader('google');
    expect(() => load('nonexistent')).toThrow(
      'Fixture not found: google/nonexistent.json',
    );
  });

  test('prefers provider fixture over shared', () => {
    const loadAnthropic = createProviderFixtureLoader('anthropic');
    const loadOpenai = createProviderFixtureLoader('openai');

    // Both have chatCompletion but with different shapes
    const anthropicMsg = loadAnthropic<MockAnthropicMessage>('chatCompletion');
    const openaiMsg = loadOpenai<MockOpenAIChatCompletion>('chatCompletion');

    expect(anthropicMsg.type).toBe('message');
    expect(openaiMsg.object).toBe('chat.completion');
  });
});
