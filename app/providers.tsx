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
              "!rounded-full !border-0 !bg-bg-elevated/90 !px-5 !py-3 !text-subhead !font-medium !text-label !shadow-float backdrop-blur-xl",
            icon: "!text-accent",
          },
        }}
      />
    </SessionProvider>
  );
}
