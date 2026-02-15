"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ReCAPTCHA from "react-google-recaptcha";
import useClickSound from "@/lib/useClickSound";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const { play } = useClickSound();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, recaptchaToken: captchaToken }),
    });
    if (res.ok) {
      setSuccess("確認メールを送信しました。メールボックスを確認してください。");
      setEmail("");
      setPassword("");
    } else {
      const data = await res.json();
      setError(data.error || "登録に失敗しました");
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1 className="text-2xl font-bold mb-2">新規登録</h1>
        <p className="text-sm text-cyan-100/75 mb-6">
          登録後、確認メールを送信します。メール内リンクの確認後にログインできます。
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
                className="ghost-btn ml-2 px-3 text-sm"
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
          {error && <p className="status-error text-sm">{error}</p>}
          {success && <p className="status-success text-sm">{success}</p>}
          <ReCAPTCHA
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
            onChange={setCaptchaToken}
          />
          <button
            type="submit"
            className="primary-btn w-full disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={!captchaToken}
            onClick={play}
          >
            Sign Up
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
