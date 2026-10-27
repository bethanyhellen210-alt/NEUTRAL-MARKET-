"use client";

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#08090b" />
        <meta name="description" content="NexusFX automated Forex trading workspace" />
        <title>NexusFX — Forex Trading OS</title>
      </head>
      <body>{children}</body>
    </html>
  );
}
