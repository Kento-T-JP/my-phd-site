import React, { type ReactNode } from "react";

export default function PageMain({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={`${className} bg-black/20 backdrop-blur-sm rounded-md`}>
      {children}
    </main>
  );
}
