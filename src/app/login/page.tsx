"use client";
import { useEffect, useState } from "react";
import { signIn, getSession, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import useClickSound from "@/lib/useClickSound";

const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), { ssr: false });

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const sessionUser = session?.user as
    | { status?: string; isAdmin?: boolean }
    | undefined;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const { play } = useClickSound();
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/home";
  const callbackPath =
    rawCallbackUrl.startsWith("/") && !rawCallbackUrl.startsWith("//")
      ? rawCallbackUrl
      : "/home";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      if (!session?.gatePassed) {
        router.replace("/");
        return;
      }
      if (sessionUser?.status && sessionUser.status !== "active") {
        router.replace(`/access-status?status=${sessionUser.status}`);
        return;
      }
      if (session?.loginStage === "credentials") {
        router.replace(callbackPath);
        return;
      }
      if (session?.loginStage !== "google") {
        router.replace("/");
      }
    }
  }, [callbackPath, router, session?.gatePassed, session?.loginStage, sessionUser?.status, status]);

  if (!siteKey) {
    console.warn("ReCAPTCHA site key is not configured.");
  }

  if (status === "loading") {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <p className="text-cyan-100/85">Loading...</p>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await signIn("credentials", {
        redirect: false,
        callbackUrl: callbackPath,
        email,
        password,
        captcha: captchaToken,
      });
      if (res?.ok) {
        const session = await getSession();
        const currentUser = session?.user as
          | { status?: string; isAdmin?: boolean }
          | undefined;
        if (currentUser?.status && currentUser.status !== "active") {
          router.push(`/access-status?status=${currentUser.status}`);
          return;
        }
        if (currentUser?.isAdmin) {
          router.push("/admin");
        } else {
          router.push(callbackPath);
        }
      } else {
        setError("メールアドレスまたはパスワードが正しくありません");
      }
    } catch (err) {
      console.error(err);
      setError("ログイン処理でエラーが発生しました");
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1 className="text-2xl font-bold mb-2">アカウントログイン</h1>
        <p className="text-sm text-cyan-100/75 mb-6">
          メールアドレスとパスワードを入力してホーム画面へ進みます。
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 text-sm text-cyan-100/85">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm text-cyan-100/85">Password</label>
            <div className="flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8文字以上"
                required
              />
              <button
                type="button"
                className="ghost-btn ml-2 text-sm"
                onClick={() => {
                  play();
                  setShowPassword((prev) => !prev);
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {siteKey ? (
            isMounted ? (
              <ReCAPTCHA sitekey={siteKey} onChange={setCaptchaToken} />
            ) : null
          ) : (
            <div className="p-2 text-amber-300 border border-amber-400/70 rounded-md text-sm">
              reCAPTCHA site key is not configured
            </div>
          )}
          {error && <p className="status-error text-sm">{error}</p>}
          <button
            type="submit"
            className="primary-btn w-full disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={play}
          >
            Sign In
          </button>
        </form>
        <button
          type="button"
          className="mt-6 text-sm text-cyan-100/85 underline underline-offset-2"
          onClick={() => {
            play();
            router.back();
          }}
        >
          戻る
        </button>
      </section>
    </main>
  );
}
