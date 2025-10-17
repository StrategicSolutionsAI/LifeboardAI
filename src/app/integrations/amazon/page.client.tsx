"use client";

import { useEffect, useState } from "react";
import { SidebarLayout } from "@/components/sidebar-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { useToast, ToastProvider } from "@/components/ui/use-toast";
import Link from "next/link";
import { invalidateIntegrationCaches } from "@/hooks/use-data-cache";

type PurchaseMode = "one-time" | "subscription";

interface AmazonConfigResponse {
  connected?: boolean;
  config?: {
    region?: string | null;
    defaultFrequencyDays?: number | string | null;
    defaultQuantity?: number | string | null;
    defaultPurchaseMode?: PurchaseMode | string | null;
  };
  updatedAt?: string | null;
  error?: string;
}

function AmazonIntegrationPageInner() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [region, setRegion] = useState("us");
  const [defaultFrequencyDays, setDefaultFrequencyDays] = useState("");
  const [defaultQuantity, setDefaultQuantity] = useState("");
  const [defaultPurchaseMode, setDefaultPurchaseMode] = useState<PurchaseMode>("one-time");

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch("/api/integrations/amazon/config", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = (await response.json()) as AmazonConfigResponse;
        if (cancelled) return;
        setConnected(Boolean(json.connected));
        setUpdatedAt(json.updatedAt ?? null);
        const config = json.config ?? {};
        const toNumberString = (value: unknown) => {
          if (typeof value === "number" && Number.isFinite(value)) {
            return value.toString();
          }
          if (typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed.length > 0 && Number.isFinite(Number(trimmed))) {
              return trimmed;
            }
          }
          return "";
        };
        setRegion(
          typeof config.region === "string" && config.region.trim().length > 0
            ? config.region.trim().toLowerCase()
            : "us",
        );
        setDefaultFrequencyDays(toNumberString(config.defaultFrequencyDays));
        setDefaultQuantity(toNumberString(config.defaultQuantity));
        setDefaultPurchaseMode(
          config.defaultPurchaseMode === "subscription" ? "subscription" : "one-time",
        );
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load Amazon integration config", error);
          setLoadError("Unable to load existing Amazon configuration.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedAccessKey = accessKey.trim();
    if (!trimmedAccessKey) {
      toast({
        title: "Access key required",
        description: "Enter your Amazon access key to connect the integration.",
        type: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        accessKey: trimmedAccessKey,
        secretKey: secretKey.trim(),
        region,
        defaultFrequencyDays: defaultFrequencyDays.trim(),
        defaultQuantity: defaultQuantity.trim(),
        defaultPurchaseMode,
      };
      const response = await fetch("/api/integrations/amazon/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      invalidateIntegrationCaches("amazon");
      setConnected(true);
      setUpdatedAt(new Date().toISOString());
      toast({
        title: "Amazon integration saved",
        description: "Your credentials and defaults were updated successfully.",
        type: "success",
      });
    } catch (error) {
      console.error("Failed to save Amazon integration", error);
      toast({
        title: "Unable to save integration",
        description: "Check your inputs and try again.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = connected ? "Connected" : "Not connected";
  const statusIcon = connected ? (
    <CheckCircle className="h-4 w-4 text-green-600" />
  ) : (
    <AlertCircle className="h-4 w-4 text-amber-500" />
  );

  return (
    <SidebarLayout>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" className="px-0 text-sm text-theme-primary hover:text-theme-primary">
            <Link href="/integrations" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to integrations
            </Link>
          </Button>
          <Badge variant={connected ? "default" : "secondary"} className={connected ? "bg-green-500 text-white hover:bg-green-600" : ""}>
            {statusLabel}
          </Badge>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {statusIcon}
            {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : "No credentials saved yet"}
          </div>
        </div>

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">Amazon integration</h1>
          <p className="text-sm text-gray-600">
            Store your Amazon credentials and preferred delivery defaults. These settings unlock one-click purchases and recurring deliveries from your shopping list.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Credentials & defaults</CardTitle>
            <CardDescription>
              Provide your access credentials and optional defaults used when scheduling Subscribe & Save deliveries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin text-theme-primary" />
                Loading current configuration…
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {loadError && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {loadError}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Access key<span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={accessKey}
                      onChange={(event) => setAccessKey(event.target.value)}
                      placeholder="AKIA..."
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Generated from your Amazon Selling Partner or Product Advertising API console.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Secret key
                    </label>
                    <Input
                      value={secretKey}
                      onChange={(event) => setSecretKey(event.target.value)}
                      placeholder="Leave blank to keep existing secret"
                      type="password"
                    />
                    <p className="text-xs text-gray-500">
                      Optional. We keep existing secrets untouched when left blank.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Region
                    </label>
                    <select
                      value={region}
                      onChange={(event) => setRegion(event.target.value)}
                      className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm shadow-sm focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
                    >
                      <option value="us">United States</option>
                      <option value="ca">Canada</option>
                      <option value="uk">United Kingdom</option>
                      <option value="eu">European Union</option>
                      <option value="jp">Japan</option>
                      <option value="au">Australia</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Default frequency (days)
                    </label>
                    <Input
                      value={defaultFrequencyDays}
                      onChange={(event) => setDefaultFrequencyDays(event.target.value)}
                      placeholder="30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Default quantity
                    </label>
                    <Input
                      value={defaultQuantity}
                      onChange={(event) => setDefaultQuantity(event.target.value)}
                      placeholder="1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Default purchase mode
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={defaultPurchaseMode === "one-time" ? "default" : "outline"}
                      onClick={() => setDefaultPurchaseMode("one-time")}
                    >
                      One-time
                    </Button>
                    <Button
                      type="button"
                      variant={defaultPurchaseMode === "subscription" ? "default" : "outline"}
                      onClick={() => setDefaultPurchaseMode("subscription")}
                    >
                      Subscription
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    These defaults fill in when you open the Amazon checkout drawer from your shopping list.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button type="submit" disabled={saving} className="min-w-[140px]">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {saving ? "Saving…" : connected ? "Update integration" : "Connect integration"}
                  </Button>
                  <p className="text-xs text-gray-500">
                    Credentials are stored securely in Supabase and scoped to your account.
                  </p>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}

export default function AmazonIntegrationPageClient() {
  return (
    <ToastProvider>
      <AmazonIntegrationPageInner />
    </ToastProvider>
  );
}
