import { afterEach, describe, expect, it, mock } from 'bun:test';
import { useApiWebsocket } from '@template/ui/hooks/useApiWebsocket';
import { useAppStore } from '@template/ui/store';
import { cleanup, renderHook } from '@testing-library/react';

const initialState = useAppStore.getState();

describe('useApiWebsocket', () => {
  afterEach(() => {
    cleanup();
    useAppStore.setState(initialState);
  });

  it('connects on mount and disconnects on unmount', () => {
    const connect = mock(() => {});
    const disconnect = mock(() => {});
    useAppStore.setState({ websocket: { ...initialState.websocket, connect, disconnect } });

    const { unmount } = renderHook(() => useApiWebsocket());
    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
