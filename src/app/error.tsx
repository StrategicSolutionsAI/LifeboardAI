"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  // Log the error to the console (or remote logging service)
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Global Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F6F6FC] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-red-50 p-3">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-[#171A1F] mb-2">Something went wrong</h1>
        <p className="text-[#6B7280] mb-6 whitespace-pre-wrap break-words">
          {error.message || "An unexpected error occurred."}
        </p>
        <Button
          onClick={() => reset()}
          className="w-full bg-[#5271F8] hover:bg-[#4060E8] text-white"
        >
          Try again
        </Button>
      </div>
    </div>
  );
} 