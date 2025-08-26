"use client";
import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ReCAPTCHA from "react-google-recaptcha";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [captcha, setCaptcha] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
      captcha,
    });
    if (res?.ok) {
      const session = await getSession();
      if (session?.user?.isAdmin) {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } else {
      if (res?.error === "InvalidCaptcha") {
        setError("CAPTCHA 認証に失敗しました");
      } else {
        setError("メールアドレスまたはパスワードが正しくありません");
      }
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
          <input
            type="password"
            className="w-full p-2 border rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-red-600">{error}</p>}
        <ReCAPTCHA
          sitekey={process.env.RECAPTCHA_SITE_KEY ?? ""}
          onChange={(token) => setCaptcha(token || "")}
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Sign In
        </button>
      </form>
    </main>
  );
}

