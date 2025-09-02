'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Button from './ui/Button';

export default function BackButton() {
  const router = useRouter();
  return (
    <Button
      type="button"
      onClick={() => router.back()}
      className="px-4 py-2 bg-gray-300 text-black rounded"
    >
      戻る
    </Button>
  );
}
