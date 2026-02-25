"use client";

import { useEffect, useMemo, useState } from "react";
import { SidebarLayout } from "@/components/sidebar-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  CalendarPlus,
  LayoutGrid,
  Loader2,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useToast, ToastProvider } from "@/components/ui/use-toast";
import { useBuckets } from "@/hooks/use-buckets";
import {
  ShoppingListItem,
  useShoppingList,
} from "@/hooks/use-shopping-list";
import {
  UNASSIGNED_BUCKET_ID,
  getBucketColorSync,
} from "@/lib/bucket-colors";
import { getUserPreferencesClient } from "@/lib/user-preferences";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { WidgetInstance } from "@/types/widgets";
import { useWidgets } from "@/hooks/use-widgets";

const UNSORTED_LABEL = "Unsorted";

const WIDGET_COLOR_OPTIONS = [
  "blue",
  "green",
  "red",
  "orange",
  "purple",
  "indigo",
  "amber",
  "teal",
  "rose",
  "cyan",
  "yellow",
  "sky",
  "emerald",
  "violet",
  "lime",
  "fuchsia",
  "gray",
  "slate",
  "stone",
] as const;

const WIDGET_COLOR_CLASS: Record<(typeof WIDGET_COLOR_OPTIONS)[number], string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  purple: "bg-amber-500",
  indigo: "bg-warm-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  yellow: "bg-yellow-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  lime: "bg-lime-500",
  fuchsia: "bg-fuchsia-500",
  gray: "bg-[#faf8f5]0",
  slate: "bg-slate-500",
  stone: "bg-stone-500",
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ShoppingListLayout() {
  const { toast } = useToast();
  const { buckets } = useBuckets();
  const {
    items,
    loading: loadingItems,
    error,
    createItem,
    deleteItem,
    togglePurchased,
    updateItem,
  } = useShoppingList();
  const { addWidget, updateWidget, removeWidget, widgetsByBucket } = useWidgets();
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({});
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("");
  const [newItemBucket, setNewItemBucket] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<string>("all");

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertItem, setConvertItem] = useState<ShoppingListItem | null>(null);
  const [convertCreateEvent, setConvertCreateEvent] = useState(false);
  const [convertCreateWidget, setConvertCreateWidget] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventDuration, setEventDuration] = useState("60");
  const [eventAllDay, setEventAllDay] = useState(true);
  const [widgetName, setWidgetName] = useState("");
  const [widgetBucket, setWidgetBucket] = useState<string>("");
  const [eventBucket, setEventBucket] = useState<string>("");
  const [widgetTarget, setWidgetTarget] = useState<number>(1);
  const [widgetColor, setWidgetColor] = useState<(typeof WIDGET_COLOR_OPTIONS)[number]>("indigo");
  const [widgetSchedule, setWidgetSchedule] = useState<boolean[]>([true, true, true, true, true, true, true]);
  const [taskEnabled, setTaskEnabled] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [itemBucket, setItemBucket] = useState<string>("");
  const [itemNeededBy, setItemNeededBy] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    if (!newItemBucket) {
      if (buckets.length > 0) {
        setNewItemBucket(buckets[0]);
      } else {
        setNewItemBucket(null);
      }
    }
  }, [buckets, newItemBucket]);

  useEffect(() => {
    async function loadBucketColors() {
      try {
        const prefs = await getUserPreferencesClient();
        if (prefs?.bucket_colors) {
          setBucketColors(prefs.bucket_colors);
        }
      } catch (err) {
        console.error("Failed to load bucket colors", err);
      }
    }
    loadBucketColors();

    if (typeof window === "undefined") {
      return;
    }

    const handleBucketColorsChanged = () => {
      loadBucketColors();
    };

    window.addEventListener("bucketColorsChanged", handleBucketColorsChanged);
    return () => {
      window.removeEventListener(
        "bucketColorsChanged",
        handleBucketColorsChanged,
      );
    };
  }, []);

  const bucketFilters = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];

    buckets.forEach((bucket) => {
      if (!seen.has(bucket)) {
        seen.add(bucket);
        list.push(bucket);
      }
    });

    items.forEach((item) => {
      if (item.bucket && !seen.has(item.bucket)) {
        seen.add(item.bucket);
        list.push(item.bucket);
      }
    });

    const hasUnsorted = items.some((item) => !item.bucket);
    if (hasUnsorted) {
      list.push(UNASSIGNED_BUCKET_ID);
    }

    return list;
  }, [buckets, items]);

  const availableWidgetBuckets = useMemo(
    () => bucketFilters.filter((bucket) => bucket !== UNASSIGNED_BUCKET_ID),
    [bucketFilters],
  );

  const widgetBucketOptions = useMemo(() => {
    const unique = new Set<string>();
    availableWidgetBuckets.forEach((bucket) => unique.add(bucket));
    if (convertItem?.bucket && convertItem.bucket !== UNASSIGNED_BUCKET_ID) {
      unique.add(convertItem.bucket);
    }
    if (widgetBucket) unique.add(widgetBucket);
    if (eventBucket) unique.add(eventBucket);
    if (itemBucket) unique.add(itemBucket);
    if (unique.size === 0) {
      unique.add("Shopping");
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableWidgetBuckets, convertItem?.bucket, widgetBucket, eventBucket, itemBucket]);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [items],
  );

  const filteredItems = useMemo(() => {
    if (selectedBucket === "all") {
      return sortedItems;
    }
    if (selectedBucket === UNASSIGNED_BUCKET_ID) {
      return sortedItems.filter((item) => !item.bucket);
    }
    return sortedItems.filter((item) => item.bucket === selectedBucket);
  }, [sortedItems, selectedBucket]);

  const totalOpen = items.length;

  const handleCreateItem = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) {
      toast({
        title: "Item name required",
        description: "Please add an item description before saving.",
        type: "warning",
      });
      return;
    }

    setIsCreating(true);
    try {
      await createItem({
        name: trimmed,
        bucket: newItemBucket || null,
        quantity: newItemQuantity.trim() || null,
      });
      setNewItemName("");
      setNewItemQuantity("");
      toast({
        title: "Item added",
        description: `${trimmed} added to ${
          newItemBucket ?? UNSORTED_LABEL
        }.`,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to create shopping list item", err);
      toast({
        title: "Unable to add item",
        description: "Please try again in a moment.",
        type: "error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePurchased = async (item: ShoppingListItem) => {
    try {
      await togglePurchased(item.id, !item.isPurchased);
      toast({
        title: item.isPurchased ? "Item restored" : "Marked as purchased",
        description: item.name,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to toggle purchased state", err);
      toast({
        title: "Unable to update item",
        description: "Please try again in a moment.",
        type: "error",
      });
    }
  };

  const handleDelete = async (item: ShoppingListItem) => {
    try {
      await deleteItem(item.id);
      toast({
        title: "Item removed",
        description: item.name,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to delete shopping list item", err);
      toast({
        title: "Unable to delete item",
        description: "Please try again in a moment.",
        type: "error",
      });
    }
  };

  const handleOpenConvert = (item: ShoppingListItem) => {
    setConvertItem(item);
    setConvertOpen(true);
  };

  useEffect(() => {
    if (!convertOpen || !convertItem) return;

    const today = new Date().toISOString().slice(0, 10);
    const defaultDate = convertItem.neededBy ?? today;
    const fallbackBucket =
      convertItem.bucket && convertItem.bucket !== UNASSIGNED_BUCKET_ID
        ? convertItem.bucket
        : availableWidgetBuckets[0] ?? buckets[0] ?? "Shopping";
    const numericQuantity = convertItem.quantity
      ? Number.parseInt(convertItem.quantity, 10)
      : NaN;

    setEventDate(defaultDate);
    setEventTime("");
    setEventDuration("60");
    setEventAllDay(true);
    setConvertCreateEvent(true);
    setConvertCreateWidget(true);
    setItemName(convertItem.name);
    setItemQuantity(convertItem.quantity ?? "");
    setItemNotes(convertItem.notes ?? "");
    setItemBucket(convertItem.bucket ?? "");
    setItemNeededBy(convertItem.neededBy ?? "");
    setWidgetName(`Buy ${convertItem.name}`);
    setWidgetBucket(convertItem.widgetBucket ?? fallbackBucket);
    setEventBucket(fallbackBucket);
    setWidgetTarget(Number.isFinite(numericQuantity) && numericQuantity > 0 ? numericQuantity : 1);
    setWidgetColor("indigo");
    setWidgetSchedule([true, true, true, true, true, true, true]);
    setTaskEnabled(Boolean(convertItem.taskId) || !convertItem.widgetInstanceId);

    if (convertItem.widgetInstanceId) {
      let detectedBucket = convertItem.widgetBucket ?? null;
      let detectedWidget: WidgetInstance | undefined;

      if (detectedBucket && widgetsByBucket[detectedBucket]?.length) {
        detectedWidget = widgetsByBucket[detectedBucket].find(
          (w) => w.instanceId === convertItem.widgetInstanceId,
        );
      }
      if (!detectedWidget) {
        for (const [bucketName, list] of Object.entries(widgetsByBucket)) {
          const match = list.find((w) => w.instanceId === convertItem.widgetInstanceId);
          if (match) {
            detectedWidget = match;
            detectedBucket = bucketName;
            break;
          }
        }
      }

      if (detectedWidget) {
        setWidgetName(detectedWidget.name ?? `Buy ${convertItem.name}`);
        setWidgetTarget(detectedWidget.target ?? 1);
        setWidgetColor(
          (WIDGET_COLOR_OPTIONS as readonly string[]).includes(detectedWidget.color as string)
            ? (detectedWidget.color as (typeof WIDGET_COLOR_OPTIONS)[number])
            : "indigo",
        );
        if (Array.isArray(detectedWidget.schedule) && detectedWidget.schedule.length === 7) {
          setWidgetSchedule([...detectedWidget.schedule]);
        }
        if (detectedBucket) {
          setWidgetBucket(detectedBucket);
        }
      }
    }
  }, [convertOpen, convertItem, availableWidgetBuckets, buckets, widgetsByBucket]);

  const handleConvertSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!convertItem) return;

    const trimmedItemName = itemName.trim() || convertItem.name;
    const quantityValue = itemQuantity.trim();
    const notesValue = itemNotes.trim();
    const normalizedItemBucket = itemBucket && itemBucket.trim().length > 0 ? itemBucket.trim() : "";
    const normalizedBucketValue = normalizedItemBucket ? normalizedItemBucket : null;
    const neededByValue = itemNeededBy || "";

    const itemUpdates: Record<string, any> = {};
    if (trimmedItemName !== convertItem.name) {
      itemUpdates.name = trimmedItemName;
    }
    const currentQuantity = convertItem.quantity ?? "";
    if (quantityValue !== currentQuantity) {
      itemUpdates.quantity = quantityValue ? quantityValue : null;
    }
    const currentNotes = convertItem.notes ?? "";
    if (notesValue !== currentNotes) {
      itemUpdates.notes = notesValue ? notesValue : null;
    }
    const currentBucket = convertItem.bucket ?? null;
    if ((normalizedBucketValue ?? null) !== currentBucket) {
      itemUpdates.bucket = normalizedBucketValue;
    }
    const currentNeededBy = convertItem.neededBy ?? null;
    if ((neededByValue || null) !== currentNeededBy) {
      itemUpdates.neededBy = neededByValue ? neededByValue : null;
    }

    const wantsEvent = convertCreateEvent || Boolean(convertItem.calendarEventId);
    const wantsWidget = convertCreateWidget || Boolean(convertItem.widgetInstanceId);
    const wantsTask = taskEnabled || Boolean(convertItem.taskId);

    if (!wantsEvent && !wantsWidget && !wantsTask && Object.keys(itemUpdates).length === 0) {
      toast({
        title: "Nothing to update",
        description: "Adjust the item, event, widget, or task settings before saving.",
        type: "warning",
      });
      return;
    }

    if (wantsEvent && !eventDate) {
      toast({
        title: "Date required",
        description: "Set a date for the calendar event.",
        type: "warning",
      });
      return;
    }

    if (wantsEvent && !eventAllDay && !eventTime) {
      toast({
        title: "Time required",
        description: "Add a time or mark the event as all-day.",
        type: "warning",
      });
      return;
    }

    if (wantsWidget && !widgetBucket) {
      toast({
        title: "Bucket required",
        description: "Pick a dashboard bucket for the widget.",
        type: "warning",
      });
      return;
    }

    if (wantsWidget && widgetSchedule.every((day) => !day)) {
      toast({
        title: "Schedule required",
        description: "Select at least one day for the widget schedule.",
        type: "warning",
      });
      return;
    }

    const widgetTitle = widgetName.trim() || trimmedItemName;
    const fallbackBucket =
      normalizedItemBucket ||
      eventBucket ||
      convertItem.widgetBucket ||
      convertItem.bucket ||
      widgetBucket ||
      "Shopping";
    const bucketForWidget = widgetBucket || fallbackBucket;
    const eventBucketFinal = eventBucket || normalizedItemBucket || convertItem.bucket || bucketForWidget;
    const taskBucket =
      eventBucketFinal ||
      bucketForWidget ||
      normalizedBucketValue ||
      convertItem.bucket ||
      null;
    const taskDueDate = eventDate || neededByValue || convertItem.neededBy || null;
    const durationMinutesValue = Number.parseInt(eventDuration || "0", 10);
    const normalizedDuration =
      !eventAllDay && Number.isFinite(durationMinutesValue) && durationMinutesValue > 0
        ? durationMinutesValue
        : null;
    const taskAllDay = eventAllDay || !eventTime;
    const taskHourSlot = !taskAllDay && eventTime ? eventTime : null;

    setIsConverting(true);
    const updates: Record<string, string | null> = { ...itemUpdates };
    const summary: string[] = [];
    const nowIso = new Date().toISOString();

    let taskId = convertItem.taskId ?? null;

    const headers = { "Content-Type": "application/json" };

    try {
      // Handle task creation / update / deletion first so widget can reference ID
      if (taskEnabled) {
        const taskPayload: Record<string, any> = {
          content: trimmedItemName,
          bucket: taskBucket,
          due_date: taskDueDate,
          all_day: taskAllDay,
          hour_slot: taskHourSlot,
          repeat_rule: "none",
        };

        if (taskId) {
          const response = await fetch("/api/tasks", {
            method: "PATCH",
            credentials: "same-origin",
            headers,
            body: JSON.stringify({ id: taskId, ...taskPayload }),
          });
          if (!response.ok) {
            throw new Error(await response.text());
          }
        } else {
          const response = await fetch("/api/tasks", {
            method: "POST",
            credentials: "same-origin",
            headers,
            body: JSON.stringify(taskPayload),
          });
          if (!response.ok) {
            throw new Error(await response.text());
          }
          const json = await response.json();
          taskId = json?.task?.id ?? null;
          if (taskId) {
            updates.taskId = taskId;
            updates.taskCreatedAt = nowIso;
            summary.push("task");
          }
        }
      } else if (convertItem.taskId) {
        await fetch("/api/tasks/delete", {
          method: "DELETE",
          credentials: "same-origin",
          headers,
          body: JSON.stringify({ taskId: convertItem.taskId }),
        });
        updates.taskId = null;
        updates.taskCreatedAt = null;
      }

      if (wantsEvent) {
        const descriptionParts: string[] = [];
        if (quantityValue) descriptionParts.push(`Qty: ${quantityValue}`);
        if (notesValue) descriptionParts.push(notesValue);

        const response = await fetch("/api/calendar/events", {
          method: "POST",
          credentials: "same-origin",
          headers,
          body: JSON.stringify({
            title: trimmedItemName,
            description: descriptionParts.length > 0 ? descriptionParts.join(" • ") : null,
            date: eventDate,
            time: eventAllDay ? null : eventTime,
            durationMinutes: normalizedDuration,
            allDay: taskAllDay,
            bucket: eventBucketFinal ?? null,
            source: "shopping_list",
            externalId: `shopping-item-${convertItem.id}`,
          }),
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const json = await response.json();
        const eventId = json?.event?.id as string | undefined;
        if (eventId) {
          updates.calendarEventId = eventId;
          updates.calendarEventCreatedAt = convertItem.calendarEventCreatedAt ?? nowIso;
          summary.push(convertItem.calendarEventId ? "updated event" : "calendar event");
        }
      }

      if (wantsWidget) {
        const description =
          quantityValue.length > 0
            ? `Quantity: ${quantityValue}`
            : notesValue || "Auto-created from shopping list";

        const linkedTaskConfig = taskEnabled
          ? {
              enabled: true,
              title: trimmedItemName,
              bucket: taskBucket ?? undefined,
              dueDate: taskDueDate ?? undefined,
              allDay: taskAllDay,
              startTime: taskHourSlot ?? "",
              endTime: "",
              repeat: "none" as const,
            }
          : {
              enabled: false,
            };

        const buildWidgetPayload = (instanceId: string): WidgetInstance => ({
          id: "shopping-item",
          name: widgetTitle,
          description,
          icon: ShoppingCart,
          category: "shopping",
          unit: "item",
          units: ["item", "items"],
          defaultTarget: widgetTarget,
          target: widgetTarget,
          schedule: [...widgetSchedule],
          color: widgetColor,
          dataSource: "manual",
          createdAt: convertItem.widgetCreatedAt ?? nowIso,
          instanceId,
          linkedTaskId: taskEnabled && taskId ? taskId : undefined,
          linkedTaskSource: taskId ? "supabase" : undefined,
          linkedTaskAutoCreated: taskEnabled,
          linkedTaskTitle: trimmedItemName,
          linkedTaskConfig,
        });

        let existingWidgetBucket = convertItem.widgetBucket ?? null;
        let existingWidget: WidgetInstance | undefined;

        if (convertItem.widgetInstanceId) {
          if (
            existingWidgetBucket &&
            widgetsByBucket[existingWidgetBucket]?.length
          ) {
            existingWidget = widgetsByBucket[existingWidgetBucket].find(
              (w) => w.instanceId === convertItem.widgetInstanceId,
            );
          }
          if (!existingWidget) {
            for (const [bucketName, list] of Object.entries(widgetsByBucket)) {
              const found = list.find(
                (w) => w.instanceId === convertItem.widgetInstanceId,
              );
              if (found) {
                existingWidget = found;
                existingWidgetBucket = bucketName;
                break;
              }
            }
          }
        }

        if (convertItem.widgetInstanceId && existingWidget) {
          const widgetUpdates: Partial<WidgetInstance> = {
            name: widgetTitle,
            description,
            target: widgetTarget,
            schedule: [...widgetSchedule],
            color: widgetColor,
            linkedTaskId: taskEnabled && taskId ? taskId : undefined,
            linkedTaskAutoCreated: taskEnabled,
            linkedTaskTitle: trimmedItemName,
            linkedTaskConfig,
          };

          if (existingWidgetBucket && existingWidgetBucket !== bucketForWidget) {
            removeWidget(existingWidgetBucket, convertItem.widgetInstanceId);
            addWidget(bucketForWidget, {
              ...existingWidget,
              ...widgetUpdates,
              instanceId: convertItem.widgetInstanceId,
              createdAt: existingWidget.createdAt ?? nowIso,
            });
          } else if (existingWidgetBucket) {
            updateWidget(existingWidgetBucket, convertItem.widgetInstanceId, widgetUpdates);
          } else {
            addWidget(bucketForWidget, buildWidgetPayload(convertItem.widgetInstanceId));
          }
          updates.widgetInstanceId = convertItem.widgetInstanceId;
          updates.widgetBucket =
            existingWidgetBucket && existingWidgetBucket === bucketForWidget
              ? existingWidgetBucket
              : bucketForWidget;
        } else {
          const instanceId =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? `shopping-${convertItem.id}-${crypto.randomUUID()}`
              : `shopping-${convertItem.id}-${Math.random().toString(36).slice(2)}`;

          const widgetInstance = buildWidgetPayload(instanceId);
          widgetInstance.createdAt = nowIso;
          addWidget(bucketForWidget, widgetInstance);
          updates.widgetInstanceId = instanceId;
          updates.widgetCreatedAt = nowIso;
          updates.widgetBucket = bucketForWidget;
          summary.push("dashboard widget");
        }
      }

      if (taskEnabled && taskId) {
        updates.taskId = taskId;
        updates.taskCreatedAt = convertItem.taskCreatedAt ?? nowIso;
      }

      const finalUpdates = Object.keys(updates).length > 0 ? updates : null;
      if (finalUpdates) {
        await updateItem(convertItem.id, finalUpdates);
      }

      toast({
        title: "Saved",
        description: summary.length > 0
          ? `Updated ${summary.join(" and ")} for ${trimmedItemName}.`
          : `Updated ${trimmedItemName}.`,
        type: "success",
      });

      setConvertOpen(false);
      setConvertItem(null);
    } catch (err) {
      console.error("Failed to convert shopping item", err);
      toast({
        title: "Save failed",
        description: "We couldn't complete that update. Please try again.",
        type: "error",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const renderBucketBadge = (bucketValue: string | null) => {
    const isUnsorted = !bucketValue;
    const label = isUnsorted ? UNSORTED_LABEL : bucketValue;
    const color = getBucketColorSync(
      isUnsorted ? UNASSIGNED_BUCKET_ID : bucketValue,
      bucketColors,
    );

    return (
      <Badge
        className="border-0 text-xs font-medium"
        style={{
          backgroundColor: hexToRgba(color, 0.15),
          color,
        }}
      >
        {label}
      </Badge>
    );
  };

  return (
    <SidebarLayout>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-12">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase text-theme-primary">
            Shopping
          </p>
          <h1 className="text-3xl font-semibold text-[#314158]">
            Shopping list
          </h1>
          <p className="text-base text-[#596881]">
            One streamlined list for everything you need, tagged with the same
            life buckets that organize your dashboard.
          </p>
        </header>

        <Card className="border-none bg-white shadow-sm">
          <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-[#314158]">
                Quick add
              </CardTitle>
              <p className="text-sm text-[#8e99a8]">
                Capture an item and optionally tag it with a bucket.
              </p>
            </div>
            <div className="text-sm text-[#8e99a8]">
              {loadingItems ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-theme-primary" />
                  Loading items…
                </span>
              ) : (
                <>
                  <span className="font-medium text-[#314158]">
                    {totalOpen}
                  </span>{" "}
                  items open
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleCreateItem}
              className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr_auto]"
            >
              <Input
                placeholder="What do you need to pick up?"
                value={newItemName}
                onChange={(event) => setNewItemName(event.target.value)}
                disabled={isCreating}
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                    Bucket
                  </label>
                  <select
                    value={newItemBucket ?? ""}
                    onChange={(event) =>
                      setNewItemBucket(
                        event.target.value === "" ? null : event.target.value,
                      )
                    }
                    className="h-10 w-full rounded-md border border-[#dbd6cf] px-3 text-sm shadow-sm focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
                    disabled={isCreating}
                  >
                    <option value="">Unsorted</option>
                    {availableWidgetBuckets.map((bucket) => (
                      <option key={bucket} value={bucket}>
                        {bucket}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                    Quantity
                  </label>
                  <Input
                    placeholder="2 packs"
                    value={newItemQuantity}
                    onChange={(event) =>
                      setNewItemQuantity(event.target.value)
                    }
                    disabled={isCreating}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="h-10 w-full sm:w-auto"
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add item
                  </>
                )}
              </Button>
            </form>
            {error && (
              <p className="mt-2 text-sm text-red-600">
                We couldn&apos;t load your shopping list. Try refreshing the
                page.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={selectedBucket === "all" ? "default" : "ghost"}
            onClick={() => setSelectedBucket("all")}
            className={cn(
              "h-9 rounded-full px-4 text-sm",
              selectedBucket === "all"
                ? "bg-theme-primary text-white hover:bg-theme-primary/90"
                : "border border-[#dbd6cf] bg-white text-[#4a5568]",
            )}
          >
            All items
          </Button>
          {bucketFilters.map((bucket) => {
            const isUnsorted = bucket === UNASSIGNED_BUCKET_ID;
            const label = isUnsorted ? UNSORTED_LABEL : bucket;
            const isActive = selectedBucket === bucket;
            const color = getBucketColorSync(
              isUnsorted ? UNASSIGNED_BUCKET_ID : bucket,
              bucketColors,
            );

            return (
              <Button
                key={bucket}
                type="button"
                variant={isActive ? "default" : "ghost"}
                onClick={() => setSelectedBucket(bucket)}
                className={cn(
                  "h-9 rounded-full px-4 text-sm",
                  isActive
                    ? "text-white"
                    : "border border-[#dbd6cf] bg-white text-[#4a5568]",
                )}
                style={
                  isActive
                    ? { backgroundColor: color }
                    : { color, borderColor: `${color}33` }
                }
              >
                {label}
              </Button>
            );
          })}
        </div>

        <Card className="border border-[#dbd6cf]/60 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-lg font-semibold text-[#314158]">
              Items
            </CardTitle>
            <span className="text-sm text-[#8e99a8]">
              {filteredItems.length} shown
            </span>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-[#dbd6cf] p-6 text-center text-sm text-[#8e99a8]">
                {selectedBucket === "all"
                  ? "Add your first item to get started."
                  : "No items in this bucket yet."}
              </div>
            ) : (
              filteredItems.map((item) => {
                const color = getBucketColorSync(
                  item.bucket ?? UNASSIGNED_BUCKET_ID,
                  bucketColors,
                );
                const conversionComplete =
                  Boolean(item.calendarEventId) && Boolean(item.widgetInstanceId);

                return (
                  <div
                    key={item.id}
                    className="flex items-start justify-between rounded-lg border border-[#dbd6cf]/60 bg-[#faf8f5] p-3 hover:border-[#dbd6cf]"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={item.isPurchased}
                        onCheckedChange={() => handleTogglePurchased(item)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-[#314158]">
                            {item.name}
                          </p>
                          {renderBucketBadge(item.bucket)}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#8e99a8]">
                          {item.quantity && (
                            <span className="rounded-full bg-white px-2 py-0.5 shadow-sm">
                              Qty: {item.quantity}
                            </span>
                          )}
                          {item.neededBy && (
                            <span>Needed by {item.neededBy}</span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-[#8e99a8]/70">
                            <span
                              className="inline-flex h-2 w-2 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            Added{" "}
                            {new Date(item.createdAt).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.calendarEventId && (
                            <Badge className="flex items-center gap-1 bg-warm-50 text-warm-700">
                              <CalendarPlus className="h-3 w-3" />
                              Event linked
                            </Badge>
                          )}
                          {item.widgetInstanceId && (
                            <Badge className="flex items-center gap-1 bg-amber-50 text-amber-700">
                              <LayoutGrid className="h-3 w-3" />
                              Widget added
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-[#8e99a8]/70 hover:text-theme-primary"
                        onClick={() => handleOpenConvert(item)}
                        aria-label={`Edit ${item.name}`}
                        title={
                          conversionComplete
                            ? "Edit linked event or widget"
                            : "Convert to calendar event, widget, or both"
                        }
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-[#8e99a8]/70 hover:text-red-500"
                        onClick={() => handleDelete(item)}
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={convertOpen} onOpenChange={(open) => {
        setConvertOpen(open);
        if (!open) {
          setConvertItem(null);
        }
      }}>
        <SheetContent className="w-full sm:w-[520px]">
          <SheetHeader>
            <SheetTitle>
              {convertItem ? `Convert "${convertItem.name}"` : "Convert item"}
            </SheetTitle>
            <SheetDescription>
              Create a calendar event, dashboard widget, or both from this shopping item.
            </SheetDescription>
          </SheetHeader>
          {convertItem && (
            <form onSubmit={handleConvertSubmit} className="mt-6 space-y-6">
              <div className="space-y-3 rounded-lg border border-[#dbd6cf] bg-white p-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                    Item name
                  </label>
                  <Input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Item name"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                      Quantity
                    </label>
                    <Input
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      placeholder="e.g. 3 packs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                      Needed by
                    </label>
                    <Input
                      type="date"
                      value={itemNeededBy}
                      onChange={(e) => setItemNeededBy(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                    Bucket
                  </label>
                  <select
                    value={itemBucket}
                    onChange={(event) => setItemBucket(event.target.value)}
                    className="h-10 w-full rounded-md border border-[#dbd6cf] px-3 text-sm shadow-sm focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
                  >
                    <option value="">Unsorted</option>
                    {bucketFilters
                      .filter((bucket) => bucket !== UNASSIGNED_BUCKET_ID)
                      .map((bucket) => (
                        <option key={bucket} value={bucket}>
                          {bucket}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                    Notes
                  </label>
                  <textarea
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-[#dbd6cf] px-3 py-2 text-sm shadow-sm focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
                    placeholder="Optional details or reminders"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="convert-event"
                    checked={convertCreateEvent || Boolean(convertItem.calendarEventId)}
                    onCheckedChange={(checked) =>
                      setConvertCreateEvent(Boolean(checked))
                    }
                    disabled={Boolean(convertItem.calendarEventId)}
                  />
                  <label htmlFor="convert-event" className="text-sm font-medium text-[#314158]">
                    Create calendar event
                  </label>
                </div>
                {convertItem.calendarEventId && (
                  <p className="pl-7 text-xs text-[#8e99a8]">
                    This item already links to a calendar event.
                  </p>
                )}

                {(convertItem.calendarEventId || convertCreateEvent) && (
                  <div className="space-y-3 rounded-lg border border-[#dbd6cf] bg-white p-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                        Bucket
                      </label>
                      <select
                        value={eventBucket}
                        onChange={(e) => setEventBucket(e.target.value)}
                        className="h-10 w-full rounded-md border border-[#dbd6cf] px-3 text-sm shadow-sm focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
                      >
                        {widgetBucketOptions.map((bucket) => (
                          <option key={bucket} value={bucket}>
                            {bucket}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                          Date
                        </label>
                        <Input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                          Time
                        </label>
                        <Input
                          type="time"
                          value={eventTime}
                          onChange={(e) => {
                            setEventTime(e.target.value);
                            if (e.target.value) {
                              setEventAllDay(false);
                            }
                          }}
                          disabled={eventAllDay}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="event-all-day"
                        checked={eventAllDay}
                        onCheckedChange={(checked) => {
                          const next = Boolean(checked);
                          setEventAllDay(next);
                          if (next) {
                            setEventTime("");
                          }
                        }}
                      />
                      <label
                        htmlFor="event-all-day"
                        className="text-sm text-[#4a5568]"
                      >
                        Treat as all-day event
                      </label>
                    </div>
                    {!eventAllDay && (
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                          Duration (minutes)
                        </label>
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={eventDuration}
                          onChange={(e) => setEventDuration(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="convert-widget"
                    checked={convertCreateWidget || Boolean(convertItem.widgetInstanceId)}
                    onCheckedChange={(checked) =>
                      setConvertCreateWidget(Boolean(checked))
                    }
                    disabled={Boolean(convertItem.widgetInstanceId)}
                  />
                  <label htmlFor="convert-widget" className="text-sm font-medium text-[#314158]">
                    Create dashboard widget
                  </label>
                </div>
                {convertItem.widgetInstanceId && (
                  <p className="pl-7 text-xs text-[#8e99a8]">
                    This item already has a dashboard widget.
                  </p>
                )}

                {(convertItem.widgetInstanceId || convertCreateWidget) && (
                  <div className="space-y-3 rounded-lg border border-[#dbd6cf] bg-white p-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                        Widget name
                      </label>
                      <Input
                        value={widgetName}
                        onChange={(e) => setWidgetName(e.target.value)}
                        placeholder={`Buy ${convertItem.name}`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                        Bucket
                      </label>
                      <select
                        value={widgetBucket}
                        onChange={(event) => setWidgetBucket(event.target.value)}
                        className="h-10 w-full rounded-md border border-[#dbd6cf] px-3 text-sm shadow-sm focus:border-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
                      >
                        {widgetBucketOptions.length === 0 ? (
                          <option value="">No buckets available</option>
                        ) : (
                          widgetBucketOptions.map((bucket) => (
                            <option key={bucket} value={bucket}>
                              {bucket}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                        Daily target
                      </label>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() =>
                            setWidgetTarget((prev) => Math.max(1, prev - 1))
                          }
                          aria-label="Decrease target"
                        >
                          -
                        </Button>
                        <div className="flex items-center gap-2 text-sm text-[#4a5568]">
                          <span className="min-w-[24px] text-center text-base font-semibold">
                            {widgetTarget}
                          </span>
                          <span>item{widgetTarget !== 1 ? "s" : ""}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => setWidgetTarget((prev) => prev + 1)}
                          aria-label="Increase target"
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                        Colour
                      </label>
                      <div className="grid grid-cols-6 gap-2">
                        {WIDGET_COLOR_OPTIONS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            aria-label={color}
                            onClick={() => setWidgetColor(color)}
                            className={`h-8 w-8 rounded-full border-2 transition ${WIDGET_COLOR_CLASS[color]} ${
                              widgetColor === color
                                ? "ring-2 ring-offset-2 ring-warm-500 border-white"
                                : "border-white"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[#8e99a8]">
                        Schedule
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_LABELS.map((day, index) => (
                          <button
                            key={day + index}
                            type="button"
                            onClick={() =>
                              setWidgetSchedule((prev) =>
                                prev.map((value, idx) =>
                                  idx === index ? !value : value,
                                ),
                              )
                            }
                            className={`h-8 w-8 rounded-full border text-xs font-semibold transition ${
                              widgetSchedule[index]
                                ? "bg-warm-500 text-white border-warm-500"
                                : "bg-white text-[#6b7688] border-[#dbd6cf]"
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-[#dbd6cf] bg-white p-4">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="convert-task"
                    checked={taskEnabled}
                    onCheckedChange={(checked) => setTaskEnabled(Boolean(checked))}
                  />
                  <div>
                    <label htmlFor="convert-task" className="text-sm font-medium text-[#314158]">
                      Mirror as task
                    </label>
                    <p className="text-xs text-[#8e99a8]">
                      Adds this item to your Tasks view and keeps it in sync with widget updates.
                    </p>
                  </div>
                </div>
                {convertItem.taskId && (
                  <p className="pl-7 text-xs text-[#8e99a8]">
                    Linked task ID:{" "}
                    <span className="font-mono">{convertItem.taskId}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setConvertOpen(false);
                    setConvertItem(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isConverting}>
                  {isConverting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Convert
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </SidebarLayout>
  );
}

export default function ShoppingListPageClient() {
  return (
    <ToastProvider>
      <ShoppingListLayout />
    </ToastProvider>
  );
}
