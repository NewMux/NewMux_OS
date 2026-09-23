export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-5 safe-top safe-bottom">
      {/* Soft colour behind the glass card, like a Lock Screen wallpaper. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[20%] -top-[25%] h-[70vmax] w-[70vmax] rounded-full bg-[radial-gradient(closest-side,rgb(var(--blue)/0.28),transparent)]" />
        <div className="absolute -bottom-[30%] -right-[20%] h-[70vmax] w-[70vmax] rounded-full bg-[radial-gradient(closest-side,rgb(var(--indigo)/0.22),transparent)]" />
      </div>
      <div className="relative w-full max-w-[400px]">{children}</div>
    </div>
  );
}
