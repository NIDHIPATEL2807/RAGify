import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster } from "@/components/ui/toaster"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "PDF Q&A Assistant - AI-Powered Document Analysis",
  description:
    "Upload PDF documents and ask questions to get instant AI-powered answers. Perfect for analyzing reports, resumes, research papers, and more.",
  generator: "v0.app",
  keywords: ["PDF", "AI", "Q&A", "Document Analysis", "OpenAI"],
  authors: [{ name: "v0.app" }],
  viewport: "width=device-width, initial-scale=1",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <Suspense fallback={<div>Loading...</div>}>
          <ErrorBoundary>
            {children}
            <Toaster />
          </ErrorBoundary>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
