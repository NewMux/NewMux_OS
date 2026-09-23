export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center bg-bg px-5 safe-top safe-bottom">{children}</div>;
}
