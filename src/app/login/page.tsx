"use client";
import { useEffect, useState } from "react";
import { signIn, getSession, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import useClickSound from "@/lib/useClickSound";

const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), { ssr: false });

export default function LoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const { play } = useClickSound();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      if (!session?.gatePassed) {
        router.replace("/");
        return;
      }
      if (session?.user?.status && session.user.status !== "active") {
        router.replace(`/access-status?status=${session.user.status}`);
        return;
      }
      if (session?.loginStage === "credentials") {
        router.replace("/home");
        return;
      }
      if (session?.loginStage !== "google") {
        router.replace("/");
      }
    }
  }, [router, session?.gatePassed, session?.loginStage, session?.user?.status, status]);

  if (!siteKey) {
    console.warn("ReCAPTCHA site key is not configured.");
  }

  if (status === "loading") {
    return (
      <main className="p-4 sm:p-8 max-w-md mx-auto">
        <p>Loading...</p>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return;
    try {
      const res = await signIn("credentials", {
        redirect: false,
        callbackUrl: "/home",
        email,
        password,
        captcha: captchaToken,
      });
      if (res?.ok) {
        const session = await getSession();
        if (session?.user?.status && session.user.status !== "active") {
          router.push(`/access-status?status=${session.user.status}`);
          return;
        }
        if (session?.user?.isAdmin) {
          router.push("/admin");
        } else {
          router.push("/home");
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
    <main className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Email</label>
          <input
            type="email"
            className="w-full p-2 border rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block mb-1">Password</label>
          <div className="flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full p-2 border rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="ml-2 px-2 py-1 text-sm border rounded"
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
          <div className="p-2 text-yellow-700 border border-yellow-500 rounded">
            reCAPTCHA site key is not configured
          </div>
        )}
        {error && <p className="text-red-600">{error}</p>}
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={play}
        >
          Sign In
        </button>
      </form>
      <button
        type="button"
        className="mt-6 text-sm underline"
        onClick={() => {
          play();
          router.back();
        }}
      >
        戻る
      </button>
    </main>
  );
}
