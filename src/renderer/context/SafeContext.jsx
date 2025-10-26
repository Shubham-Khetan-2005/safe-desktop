import React, { createContext, useState, useContext } from 'react';

const SafeContext = createContext();

export function SafeProvider({ children }) {
  const [keyPairs, setKeyPairs] = useState(null);
  const [safeInfo, setSafeInfo] = useState(null);
  const [serverPublicKey, setServerPublicKey] = useState(null);
  const [usePredefinedSafe, setUsePredefinedSafe] = useState(false);

  const value = {
    keyPairs, setKeyPairs,
    safeInfo, setSafeInfo,
    serverPublicKey, setServerPublicKey,
    usePredefinedSafe, setUsePredefinedSafe
  };

  return (
    <SafeContext.Provider value={value}>
      {children}
    </SafeContext.Provider>
  );
}

export function useSafe() {
  const context = useContext(SafeContext);
  if (context === undefined) {
    throw new Error('useSafe must be used within a SafeProvider');
  }
  return context;
}