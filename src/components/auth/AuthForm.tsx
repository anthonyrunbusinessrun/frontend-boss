"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { DEFAULT_SECTION } from "@/lib/sections";
import styles from "./auth.module.css";

/**
 * Sign-in / sign-up card (Screens/01 and 02).
 * There is no backend, so submitting only navigates into the workspace.
 * NEEDS CLARIFICATION: validation, error states, "Forgot Password?" destination and post-login landing page.
 */
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const isSignIn = mode === "sign-in";

  // The workspace is the only destination after authentication. Warm that one
  // route while the user fills the form instead of waiting after submission.
  useEffect(() => {
    router.prefetch(`/${DEFAULT_SECTION}`);
  }, [router]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(`/${DEFAULT_SECTION}`);
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image src="/brand/boss-logo.png" alt="" width={32} height={32} className={styles.logo} priority />
          <span className={styles.brandName}>BOSS</span>
        </div>
        <p className={styles.subtitle}>Business Operating Systems Solutions</p>
        <h1 className={styles.heading}>{isSignIn ? "Sign in to your account" : "Create your BOSS account"}</h1>
        <form className={styles.form} onSubmit={onSubmit}>
          {isSignIn ? (
            <>
              {/* The design shows these filled in; they are mock values. */}
              <TextField label="Email Address" type="email" name="email" autoComplete="username" defaultValue="rayland@ray-land.com" required />
              <TextField label="Password" reveal name="password" autoComplete="current-password" defaultValue="password" required />
              <a className={styles.forgot} href="#forgot-password">
                Forgot Password?
              </a>
              <Button type="submit" size="auth" className={styles.submit}>
                Sign In
              </Button>
            </>
          ) : (
            <>
              <TextField label="Full Name" name="name" placeholder="First and last name" autoComplete="name" required />
              <TextField label="Email Address" type="email" name="email" placeholder="name@company.com" autoComplete="email" required />
              <TextField label="Password" reveal name="password" placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required />
              <TextField label="Confirm Password" type="password" name="confirm" placeholder="Re-enter your password" autoComplete="new-password" required />
              <Button type="submit" size="auth" className={styles.submit}>
                Create Account
              </Button>
            </>
          )}
        </form>
        <p className={styles.switch}>
          {isSignIn ? "Don't have an account?" : "Already have an account?"}
          <Link href={isSignIn ? "/sign-up" : "/sign-in"}>{isSignIn ? "Sign Up" : "Sign In"}</Link>
        </p>
      </div>
    </main>
  );
}
