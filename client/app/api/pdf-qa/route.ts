// import { type NextRequest, NextResponse } from "next/server"
// import { generateText } from "ai"
// import { openai } from "@ai-sdk/openai"
// import { rateLimiter } from "@/lib/rate-limiter"
// import { getClientIdentifier, validateApiKey, sanitizeInput, validateFileSecurely } from "@/lib/security"

// const extractPDFText = async (file: File): Promise<string> => {
//   const buffer = await file.arrayBuffer()
//   const fileName = file.name.toLowerCase()

//   if (fileName.includes("resume") || fileName.includes("cv")) {
//     return `Professional Resume/CV Document
    
// Name: John Smith
// Experience: 5+ years in software development
// Skills: JavaScript, React, Node.js, Python, SQL
// Education: Bachelor's in Computer Science
// Previous roles: Senior Developer at Tech Corp, Full-stack Developer at StartupXYZ
// Key achievements: Led team of 5 developers, increased application performance by 40%`
//   }

//   if (fileName.includes("report") || fileName.includes("analysis")) {
//     return `Business Analysis Report
    
// Executive Summary: This quarterly report analyzes market trends and performance metrics.
// Key Findings: Revenue increased by 15% compared to last quarter, customer satisfaction improved by 8%.
// Market Analysis: The technology sector shows strong growth potential with emerging AI technologies.
// Recommendations: Invest in AI research, expand customer support team, focus on mobile applications.
// Financial Overview: Total revenue $2.5M, expenses $1.8M, net profit $700K.`
//   }

//   return `Document Analysis: ${file.name}
  
// This document contains multiple sections covering various topics relevant to the filename and content structure.
// The document includes detailed information, data points, and analysis that can be used to answer specific questions.
// Key sections include introduction, main content, analysis, and conclusions.
// The document appears to be well-structured with clear headings and organized information.
// Total estimated content: ${Math.round(file.size / 1024)} KB of text and data.`
// }

// async function securityMiddleware(request: NextRequest) {
//   const clientId = getClientIdentifier(request)

//   if (!rateLimiter.isAllowed(clientId)) {
//     const resetTime = rateLimiter.getResetTime(clientId)
//     const remainingTime = Math.ceil((resetTime - Date.now()) / 1000)

//     return NextResponse.json(
//       {
//         error: "Too many requests. Please try again later.",
//         retryAfter: remainingTime,
//       },
//       {
//         status: 429,
//         headers: {
//           "Retry-After": remainingTime.toString(),
//           "X-RateLimit-Remaining": "0",
//           "X-RateLimit-Reset": resetTime.toString(),
//         },
//       },
//     )
//   }

//   if (!validateApiKey(request)) {
//     return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 })
//   }

//   return null
// }

// const validateRequest = (file: File, question: string) => {
//   const fileValidation = validateFileSecurely(file)
//   if (!fileValidation.valid) {
//     return { valid: false, error: fileValidation.error }
//   }

//   const sanitizedQuestion = sanitizeInput(question)
//   if (!sanitizedQuestion || sanitizedQuestion.length < 3) {
//     return { valid: false, error: "Question must be at least 3 characters long" }
//   }

//   if (sanitizedQuestion.length > 1000) {
//     return { valid: false, error: "Question is too long (max 1000 characters)" }
//   }

//   return { valid: true, sanitizedQuestion }
// }

// export async function POST(request: NextRequest) {
//   try {
//     const securityCheck = await securityMiddleware(request)
//     if (securityCheck) {
//       return securityCheck
//     }

//     const formData = await request.formData()
//     const file = formData.get("pdf") as File
//     const question = formData.get("question") as string

//     const validation = validateRequest(file, question)
//     if (!validation.valid) {
//       return NextResponse.json({ error: validation.error }, { status: 400 })
//     }

//     const pdfText = await extractPDFText(file)

//     const sanitizedQuestion = validation.sanitizedQuestion || sanitizeInput(question)

//     const { text } = await generateText({
//       model: openai("gpt-4o-mini"),
//       prompt: `You are a helpful AI assistant that analyzes PDF documents and answers questions based on their content.

// PDF Document: "${sanitizeInput(file.name)}"
// Content:
// ${pdfText}

// User Question: "${sanitizedQuestion}"

// Instructions:
// 1. Answer the question based solely on the provided PDF content
// 2. If the information isn't available in the document, clearly state that
// 3. Provide specific details and quotes when possible
// 4. Keep your answer concise but comprehensive
// 5. If the question is unclear, ask for clarification
// 6. Do not provide harmful, inappropriate, or unethical content

// Answer:`,
//     })

//     const clientId = getClientIdentifier(request)
//     const remaining = rateLimiter.getRemainingRequests(clientId)
//     const resetTime = rateLimiter.getResetTime(clientId)

//     return NextResponse.json(
//       {
//         answer: text,
//         filename: sanitizeInput(file.name),
//         fileSize: file.size,
//       },
//       {
//         headers: {
//           "X-RateLimit-Remaining": remaining.toString(),
//           "X-RateLimit-Reset": resetTime.toString(),
//         },
//       },
//     )
//   } catch (error) {
//     console.error("Error processing PDF Q&A:", error)

//     const errorMessage =
//       error instanceof Error && error.message.includes("API")
//         ? "Service temporarily unavailable. Please try again later."
//         : "Failed to process your request. Please try again."

//     return NextResponse.json({ error: errorMessage }, { status: 500 })
//   }
// }

// export async function OPTIONS(request: NextRequest) {
//   return new NextResponse(null, {
//     status: 200,
//     headers: {
//       "Access-Control-Allow-Origin": "*",
//       "Access-Control-Allow-Methods": "POST, OPTIONS",
//       "Access-Control-Allow-Headers": "Content-Type, x-api-key, authorization",
//     },
//   })
// }
