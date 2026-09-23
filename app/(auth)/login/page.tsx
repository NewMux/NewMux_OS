"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    <div className="animate-slide-up">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/icons/icon.svg" alt="" width={88} height={88} unoptimized priority className="mb-5 rounded-[22.5%] shadow-[0_12px_32px_rgb(22_54_168/0.35)]" />
        <h1 className="text-title1">Sign in to NEWMUX</h1>
        <p className="mt-1.5 text-subhead text-label-2">CRM, projects, finance and wiki — in one place.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="glass overflow-hidden rounded-card">
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
            className="h-[54px] w-full bg-transparent px-5 text-label shadow-[inset_0_-0.5px_0_rgb(var(--separator))] placeholder:text-label-2 focus:outline-none"
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
            className="h-[54px] w-full bg-transparent px-5 text-label placeholder:text-label-2 focus:outline-none"
          />
        </div>
        <p role="alert" className="mt-2 min-h-[20px] px-5 text-footnote text-ios-red">
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
