"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/lib/hooks/useMediaQuery";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(async () => false);

/** `const confirm = useConfirm(); if (await confirm({...})) …` — an iOS action sheet / alert. */
export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | undefined>(undefined);
  const desktop = useIsDesktop();

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = undefined;
    setOpts(null);
  };

  const confirmLabel = opts?.confirmLabel ?? (opts?.destructive ? "Delete" : "Confirm");

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog.Root open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/30 animate-fade-in" />
          {desktop ? (
            // macOS/iPad-style alert
            <Dialog.Content className="glass-thick fixed left-1/2 top-1/2 z-[71] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] p-5 text-center animate-pop-in focus:outline-none">
              <Dialog.Title className="text-headline">{opts?.title}</Dialog.Title>
              {opts?.message && <Dialog.Description className="mt-1 text-footnote text-label-2">{opts.message}</Dialog.Description>}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button className="press h-11 rounded-full bg-fill/[0.14] text-body font-medium text-label" onClick={() => close(false)}>
                  Cancel
                </button>
                <button
                  autoFocus
                  className={cn("press h-11 rounded-full text-body font-semibold", opts?.destructive ? "bg-ios-red text-white" : "glass-prominent")}
                  onClick={() => close(true)}
                >
                  {confirmLabel}
                </button>
              </div>
            </Dialog.Content>
          ) : (
            // iPhone action sheet
            <Dialog.Content className="glass-thick fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-[71] rounded-sheet p-4 text-center animate-slide-up focus:outline-none">
              <Dialog.Title className="text-headline">{opts?.title}</Dialog.Title>
              {opts?.message && <Dialog.Description className="mt-1 text-footnote text-label-2">{opts.message}</Dialog.Description>}
              <div className="mt-4 grid gap-2">
                <button
                  className={cn("press h-[52px] w-full rounded-full text-headline", opts?.destructive ? "bg-ios-red text-white" : "glass-prominent")}
                  onClick={() => close(true)}
                >
                  {confirmLabel}
                </button>
                <button className="press h-[52px] w-full rounded-full bg-fill/[0.14] text-headline font-medium text-label" onClick={() => close(false)}>
                  Cancel
                </button>
              </div>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmContext.Provider>
  );
}
