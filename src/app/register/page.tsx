"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReCAPTCHA from "react-google-recaptcha";
import useClickSound from "@/lib/useClickSound";
import { LEGAL_VERSION } from "@/lib/legal";

type RegisterDraft = {
  email: string;
  password: string;
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
};

let registerDraft: RegisterDraft | null = null;

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState(registerDraft?.email ?? "");
  const [password, setPassword] = useState(registerDraft?.password ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(
    registerDraft?.agreedToTerms ?? false
  );
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(
    registerDraft?.agreedToPrivacy ?? false
  );

  const { play } = useClickSound();

  useEffect(() => {
    registerDraft = { email, password, agreedToTerms, agreedToPrivacy };
  }, [email, password, agreedToTerms, agreedToPrivacy]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!agreedToTerms || !agreedToPrivacy) {
      setError("利用規約とプライバシーポリシーへの同意が必要です。");
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        recaptchaToken: captchaToken,
        agreedToTerms,
        agreedToPrivacy,
        legalVersion: LEGAL_VERSION,
      }),
    });
    if (res.ok) {
      setSuccess("確認メールを送信しました。メールボックスを確認してください。");
      setEmail("");
      setPassword("");
      setAgreedToTerms(false);
      setAgreedToPrivacy(false);
      registerDraft = null;
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
          <div className="space-y-2 rounded-lg border border-cyan-300/20 bg-slate-900/30 p-3 text-sm text-cyan-100/85">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <span>
                <Link href="/terms" className="underline underline-offset-2">
                  利用規約
                </Link>
                に同意します
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={agreedToPrivacy}
                onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              />
              <span>
                <Link href="/privacy" className="underline underline-offset-2">
                  プライバシーポリシー
                </Link>
                に同意します
              </span>
            </label>
            <p className="text-xs text-cyan-100/65">適用版: {LEGAL_VERSION}</p>
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
            disabled={!captchaToken || !agreedToTerms || !agreedToPrivacy}
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
