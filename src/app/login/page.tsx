"use client";
import { useEffect, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), { ssr: false });

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!siteKey) {
    console.warn("ReCAPTCHA site key is not configured.");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return;
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      captcha: captchaToken,
    });
    if (res?.ok) {
      const session = await getSession();
      if (session?.user?.isAdmin) {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } else {
      setError("メールアドレスまたはパスワードが正しくありません");
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
              onClick={() => setShowPassword((prev) => !prev)}
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
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Sign In
        </button>
      </form>
    </main>
  );
}

