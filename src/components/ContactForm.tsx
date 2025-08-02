"use client";

import { useState } from "react";
import { ContactSchema, type ContactForm } from "@/lib/validation/contact";

export default function ContactForm() {
  const [form, setForm] = useState<ContactForm>({
    name: "",
    email: "",
    message: "",
    category: "",
    consent: false,
    honeypot: "",
    token: undefined,
  });
  const [status, setStatus] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = e.target as any;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    const parsed = ContactSchema.safeParse(form);
    if (!parsed.success) {
      setStatus("入力内容を確認してください");
      return;
    }
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus("送信しました");
      setForm({
        name: "",
        email: "",
        message: "",
        category: "",
        consent: false,
        honeypot: "",
        token: undefined,
      });
    } else {
      setStatus(data.error || "送信に失敗しました");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block mb-1">名前</label>
        <input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div>
        <label className="block mb-1">メール</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          required
        />
      </div>
      <div>
        <label className="block mb-1">カテゴリ (任意)</label>
        <input
          type="text"
          name="category"
          value={form.category}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label className="block mb-1">メッセージ</label>
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          className="w-full p-2 border rounded"
          rows={5}
          maxLength={1000}
          required
        />
      </div>
      <div className="flex items-center">
        <input
          type="checkbox"
          name="consent"
          checked={form.consent}
          onChange={handleChange}
          className="mr-2"
          required
        />
        <span>データの保存に同意します</span>
      </div>
      {/* Honeypot field */}
      <input
        type="text"
        name="honeypot"
        value={form.honeypot}
        onChange={handleChange}
        className="hidden"
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        送信
      </button>
      {status && <p>{status}</p>}
    </form>
  );
}
