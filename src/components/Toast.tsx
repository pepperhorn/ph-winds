import { useCallback, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000); }, []);
  const node = msg && (
    <div role="status" className="wc-toast fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-glow-strong">{msg}</div>
  );
  return { toast, node };
}
