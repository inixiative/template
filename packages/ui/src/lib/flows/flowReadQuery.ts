/**
 * @atlas
 * @kind factory
 * @partOf primitive:flows
 * @uses primitive:sdk
 */
import { flowRead, flowReadQueryKey } from '@template/sdk';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { toast } from '@template/ui/lib/toast';
import { useAppStore } from '@template/ui/store';

export const flowReadQueryKeyFor = (id: string) => flowReadQueryKey({ path: { id } });

export const flowReadQuery = (id: string) => {
  const read = apiQuery((opts: Parameters<typeof flowRead<true>>[0]) => flowRead<true>(opts));
  return {
    queryKey: flowReadQueryKeyFor(id),
    queryFn: async (context: Parameters<typeof read>[0]) => {
      const { navigation } = useAppStore.getState();
      try {
        const { data: flow } = await read(context);
        if (useAppStore.getState().navigation.flowId === id) navigation.receiveFlow(flow);
        return flow;
      } catch (error) {
        if (useAppStore.getState().navigation.flowId === id) {
          navigation.clearFlow();
          toast.message('Setup guide ended');
        }
        throw error;
      }
    },
    staleTime: 0,
    retry: false,
    throwOnError: false,
    meta: { skipErrorToast: true },
  };
};
