import { useContext } from 'react';
import PoolDataContext from '../contexts/PoolDataContext.jsx';

export function usePoolData() {
  const context = useContext(PoolDataContext);
  
  if (!context) {
    throw new Error('usePoolData must be used within a PoolDataProvider');
  }
  
  return context;
}



