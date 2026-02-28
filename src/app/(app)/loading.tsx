import { Loader2 } from "lucide-react"

export default function AppLoading() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-theme-primary" />
    </div>
  )
}
