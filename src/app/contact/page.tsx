'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ContactSchema, type ContactFormInput } from '@/lib/validation/contact';
import { getCsrfToken } from 'next-auth/react';
import useClickSound from '@/lib/useClickSound';

export default function ContactPage() {
  const [result, setResult] = useState<{ id: string } | { error: string } | null>(null);
  const [csrf, setCsrf] = useState('');
  const { play } = useClickSound();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormInput>({
    resolver: zodResolver(ContactSchema),
    defaultValues: {
      name: '',
      email: '',
      category: 'General',
      message: '',
      consent: false,
      honeypot: '',
      token: undefined,
    },
  });

  useEffect(() => {
    getCsrfToken().then((token) => setCsrf(token ?? ''));
  }, []);

  const onSubmit = async (data: ContactFormInput) => {
    setResult(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ id: json.id });
        reset();
      } else {
        setResult({ error: json.error || 'Failed to send message' });
      }
    } catch {
      setResult({ error: 'Failed to send message' });
    }
  };

  const messageValue = watch('message', '');
  const remaining = Math.max(0, 1000 - messageValue.length);

  return (
    <main className="py-2">
      <section className="mb-4 px-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">お問い合わせ</h1>
        <p className="text-sm text-cyan-100/75 mt-1">
          不具合報告・改善要望・その他のご連絡を受け付けています。
        </p>
      </section>
      <section className="glass-panel p-4 sm:p-6">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="flex flex-col">
            <label htmlFor="name" className="mb-1 text-cyan-100 text-sm font-medium">
              お名前
            </label>
            <input
              id="name"
              {...register('name')}
              className="form-input"
              placeholder="山田 太郎"
            />
            {errors.name && (
              <span className="text-red-300 text-sm mt-1">{errors.name.message}</span>
            )}
          </div>
          <div className="flex flex-col">
            <label htmlFor="email" className="mb-1 text-cyan-100 text-sm font-medium">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="form-input"
              placeholder="name@example.com"
            />
            {errors.email && (
              <span className="text-red-300 text-sm mt-1">{errors.email.message}</span>
            )}
          </div>
          <div className="flex flex-col">
            <label htmlFor="category" className="mb-1 text-cyan-100 text-sm font-medium">
              種別
            </label>
            <select id="category" {...register('category')} className="form-input">
              <option value="Bug">不具合報告</option>
              <option value="Feature">機能要望</option>
              <option value="General">その他</option>
            </select>
          </div>
          <div className="md:col-span-2 flex flex-col">
            <label htmlFor="message" className="mb-1 flex justify-between text-cyan-100 text-sm font-medium">
              <span>内容</span>
              <span className="text-xs text-cyan-100/70">
                {messageValue.length}/1000（残り {remaining} 文字）
              </span>
            </label>
            <textarea
              id="message"
              {...register('message')}
              maxLength={1000}
              rows={7}
              className="form-input resize-y min-h-32"
              placeholder="現象・再現手順・改善したい点などを記載してください。"
            />
            {errors.message && (
              <span className="text-red-300 text-sm mt-1">{errors.message.message}</span>
            )}
          </div>
          <div className="md:col-span-2">
            <label
              htmlFor="consent"
              className="flex items-start gap-2 rounded-lg border border-cyan-300/25 bg-slate-900/35 px-3 py-2"
            >
              <input
                id="consent"
                type="checkbox"
                {...register('consent')}
                className="mt-1 h-4 w-4 accent-cyan-500"
              />
              <span className="text-sm text-cyan-100/90">
                返信および運営改善のため、送信内容の保存に同意します。
              </span>
            </label>
            {errors.consent && (
              <span className="text-red-300 text-sm mt-1 block">{errors.consent.message}</span>
            )}
          </div>
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...register('honeypot')}
            className="hidden"
          />
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              onClick={play}
              className="primary-btn min-w-32 disabled:opacity-60"
            >
              {isSubmitting ? '送信中…' : '送信する'}
            </button>
            <span className="text-xs text-cyan-100/60">
              送信後、受付IDを表示します。
            </span>
          </div>
        </form>

        {result && (
          <div className="mt-4 rounded-lg border px-3 py-2 text-sm">
            {'id' in result ? (
              <p className="text-emerald-300">
                送信が完了しました。受付ID: <span className="font-semibold">{result.id}</span>
              </p>
            ) : (
              <p className="text-red-300">
                {result.error}{' '}
                <button
                  onClick={() => {
                    play();
                    setResult(null);
                  }}
                  className="underline text-cyan-200 underline-offset-2"
                >
                  閉じる
                </button>
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
