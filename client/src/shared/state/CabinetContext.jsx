import { createContext, useContext } from 'react';
export const CabinetContext = createContext(null);
export function useCabinet() {
  const value = useContext(CabinetContext);
  if (!value) throw Error('Cabinet provider is missing');
  return value;
}
