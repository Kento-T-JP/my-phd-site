"use client";

import { useEffect } from "react";

function isSafariBrowser(ua: string): boolean {
  return (
    /Safari/i.test(ua) &&
    !/(Chrome|CriOS|Chromium|Edg|OPR|OPiOS|FxiOS|Firefox)/i.test(ua)
  );
}

export default function BrowserPerfMode() {
  useEffect(() => {
    const root = document.documentElement;
    if (isSafariBrowser(navigator.userAgent)) {
      root.dataset.browser = "safari";
      return;
    }
    if (root.dataset.browser === "safari") {
      delete root.dataset.browser;
    }
  }, []);

  return null;
}

