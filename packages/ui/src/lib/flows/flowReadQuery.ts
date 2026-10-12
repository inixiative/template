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
      try {
        return (await read(context)).data;
      } catch (error) {
        const { navigation } = useAppStore.getState();
        if (navigation.flowId === id) {
          navigation.setFlowId(null);
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
