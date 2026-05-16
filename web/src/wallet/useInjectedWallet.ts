import { useCallback, useMemo, useState } from 'react';
import { connectInjectedWallet, getInjectedProvider, type WalletConnection } from './injectedWallet.js';

export function useInjectedWallet() {
  const provider = useMemo(() => getInjectedProvider(), []);
  const [connection, setConnection] = useState<WalletConnection>(provider ? { status: 'idle' } : { status: 'unavailable' });

  const connect = useCallback(async () => {
    setConnection({ status: 'connecting' });
    const next = await connectInjectedWallet(provider);
    setConnection(next);
    return next;
  }, [provider]);

  return { connection, connect };
}
