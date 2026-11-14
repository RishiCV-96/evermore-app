// React's useSyncExternalStore outside a component, for scripts/check-auth.mjs: the first read
// subscribes, as a mounted screen would, and every read returns the store's value now. Only the stores
// whose values a check reads get this (see the resolve hook there); everything else uses React.
export function useSyncExternalStore(subscribe, getSnapshot) {
  subscribe(() => {});
  return getSnapshot();
}
