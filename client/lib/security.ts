import type { NextRequest } from "next/server"

export function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers (for production behind proxies)
  const forwarded = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  const cfConnectingIp = request.headers.get("cf-connecting-ip")

  const ip = forwarded?.split(",")[0] || realIp || cfConnectingIp || "unknown"

  // Include user agent for additional uniqueness
  const userAgent = request.headers.get("user-agent") || "unknown"

  return `${ip}-${userAgent.slice(0, 50)}`
}

export function validateApiKey(request: NextRequest): boolean {
  // For demo purposes, we'll use a simple API key check
  // In production, you'd want proper authentication
  const apiKey = request.headers.get("x-api-key")
  const authHeader = request.headers.get("authorization")

  // Allow requests without API key for demo (in production, make this required)
  if (!apiKey && !authHeader) {
    return true // Allow for demo purposes
  }

  // If API key is provided, validate it
  if (apiKey) {
    const validApiKeys = process.env.VALID_API_KEYS?.split(",") || []
    return validApiKeys.includes(apiKey)
  }

  // If authorization header is provided, validate bearer token
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7)
    const validTokens = process.env.VALID_TOKENS?.split(",") || []
    return validTokens.includes(token)
  }

  return false
}

export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters and limit length
  return input
    .replace(/[<>"'&]/g, "") // Remove HTML/script injection chars
    .replace(/\x00/g, "") // Remove null bytes
    .slice(0, 2000) // Limit length
    .trim()
}

export function validateFileSecurely(file: File): { valid: boolean; error?: string } {
  // Enhanced file validation
  if (!file) {
    return { valid: false, error: "File is required" }
  }

  // Check file type
  if (file.type !== "application/pdf") {
    return { valid: false, error: "Only PDF files are allowed" }
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    return { valid: false, error: "File size must be less than 10MB" }
  }

  // Check file name for suspicious patterns
  const fileName = file.name.toLowerCase()
  const suspiciousPatterns = [".exe", ".bat", ".cmd", ".scr", ".js", ".vbs"]
  if (suspiciousPatterns.some((pattern) => fileName.includes(pattern))) {
    return { valid: false, error: "File type not allowed" }
  }

  // Check for minimum file size (empty files)
  if (file.size < 100) {
    return { valid: false, error: "File appears to be empty or corrupted" }
  }

  return { valid: true }
}
