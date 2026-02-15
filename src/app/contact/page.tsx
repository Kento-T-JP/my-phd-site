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

  return (
    <main className="p-4 sm:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-cyan-400">Contact</h1>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <div className="flex flex-col">
          <label htmlFor="name" className="mb-1 text-cyan-300">
            Name
          </label>
          <input
            id="name"
            {...register('name')}
            className="p-2 rounded bg-blue-900 text-cyan-100 border border-cyan-500"
          />
          {errors.name && (
            <span className="text-red-400 text-sm mt-1">
              {errors.name.message}
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <label htmlFor="email" className="mb-1 text-cyan-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className="p-2 rounded bg-blue-900 text-cyan-100 border border-cyan-500"
          />
          {errors.email && (
            <span className="text-red-400 text-sm mt-1">
              {errors.email.message}
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <label htmlFor="category" className="mb-1 text-cyan-300">
            Category
          </label>
          <select
            id="category"
            {...register('category')}
            className="p-2 rounded bg-blue-900 text-cyan-100 border border-cyan-500"
          >
            <option value="Bug">Bug</option>
            <option value="Feature">Feature</option>
            <option value="General">General</option>
          </select>
        </div>
        <div className="flex flex-col md:col-span-2">
          <label
            htmlFor="message"
            className="mb-1 flex justify-between text-cyan-300"
          >
            <span>Message</span>
            <span className="text-xs">{messageValue.length}/1000</span>
          </label>
          <textarea
            id="message"
            {...register('message')}
            maxLength={1000}
            rows={6}
            className="p-2 rounded bg-blue-900 text-cyan-100 border border-cyan-500"
          />
          {errors.message && (
            <span className="text-red-400 text-sm mt-1">
              {errors.message.message}
            </span>
          )}
        </div>
        <div className="md:col-span-2 flex items-center space-x-2">
          <input
            id="consent"
            type="checkbox"
            {...register('consent')}
            className="h-4 w-4 accent-cyan-600"
          />
          <label htmlFor="consent" className="text-cyan-300">
            I consent to data storage
          </label>
          {errors.consent && (
            <span className="text-red-400 text-sm">
              {errors.consent.message}
            </span>
          )}
        </div>
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register('honeypot')}
          className="hidden"
        />
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            onClick={play}
            className="px-4 py-2 bg-cyan-600 text-blue-950 font-semibold rounded hover:bg-cyan-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
      {result && (
        <div className="mt-4">
          {'id' in result ? (
            <p className="text-green-400">
              Message sent! ID: {result.id}
            </p>
          ) : (
            <p className="text-red-400">
              {result.error}{' '}
              <button
                onClick={() => {
                  play();
                  setResult(null);
                }}
                className="underline text-cyan-400"
              >
                Retry
              </button>
            </p>
          )}
        </div>
      )}
    </main>
  );
}
