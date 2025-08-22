import React from "react";

export default function LoadingSpinner() {
  return (
    <div className="flex justify-center p-4" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
