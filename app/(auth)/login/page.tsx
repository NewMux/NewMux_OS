"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Incorrect email or password.");
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <div className="w-full max-w-[380px] animate-slide-up">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-[22px] bg-gradient-to-br from-[#1c1c1e] to-[#3a3a3c] font-rounded text-[34px] font-bold text-white shadow-float dark:from-white dark:to-[#d1d1d6] dark:text-black">
          N
        </span>
        <h1 className="text-title1">Sign in to NEWMUX</h1>
        <p className="mt-1.5 text-subhead text-label-2">CRM, projects, finance and wiki — in one place.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="overflow-hidden rounded-[12px] bg-bg-elevated">
          <label className="sr-only" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            inputMode="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-[52px] w-full bg-transparent px-4 text-label shadow-[inset_0_-0.5px_0_rgb(var(--separator))] placeholder:text-label-3 focus:outline-none"
          />
          <label className="sr-only" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-[52px] w-full bg-transparent px-4 text-label placeholder:text-label-3 focus:outline-none"
          />
        </div>
        <p role="alert" className="mt-2 min-h-[20px] px-4 text-footnote text-ios-red">
          {error}
        </p>
        <Button type="submit" size="lg" disabled={loading || !email || !password} className="mt-2">
          {loading ? "Signing In…" : "Continue"}
        </Button>
      </form>
      <p className="mt-8 text-center text-footnote text-label-2">For the NEWMUX team only.</p>
    </div>
  );
}
