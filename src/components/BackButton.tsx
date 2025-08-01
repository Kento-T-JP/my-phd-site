'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="px-4 py-2 bg-gray-300 text-black rounded"
    >
      戻る
    </button>
  );
}
