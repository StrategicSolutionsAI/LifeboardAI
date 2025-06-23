"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F6F6FC] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-indigo-50 p-3">
            <Search className="h-8 w-8 text-indigo-500" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-[#171A1F] mb-2">Page not found</h1>
        <p className="text-[#6B7280] mb-6">The page you are looking for does not exist.</p>
        <Button
          onClick={() => router.push("/dashboard")}
          className="w-full bg-[#5271F8] hover:bg-[#4060E8] text-white"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
} 