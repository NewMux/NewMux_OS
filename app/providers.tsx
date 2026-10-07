"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/ui/Confirm";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
      <Toaster
        position="top-center"
        offset="calc(env(safe-area-inset-top) + 10px)"
        toastOptions={{
          classNames: {
            toast:
              "!rounded-full !border-0 !bg-[rgb(var(--glass-fill)/0.82)] !px-5 !py-3 !text-subhead !font-medium !text-label !shadow-[inset_0_1px_0_rgb(255_255_255/var(--glass-highlight)),0_10px_30px_rgb(0_0_0/0.14)] backdrop-blur-xl backdrop-saturate-[1.9]",
            icon: "!text-accent",
          },
        }}
      />
    </SessionProvider>
  );
}
