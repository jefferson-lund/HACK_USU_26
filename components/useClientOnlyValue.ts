// Native doesn't support server rendering, so always return client value.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return client;
}
