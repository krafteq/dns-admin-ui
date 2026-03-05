import { useState, useCallback } from 'react';

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const confirm = useCallback(
    (opts: { title: string; description: string; onConfirm: () => void }) => {
      setState({ open: true, ...opts });
    },
    []
  );

  const setOpen = useCallback((open: boolean) => {
    setState((s) => ({ ...s, open }));
  }, []);

  return { state, confirm, setOpen };
}
