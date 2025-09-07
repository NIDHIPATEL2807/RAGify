"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Upload,
  MessageSquare,
  Loader2,
  X,
  RotateCcw,
  Lightbulb,
  User,
  Bot,
  HelpCircle,
  Zap,
  FileText,
  RefreshCw,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ConversationSkeleton } from "@/components/loading-skeleton"
import { toast } from "@/hooks/use-toast"

interface UploadedPDF {
  pdf_id: string
  filename: string
  chunks: number
  uploadedAt: Date
}

interface QAPair {
  id: string
  question: string
  answers: Array<{
    pdf_id: string
    filename: string
    answer: string
  }>
  timestamp: Date
}

export default function PDFQAApp() {
  const [uploadedPDFs, setUploadedPDFs] = useState<UploadedPDF[]>([])
  const [selectedPDFs, setSelectedPDFs] = useState<string[]>([])
  const [question, setQuestion] = useState("")
  const [conversation, setConversation] = useState<QAPair[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessingPDF, setIsProcessingPDF] = useState(false)
  const [isLoadingPDFs, setIsLoadingPDFs] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (conversation.length > 0) {
      conversationEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [conversation])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const loadPDFs = async () => {
    setIsLoadingPDFs(true)
    try {
      const response = await fetch("http://localhost:5000/list_pdfs")
      if (!response.ok) {
        throw new Error("Failed to load PDFs")
      }
      const data = await response.json()
      setUploadedPDFs(
        data.map((pdf: any) => ({
          ...pdf,
          uploadedAt: new Date(),
        })),
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load PDFs"
      setError(errorMessage)
    } finally {
      setIsLoadingPDFs(false)
    }
  }

  useEffect(() => {
    loadPDFs()
  }, [])

  const handleFileUpload = async (selectedFile: File) => {
    if (selectedFile && selectedFile.type === "application/pdf") {
      setIsProcessingPDF(true)
      setUploadProgress(0)
      setError("")

      try {
        const formData = new FormData()
        formData.append("file", selectedFile)

        setUploadProgress(25)

        const response = await fetch("http://localhost:5000/upload", {
          method: "POST",
          body: formData,
        })

        setUploadProgress(75)

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to upload PDF")
        }

        const data = await response.json()

        const newPDF: UploadedPDF = {
          pdf_id: data.pdf_id,
          filename: selectedFile.name,
          chunks: data.chunks,
          uploadedAt: new Date(),
        }

        setUploadedPDFs((prev) => [...prev, newPDF])
        setUploadProgress(100)

        toast({
          title: "PDF uploaded successfully",
          description: `${selectedFile.name} processed into ${data.chunks} chunks`,
        })

        setTimeout(() => {
          setIsProcessingPDF(false)
          setUploadProgress(0)
        }, 500)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to process PDF file"
        setError(errorMessage)
        setIsProcessingPDF(false)
        setUploadProgress(0)
      }
    } else {
      setError("Please select a valid PDF file")
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      handleFileUpload(selectedFile)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragOver(false)

    const droppedFile = event.dataTransfer.files[0]
    if (droppedFile) {
      handleFileUpload(droppedFile)
    }
  }

  const handlePDFSelection = (pdfId: string, checked: boolean) => {
    if (checked) {
      setSelectedPDFs((prev) => [...prev, pdfId])
    } else {
      setSelectedPDFs((prev) => prev.filter((id) => id !== pdfId))
    }
  }

  const clearConversation = () => {
    setConversation([])
    toast({
      title: "Conversation cleared",
      description: "Start fresh with new questions",
    })
  }

  const handleSubmitQuestion = async () => {
    if (selectedPDFs.length === 0 || !question.trim()) {
      setError("Please select at least one PDF and enter a question")
      return
    }

    setIsLoading(true)
    setError("")
    const currentQuestion = question.trim()
    setQuestion("")

    try {
      const answers = await Promise.all(
        selectedPDFs.map(async (pdfId) => {
          const response = await fetch("http://localhost:5000/ask", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pdf_id: pdfId,
              question: currentQuestion,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "Failed to process question")
          }

          const data = await response.json()
          const pdf = uploadedPDFs.find((p) => p.pdf_id === pdfId)

          return {
            pdf_id: pdfId,
            filename: pdf?.filename || "Unknown PDF",
            answer: data.answer,
          }
        }),
      )

      const newQAPair: QAPair = {
        id: Date.now().toString(),
        question: currentQuestion,
        answers,
        timestamp: new Date(),
      }

      setConversation((prev) => [...prev, newQAPair])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get answer. Please try again."
      setError(errorMessage)
      setQuestion(currentQuestion)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestedQuestion = (suggestedQuestion: string) => {
    setQuestion(suggestedQuestion)
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSubmitQuestion()
    }
  }

  const getSuggestedQuestions = () => {
    return [
      "What is the main topic of the selected documents?",
      "Can you summarize the key points?",
      "What are the most important details?",
      "Compare the main themes across documents",
    ]
  }



  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-b from-primary/5 to-transparent">
          <div className="container mx-auto px-4 py-12 max-w-6xl">
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-4xl font-bold text-foreground text-balance">PDF Q&A Assistant</h1>
              </div>
              <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
                Upload multiple PDF documents and ask questions to get instant answers powered by Google Gemini AI.
                Compare insights across different documents.
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 pb-8 max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              {/* PDF Upload Section */}
              <Card className="h-fit transition-all duration-200 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    Upload PDF
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Upload multiple PDFs for analysis and comparison</p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                  <CardDescription>Upload PDF documents to analyze with Gemini AI</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer ${
                      isDragOver
                        ? "border-primary bg-primary/5 scale-[1.02]"
                        : "border-border hover:border-primary/50 hover:bg-primary/2"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload
                      className={`h-8 w-8 mx-auto mb-2 transition-colors ${
                        isDragOver ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag and drop your PDF here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">Maximum file size: 10MB</p>
                  </div>

                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />

                  {isProcessingPDF && (
                    <div className="space-y-3 animate-in fade-in-50">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing PDF...
                        </span>
                        <span className="text-muted-foreground font-medium">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* PDF List and Selection Section */}
              <Card className="h-fit transition-all duration-200 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Uploaded PDFs
                    </div>
                    <Button variant="outline" size="sm" onClick={loadPDFs} disabled={isLoadingPDFs}>
                      {isLoadingPDFs ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </CardTitle>
                  <CardDescription>Select PDFs to ask questions about</CardDescription>
                </CardHeader>
                <CardContent>
                  {uploadedPDFs.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground font-medium">No PDFs uploaded yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Upload your first PDF to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {uploadedPDFs.map((pdf) => (
                        <div key={pdf.pdf_id} className="flex items-center space-x-3 p-3 border rounded-lg">
                          <Checkbox
                            id={pdf.pdf_id}
                            checked={selectedPDFs.includes(pdf.pdf_id)}
                            onCheckedChange={(checked) => handlePDFSelection(pdf.pdf_id, checked as boolean)}
                          />
                          <div className="flex-1 min-w-0">
                            <label htmlFor={pdf.pdf_id} className="text-sm font-medium cursor-pointer truncate block">
                              {pdf.filename}
                            </label>
                            <p className="text-xs text-muted-foreground">{pdf.chunks} chunks processed</p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {pdf.pdf_id.slice(0, 8)}...
                          </Badge>
                        </div>
                      ))}
                      {selectedPDFs.length > 0 && (
                        <div className="pt-2">
                          <Badge variant="outline" className="text-xs">
                            {selectedPDFs.length} PDF{selectedPDFs.length > 1 ? "s" : ""} selected
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Question Section */}
              <Card className="h-fit transition-all duration-200 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Ask a Question
                  </CardTitle>
                  <CardDescription>What would you like to know about the selected documents?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="question">Your Question</Label>
                    <Textarea
  id="question"
  placeholder="e.g., What are the main topics across these documents?"
  value={question}
  onChange={(e) => setQuestion(e.target.value)}
  onKeyDown={handleKeyPress}
  rows={4}
  className="resize-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
/>

                    <p className="text-xs text-muted-foreground">Press Enter to submit, Shift+Enter for new line</p>
                  </div>
              
<Button
  onClick={handleSubmitQuestion}
  disabled={false} // force enable
  className="w-full transition-all duration-200 hover:scale-[1.02]"
>
  {isLoading ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Processing...
    </>
  ) : (
    "Get Answer"
  )}
</Button>


                  {conversation.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearConversation}
                      className="w-full bg-transparent hover:bg-destructive/5 hover:text-destructive transition-colors"
                      disabled={isLoading}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Clear Conversation
                    </Button>
                  )}

                  {uploadedPDFs.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-medium">Suggested Questions</Label>
                      </div>
                      <div className="space-y-2">
                        {getSuggestedQuestions().map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            className="w-full text-left justify-start h-auto p-3 text-wrap bg-transparent hover:bg-primary/5 transition-colors"
                            onClick={() => handleSuggestedQuestion(suggestion)}
                            disabled={isLoading}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="transition-all duration-200 hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Conversation</span>
                  {conversation.length > 0 && (
                    <Badge variant="secondary" className="animate-in fade-in-50">
                      {conversation.length} Q&A
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Your questions and answers will appear here</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading && conversation.length === 0 ? (
                  <ConversationSkeleton />
                ) : conversation.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground font-medium">No questions asked yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Select PDFs and start asking questions</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[1000px] pr-4">
                    <div className="space-y-6">
                      {conversation.map((qa, index) => (
                        <div
                          key={qa.id}
                          className="space-y-3 animate-in fade-in-50 slide-in-from-bottom-2"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          {/* Question */}
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">You asked:</p>
                              <p className="text-sm bg-muted p-3 rounded-lg border-l-2 border-primary/20">
                                {qa.question}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {qa.answers.map((answer, answerIndex) => (
                              <div key={answer.pdf_id} className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
                                  <Bot className="h-4 w-4 text-secondary" />
                                </div>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-muted-foreground">AI Assistant:</p>
                                    <Badge variant="outline" className="text-xs">
                                      {answer.filename}
                                    </Badge>
                                  </div>
                                  <div className="text-sm bg-card border rounded-lg p-3 border-l-2 border-secondary/20">
                                    <p className="leading-relaxed">{answer.answer}</p>
                                  </div>
                                  {answerIndex === qa.answers.length - 1 && (
                                    <p className="text-xs text-muted-foreground">{qa.timestamp.toLocaleTimeString()}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="animate-in fade-in-50">
                          <ConversationSkeleton />
                        </div>
                      )}
                      <div ref={conversationEndRef} />
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mt-6 animate-in fade-in-50 slide-in-from-bottom-2">
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setError("")}
                  className="h-6 w-6 p-0 hover:bg-destructive/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}





// "use client"

// import type React from "react"

// import { useState, useRef, useEffect } from "react"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Textarea } from "@/components/ui/textarea"
// import {
//   Upload,
//   MessageSquare,
//   Loader2,
//   X,
//   CheckCircle,
//   RotateCcw,
//   Lightbulb,
//   User,
//   Bot,
//   HelpCircle,
//   Zap,
// } from "lucide-react"
// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { Progress } from "@/components/ui/progress"
// import { Badge } from "@/components/ui/badge"
// import { ScrollArea } from "@/components/ui/scroll-area"
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
// import { ConversationSkeleton } from "@/components/loading-skeleton"
// import { toast } from "@/hooks/use-toast"

// interface QAPair {
//   id: string
//   question: string
//   answer: string
//   timestamp: Date
// }

// export default function PDFQAApp() {
//   const [file, setFile] = useState<File | null>(null)
//   const [question, setQuestion] = useState("")
//   const [conversation, setConversation] = useState<QAPair[]>([])
//   const [isLoading, setIsLoading] = useState(false)
//   const [isProcessingPDF, setIsProcessingPDF] = useState(false)
//   const [uploadProgress, setUploadProgress] = useState(0)
//   const [error, setError] = useState("")
//   const [isDragOver, setIsDragOver] = useState(false)
//   const [isPDFUploaded, setIsPDFUploaded] = useState(false)
//   const [chunkCount, setChunkCount] = useState(0)
//   const fileInputRef = useRef<HTMLInputElement>(null)
//   const conversationEndRef = useRef<HTMLDivElement>(null)

//   useEffect(() => {
//     if (conversation.length > 0) {
//       conversationEndRef.current?.scrollIntoView({ behavior: "smooth" })
//     }
//   }, [conversation])

//   useEffect(() => {
//     if (error) {
//       const timer = setTimeout(() => setError(""), 5000)
//       return () => clearTimeout(timer)
//     }
//   }, [error])

//   const handleFileUpload = async (selectedFile: File) => {
//     if (selectedFile && selectedFile.type === "application/pdf") {
//       setIsProcessingPDF(true)
//       setUploadProgress(0)
//       setError("")
//       setIsPDFUploaded(false)

//       try {
//         const formData = new FormData()
//         formData.append("file", selectedFile)

//         setUploadProgress(25)

//         const response = await fetch("http://localhost:5000/upload", {
//           method: "POST",
//           body: formData,
//         })

//         setUploadProgress(75)

//         if (!response.ok) {
//           const errorData = await response.json()
//           throw new Error(errorData.error || "Failed to upload PDF")
//         }

//         const data = await response.json()

//         setFile(selectedFile)
//         setChunkCount(data.chunks)
//         setIsPDFUploaded(true)
//         setUploadProgress(100)

//         toast({
//           title: "PDF uploaded successfully",
//           description: `${selectedFile.name} processed into ${data.chunks} chunks`,
//         })

//         setTimeout(() => {
//           setIsProcessingPDF(false)
//           setUploadProgress(0)
//         }, 500)
//       } catch (err) {
//         const errorMessage = err instanceof Error ? err.message : "Failed to process PDF file"
//         setError(errorMessage)
//         setIsProcessingPDF(false)
//         setUploadProgress(0)
//         setIsPDFUploaded(false)
//       }
//     } else {
//       setError("Please select a valid PDF file")
//     }
//   }

//   const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const selectedFile = event.target.files?.[0]
//     if (selectedFile) {
//       handleFileUpload(selectedFile)
//     }
//   }

//   const handleDragOver = (event: React.DragEvent) => {
//     event.preventDefault()
//     setIsDragOver(true)
//   }

//   const handleDragLeave = (event: React.DragEvent) => {
//     event.preventDefault()
//     setIsDragOver(false)
//   }

//   const handleDrop = (event: React.DragEvent) => {
//     event.preventDefault()
//     setIsDragOver(false)

//     const droppedFile = event.dataTransfer.files[0]
//     if (droppedFile) {
//       handleFileUpload(droppedFile)
//     }
//   }

//   const removeFile = () => {
//     setFile(null)
//     setConversation([])
//     setIsPDFUploaded(false)
//     setChunkCount(0)
//     if (fileInputRef.current) {
//       fileInputRef.current.value = ""
//     }
//     toast({
//       title: "PDF removed",
//       description: "Upload a new PDF to continue",
//     })
//   }

//   const clearConversation = () => {
//     setConversation([])
//     toast({
//       title: "Conversation cleared",
//       description: "Start fresh with new questions",
//     })
//   }

//   const handleSubmitQuestion = async () => {
//     if (!isPDFUploaded || !question.trim()) {
//       setError("Please upload a PDF and enter a question")
//       return
//     }

//     setIsLoading(true)
//     setError("")
//     const currentQuestion = question.trim()
//     setQuestion("")

//     try {
//       const response = await fetch("http://localhost:5000/ask", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           question: currentQuestion,
//         }),
//       })

//       if (!response.ok) {
//         const errorData = await response.json()
//         throw new Error(errorData.error || "Failed to process question")
//       }

//       const data = await response.json()

//       const newQAPair: QAPair = {
//         id: Date.now().toString(),
//         question: currentQuestion,
//         answer: data.answer,
//         timestamp: new Date(),
//       }

//       setConversation((prev) => [...prev, newQAPair])
//     } catch (err) {
//       const errorMessage = err instanceof Error ? err.message : "Failed to get answer. Please try again."
//       setError(errorMessage)
//       setQuestion(currentQuestion)
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   const handleSuggestedQuestion = (suggestedQuestion: string) => {
//     setQuestion(suggestedQuestion)
//   }

//   const handleKeyPress = (event: React.KeyboardEvent) => {
//     if (event.key === "Enter" && !event.shiftKey) {
//       event.preventDefault()
//       handleSubmitQuestion()
//     }
//   }

//   const getSuggestedQuestions = (filename: string) => {
//     const name = filename.toLowerCase()
//     if (name.includes("resume") || name.includes("cv")) {
//       return [
//         "What are the key skills mentioned?",
//         "How many years of experience does this person have?",
//         "What is their educational background?",
//       ]
//     }
//     if (name.includes("report") || name.includes("analysis")) {
//       return ["What are the main findings?", "What are the key recommendations?", "What is the executive summary?"]
//     }
//     return [
//       "What is the main topic of this document?",
//       "Can you summarize the key points?",
//       "What are the most important details?",
//     ]
//   }

//   return (
//     <TooltipProvider>
//       <div className="min-h-screen bg-background">
//         <div className="bg-gradient-to-b from-primary/5 to-transparent">
//           <div className="container mx-auto px-4 py-12 max-w-6xl">
//             <div className="text-center mb-8">
//               <div className="flex items-center justify-center gap-3 mb-4">
//                 <div className="p-3 bg-primary/10 rounded-xl">
//                   <Zap className="h-8 w-8 text-primary" />
//                 </div>
//                 <h1 className="text-4xl font-bold text-foreground text-balance">PDF Q&A Assistant</h1>
//               </div>
//               <p className="text-lg text-muted-foreground text-pretty max-w-2xl mx-auto">
//                 Upload a PDF document and ask questions to get instant answers powered by Google Gemini AI. Perfect for
//                 analyzing reports, resumes, research papers, and more.
//               </p>
//             </div>
//           </div>
//         </div>

//         <div className="container mx-auto px-4 pb-8 max-w-6xl">
//           <div className="grid gap-6 lg:grid-cols-2">
//             <div className="space-y-6">
//               {/* PDF Upload Section */}
//               <Card className="h-fit transition-all duration-200 hover:shadow-md">
//                 <CardHeader>
//                   <CardTitle className="flex items-center gap-2">
//                     <Upload className="h-5 w-5 text-primary" />
//                     Upload PDF
//                     <Tooltip>
//                       <TooltipTrigger>
//                         <HelpCircle className="h-4 w-4 text-muted-foreground" />
//                       </TooltipTrigger>
//                       <TooltipContent>
//                         <p>Supports PDF files for AI analysis</p>
//                       </TooltipContent>
//                     </Tooltip>
//                   </CardTitle>
//                   <CardDescription>Select a PDF document to analyze with Gemini AI</CardDescription>
//                 </CardHeader>
//                 <CardContent className="space-y-4">
//                   <div
//                     className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer ${
//                       isDragOver
//                         ? "border-primary bg-primary/5 scale-[1.02]"
//                         : "border-border hover:border-primary/50 hover:bg-primary/2"
//                     }`}
//                     onDragOver={handleDragOver}
//                     onDragLeave={handleDragLeave}
//                     onDrop={handleDrop}
//                     onClick={() => fileInputRef.current?.click()}
//                   >
//                     <Upload
//                       className={`h-8 w-8 mx-auto mb-2 transition-colors ${
//                         isDragOver ? "text-primary" : "text-muted-foreground"
//                       }`}
//                     />
//                     <p className="text-sm text-muted-foreground mb-2">
//                       Drag and drop your PDF here, or click to browse
//                     </p>
//                     <p className="text-xs text-muted-foreground">Maximum file size: 10MB</p>
//                   </div>

//                   <Input
//                     ref={fileInputRef}
//                     type="file"
//                     accept=".pdf"
//                     onChange={handleFileInputChange}
//                     className="hidden"
//                   />

//                   {isProcessingPDF && (
//                     <div className="space-y-3 animate-in fade-in-50">
//                       <div className="flex items-center justify-between text-sm">
//                         <span className="text-muted-foreground flex items-center gap-2">
//                           <Loader2 className="h-4 w-4 animate-spin" />
//                           Processing PDF...
//                         </span>
//                         <span className="text-muted-foreground font-medium">{uploadProgress}%</span>
//                       </div>
//                       <Progress value={uploadProgress} className="h-2" />
//                     </div>
//                   )}

//                   {file && !isProcessingPDF && (
//                     <div className="animate-in fade-in-50 slide-in-from-bottom-2">
//                       <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
//                         <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
//                         <div className="flex-1 min-w-0">
//                           <p className="text-sm font-medium truncate">{file.name}</p>
//                           <p className="text-xs text-muted-foreground">
//                             {(file.size / 1024 / 1024).toFixed(2)} MB • {chunkCount} chunks processed
//                           </p>
//                         </div>
//                         <Tooltip>
//                           <TooltipTrigger asChild>
//                             <Button
//                               variant="ghost"
//                               size="sm"
//                               onClick={removeFile}
//                               className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
//                             >
//                               <X className="h-4 w-4" />
//                             </Button>
//                           </TooltipTrigger>
//                           <TooltipContent>
//                             <p>Remove PDF</p>
//                           </TooltipContent>
//                         </Tooltip>
//                       </div>

//                       <div className="space-y-3 mt-4">
//                         <div className="flex items-center gap-2">
//                           <Lightbulb className="h-4 w-4 text-primary" />
//                           <Label className="text-sm font-medium">Suggested Questions</Label>
//                         </div>
//                         <div className="space-y-2">
//                           {getSuggestedQuestions(file.name).map((suggestion, index) => (
//                             <Button
//                               key={index}
//                               variant="outline"
//                               size="sm"
//                               className="w-full text-left justify-start h-auto p-3 text-wrap bg-transparent hover:bg-primary/5 transition-colors"
//                               onClick={() => handleSuggestedQuestion(suggestion)}
//                               disabled={isLoading}
//                             >
//                               {suggestion}
//                             </Button>
//                           ))}
//                         </div>
//                       </div>
//                     </div>
//                   )}
//                 </CardContent>
//               </Card>

//               {/* Question Section */}
//               <Card className="h-fit transition-all duration-200 hover:shadow-md">
//                 <CardHeader>
//                   <CardTitle className="flex items-center gap-2">
//                     <MessageSquare className="h-5 w-5 text-primary" />
//                     Ask a Question
//                   </CardTitle>
//                   <CardDescription>What would you like to know about the document?</CardDescription>
//                 </CardHeader>
//                 <CardContent className="space-y-4">
//                   <div className="space-y-2">
//                     <Label htmlFor="question">Your Question</Label>
//                     <Textarea
//                       id="question"
//                       placeholder="e.g., What is the main topic of this document?"
//                       value={question}
//                       onChange={(e) => setQuestion(e.target.value)}
//                       onKeyPress={handleKeyPress}
//                       rows={4}
//                       className="resize-none transition-all duration-200 focus:ring-2 focus:ring-primary/20"
//                     />
//                     <p className="text-xs text-muted-foreground">Press Enter to submit, Shift+Enter for new line</p>
//                   </div>

//                   <Button
//                     onClick={handleSubmitQuestion}
//                     disabled={!isPDFUploaded || !question.trim() || isLoading || isProcessingPDF}
//                     className="w-full transition-all duration-200 hover:scale-[1.02]"
//                   >
//                     {isLoading ? (
//                       <>
//                         <Loader2 className="h-4 w-4 mr-2 animate-spin" />
//                         Processing...
//                       </>
//                     ) : (
//                       "Get Answer"
//                     )}
//                   </Button>

//                   {conversation.length > 0 && (
//                     <Button
//                       variant="outline"
//                       size="sm"
//                       onClick={clearConversation}
//                       className="w-full bg-transparent hover:bg-destructive/5 hover:text-destructive transition-colors"
//                       disabled={isLoading}
//                     >
//                       <RotateCcw className="h-4 w-4 mr-2" />
//                       Clear Conversation
//                     </Button>
//                   )}
//                 </CardContent>
//               </Card>
//             </div>

//             <Card className="transition-all duration-200 hover:shadow-md">
//               <CardHeader>
//                 <CardTitle className="flex items-center justify-between">
//                   <span>Conversation</span>
//                   {conversation.length > 0 && (
//                     <Badge variant="secondary" className="animate-in fade-in-50">
//                       {conversation.length} Q&A
//                     </Badge>
//                   )}
//                 </CardTitle>
//                 <CardDescription>Your questions and answers will appear here</CardDescription>
//               </CardHeader>
//               <CardContent>
//                 {isLoading && conversation.length === 0 ? (
//                   <ConversationSkeleton />
//                 ) : conversation.length === 0 ? (
//                   <div className="text-center py-12">
//                     <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
//                     <p className="text-muted-foreground font-medium">No questions asked yet</p>
//                     <p className="text-sm text-muted-foreground mt-1">Upload a PDF and start asking questions</p>
//                   </div>
//                 ) : (
//                   <ScrollArea className="h-[600px] pr-4">
//                     <div className="space-y-6">
//                       {conversation.map((qa, index) => (
//                         <div
//                           key={qa.id}
//                           className="space-y-3 animate-in fade-in-50 slide-in-from-bottom-2"
//                           style={{ animationDelay: `${index * 100}ms` }}
//                         >
//                           {/* Question */}
//                           <div className="flex gap-3">
//                             <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
//                               <User className="h-4 w-4 text-primary" />
//                             </div>
//                             <div className="flex-1 space-y-1">
//                               <p className="text-sm font-medium text-muted-foreground">You asked:</p>
//                               <p className="text-sm bg-muted p-3 rounded-lg border-l-2 border-primary/20">
//                                 {qa.question}
//                               </p>
//                             </div>
//                           </div>

//                           {/* Answer */}
//                           <div className="flex gap-3">
//                             <div className="flex-shrink-0 w-8 h-8 bg-secondary/10 rounded-full flex items-center justify-center">
//                               <Bot className="h-4 w-4 text-secondary" />
//                             </div>
//                             <div className="flex-1 space-y-1">
//                               <p className="text-sm font-medium text-muted-foreground">AI Assistant:</p>
//                               <div className="text-sm bg-card border rounded-lg p-3 border-l-2 border-secondary/20">
//                                 <p className="leading-relaxed">{qa.answer}</p>
//                               </div>
//                               <p className="text-xs text-muted-foreground">{qa.timestamp.toLocaleTimeString()}</p>
//                             </div>
//                           </div>
//                         </div>
//                       ))}
//                       {isLoading && (
//                         <div className="animate-in fade-in-50">
//                           <ConversationSkeleton />
//                         </div>
//                       )}
//                       <div ref={conversationEndRef} />
//                     </div>
//                   </ScrollArea>
//                 )}
//               </CardContent>
//             </Card>
//           </div>

//           {/* Error Display */}
//           {error && (
//             <Alert variant="destructive" className="mt-6 animate-in fade-in-50 slide-in-from-bottom-2">
//               <AlertDescription className="flex items-center justify-between">
//                 <span>{error}</span>
//                 <Button
//                   variant="ghost"
//                   size="sm"
//                   onClick={() => setError("")}
//                   className="h-6 w-6 p-0 hover:bg-destructive/20"
//                 >
//                   <X className="h-4 w-4" />
//                 </Button>
//               </AlertDescription>
//             </Alert>
//           )}
//         </div>
//       </div>
//     </TooltipProvider>
//   )
// }
