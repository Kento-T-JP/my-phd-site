"use client";
import { useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

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
    <main className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Register</h1>
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
        {success && <p className="text-green-600">{success}</p>}
        <ReCAPTCHA
          sitekey={process.env.RECAPTCHA_SITE_KEY || ""}
          onChange={setCaptchaToken}
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">
          Sign Up
        </button>
      </form>
    </main>
  );
}

