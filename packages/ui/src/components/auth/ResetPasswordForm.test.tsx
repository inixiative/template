/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { ResetPasswordForm } from '@template/ui/components/auth/ResetPasswordForm';
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

const submit = (view: ReturnType<typeof render>, password: string, confirm = password) => {
  fireEvent.change(view.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(view.getByLabelText('Confirm new password'), { target: { value: confirm } });
  fireEvent.submit(view.getByRole('button', { name: 'Set new password' }).closest('form')!);
};

describe('ResetPasswordForm', () => {
  test('sends the token and the new password, then hands back', async () => {
    respond = () => Response.json({ status: true });
    const onReset = mock(() => {});
    const view = render(
      <ResetPasswordForm token="reset-token" onReset={onReset} onRequestNewLink={() => {}} />,
    );
    submit(view, 'brand-new-password');

    await waitFor(() => expect(onReset).toHaveBeenCalledTimes(1));
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/api/auth/reset-password',
        body: { token: 'reset-token', newPassword: 'brand-new-password' },
      },
    ]);
  });

  test('a confirmation that does not match calls no server', async () => {
    const onReset = mock(() => {});
    const view = render(
      <ResetPasswordForm token="reset-token" onReset={onReset} onRequestNewLink={() => {}} />,
    );
    submit(view, 'brand-new-password', 'something-else');

    await waitFor(() => expect(view.getByRole('alert').textContent).toContain('do not match'));
    expect(requests).toEqual([]);
    expect(onReset).not.toHaveBeenCalled();
  });

  test('an expired token offers a new link instead of the form', async () => {
    respond = () =>
      Response.json({ code: 'INVALID_TOKEN', message: 'Invalid token' }, { status: 400 });
    const onReset = mock(() => {});
    const onRequestNewLink = mock(() => {});
    const view = render(
      <ResetPasswordForm
        token="used-token"
        onReset={onReset}
        onRequestNewLink={onRequestNewLink}
      />,
    );
    submit(view, 'brand-new-password');

    await waitFor(() => expect(view.getByRole('alert').textContent).toContain('expired'));
    expect(view.queryByLabelText('New password')).toBeNull();
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole('button', { name: 'Send a new link' }));
    expect(onRequestNewLink).toHaveBeenCalledTimes(1);
  });

  test('without a token the page goes straight to the new-link offer', () => {
    const view = render(<ResetPasswordForm onReset={() => {}} onRequestNewLink={() => {}} />);
    expect(view.getByRole('button', { name: 'Send a new link' })).not.toBeNull();
    expect(view.queryByLabelText('New password')).toBeNull();
  });

  test('another refusal shows the server message and keeps the form', async () => {
    respond = () =>
      Response.json({ code: 'PASSWORD_TOO_SHORT', message: 'Password too short' }, { status: 400 });
    const view = render(
      <ResetPasswordForm token="reset-token" onReset={() => {}} onRequestNewLink={() => {}} />,
    );
    submit(view, 'brand-new-password');

    await waitFor(() =>
      expect(view.getByRole('alert').textContent).toContain('Password too short'),
    );
    expect(view.queryByLabelText('New password')).not.toBeNull();
  });
});
