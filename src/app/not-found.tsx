"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-warm p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-[#fdf8f6] p-3">
            <Search className="h-8 w-8 text-[#bb9e7b]" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-[#314158] mb-2">Page not found</h1>
        <p className="text-[#6b7688] mb-6">The page you are looking for does not exist.</p>
        <Button
          onClick={() => router.push("/dashboard")}
          className="w-full bg-[#bb9e7b] hover:bg-[#9a7b5a] text-white"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
} 