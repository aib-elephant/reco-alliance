import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import Providers from "@/components/Provider";
import { Toaster } from "react-hot-toast";

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Data Reconciliation Solution",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-main-bg">
        <Suspense fallback="loading...">
          <Providers>
            <main className="mx-auto max-w-6xl w-full space-y-5 p-4 md:p-6">
              {children}
            </main>
            <Toaster />
          </Providers>
        </Suspense>
      </body>
    </html>
  );
}
