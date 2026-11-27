/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { ForgotPasswordForm } from '@template/ui/components/auth/ForgotPasswordForm';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

type Recorded = { method: string; path: string; body: Record<string, unknown> | null };

let requests: Recorded[];
let respond: () => Response;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;

beforeEach(() => {
  requests = [];
  respond = () => Response.json({ message: 'Unexpected request' }, { status: 500 });
  const intercept = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const text = await request.clone().text();
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    });
    return respond();
  };
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
});

const submit = (view: ReturnType<typeof render>, email: string) => {
  fireEvent.change(view.getByLabelText('Email'), { target: { value: email } });
  fireEvent.submit(view.getByRole('button', { name: 'Send reset link' }).closest('form')!);
};

describe('ForgotPasswordForm', () => {
  test('asks the server for a reset email and says to check the inbox', async () => {
    respond = () => Response.json({ status: true, message: 'sent' });
    const view = render(<ForgotPasswordForm />);
    submit(view, 'someone@example.test');

    await waitFor(() =>
      expect(view.getByRole('status').textContent).toContain('someone@example.test'),
    );
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/api/auth/request-password-reset',
        body: {
          email: 'someone@example.test',
          redirectTo: `${window.location.origin}/resetPassword`,
        },
      },
    ]);
  });

  test('a failed request shows the error and keeps the form', async () => {
    respond = () => Response.json({ message: 'Too many requests' }, { status: 429 });
    const view = render(<ForgotPasswordForm />);
    submit(view, 'someone@example.test');

    await waitFor(() => expect(view.getByRole('alert').textContent).toContain('Could not send'));
    expect(view.queryByRole('status')).toBeNull();
    expect((view.getByLabelText('Email') as HTMLInputElement).value).toBe('someone@example.test');
  });
});
