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
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40 animate-fade-in" />
          {desktop ? (
            // macOS/iPad-style alert
            <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] w-[280px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-bg-elevated text-center shadow-float animate-scale-in focus:outline-none">
              <div className="px-4 pb-4 pt-5">
                <Dialog.Title className="text-headline">{opts?.title}</Dialog.Title>
                {opts?.message && <Dialog.Description className="mt-1 text-footnote text-label-2">{opts.message}</Dialog.Description>}
              </div>
              <div className="grid grid-cols-2 hairline-t">
                <button className="h-11 text-body text-accent active:bg-fill/20" onClick={() => close(false)}>
                  Cancel
                </button>
                <button
                  autoFocus
                  className={cn("h-11 border-l-[0.5px] border-separator text-body font-semibold active:bg-fill/20", opts?.destructive ? "text-ios-red" : "text-accent")}
                  onClick={() => close(true)}
                >
                  {confirmLabel}
                </button>
              </div>
            </Dialog.Content>
          ) : (
            // iPhone action sheet
            <Dialog.Content className="fixed inset-x-2 bottom-2 z-[71] pb-[env(safe-area-inset-bottom)] animate-slide-up focus:outline-none">
              <div className="overflow-hidden rounded-[14px] bg-bg-elevated/95 text-center backdrop-blur-xl">
                <div className="px-4 py-3.5">
                  <Dialog.Title className="text-footnote font-semibold text-label-2">{opts?.title}</Dialog.Title>
                  {opts?.message && <Dialog.Description className="mt-0.5 text-footnote text-label-2">{opts.message}</Dialog.Description>}
                </div>
                <button
                  className={cn("h-[57px] w-full text-title3 font-normal hairline-t active:bg-fill/20", opts?.destructive ? "text-ios-red" : "text-accent")}
                  onClick={() => close(true)}
                >
                  {confirmLabel}
                </button>
              </div>
              <button
                className="mt-2 h-[57px] w-full rounded-[14px] bg-bg-elevated text-title3 font-semibold text-accent active:bg-fill/20"
                onClick={() => close(false)}
              >
                Cancel
              </button>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmContext.Provider>
  );
}
