"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Archive,
  CalendarPlus,
  ChevronDown,
  Clock,
  Filter,
  LayoutGrid,
  Loader2,
  Plus,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
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
import { hexToRgba } from "@/lib/dashboard-utils";
import { card, form, interactive, surface, text } from "@/lib/styles";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useFamilyMembers, type FamilyMemberOption } from "@/hooks/use-family-members";

const UNSORTED_LABEL = "Unsorted";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/* ─── Extracted Shopping Item Cards ─── */

interface ShoppingListItemCardProps {
  item: ShoppingListItem;
  bucketColors: Record<string, string>;
  isPurchaseAnimating: boolean;
  isNewlyCreated: boolean;
  onTogglePurchased: (item: ShoppingListItem) => void;
  onOpenConvert: (item: ShoppingListItem) => void;
  onDelete: (item: ShoppingListItem) => void;
  familyMembers?: FamilyMemberOption[];
}

const ShoppingListItemCard = React.memo(function ShoppingListItemCard({
  item,
  bucketColors,
  isPurchaseAnimating,
  isNewlyCreated,
  onTogglePurchased,
  onOpenConvert,
  onDelete,
  familyMembers,
}: ShoppingListItemCardProps) {
  const color = getBucketColorSync(item.bucket ?? UNASSIGNED_BUCKET_ID, bucketColors);
  const conversionComplete = Boolean(item.calendarEventId) && Boolean(item.widgetInstanceId);
  const isUnsorted = !item.bucket;
  const bucketLabel = isUnsorted ? UNSORTED_LABEL : item.bucket;
  const badgeColor = getBucketColorSync(
    isUnsorted ? UNASSIGNED_BUCKET_ID : item.bucket!,
    bucketColors,
  );

  return (
    <div
      className={cn(
        "group flex items-start justify-between rounded-xl border p-3.5",
        "border-theme-neutral-300/80 bg-white",
        interactive.transitionFast,
        "hover:shadow-warm-sm hover:border-theme-neutral-300",
        isPurchaseAnimating && "bg-emerald-50/60 border-emerald-200",
        isNewlyCreated && "animate-row-enter",
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={item.isPurchased}
          onCheckedChange={() => onTogglePurchased(item)}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn(
              "text-[14px] font-medium text-theme-text-primary",
              isPurchaseAnimating && "animate-strike",
            )}>
              {item.name}
            </p>
            {item.assigneeId && (() => {
              const member = familyMembers?.find((m) => m.id === item.assigneeId);
              if (!member) return null;
              const initials = member.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-3xs font-semibold text-white shrink-0"
                  style={{ backgroundColor: member.avatarColor }}
                  title={member.name}
                >
                  {initials}
                </span>
              );
            })()}
            <Badge
              className="border-0 text-xs font-medium"
              style={{ backgroundColor: hexToRgba(badgeColor, 0.15), color: badgeColor }}
            >
              {bucketLabel}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            {item.quantity && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-theme-surface-alt text-theme-text-secondary border border-theme-neutral-300/50">
                Qty: {item.quantity}
              </span>
            )}
            {item.neededBy && (
              <span className="text-[11px] text-theme-text-tertiary">
                Needed by {item.neededBy}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] font-medium text-theme-text-tertiary">
              <span
                className="inline-flex h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              Added{" "}
              {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
          {(item.calendarEventId || item.widgetInstanceId) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {item.calendarEventId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-theme-brand-tint-subtle text-theme-primary-600">
                  <CalendarPlus className="mr-1 h-3 w-3" />
                  Event
                </span>
              )}
              {item.widgetInstanceId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700">
                  <LayoutGrid className="mr-1 h-3 w-3" />
                  Widget
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 touch-reveal sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
        <button
          type="button"
          className="rounded-lg p-1.5 text-theme-text-tertiary hover:bg-theme-brand-tint-light hover:text-theme-text-primary transition-colors duration-150"
          onClick={() => onOpenConvert(item)}
          aria-label={`Edit ${item.name}`}
          title={conversionComplete ? "Edit linked event or widget" : "Convert to calendar event, widget, or both"}
        >
          <Sparkles className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-lg p-1.5 text-theme-text-tertiary transition-colors duration-150 hover:bg-red-50 hover:text-red-500"
          onClick={() => onDelete(item)}
          aria-label={`Delete ${item.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

interface PurchasedItemCardProps {
  item: ShoppingListItem;
  bucketColors: Record<string, string>;
  onRestore: (item: ShoppingListItem) => void;
  onDelete: (item: ShoppingListItem) => void;
}

const PurchasedItemCard = React.memo(function PurchasedItemCard({
  item,
  bucketColors,
  onRestore,
  onDelete,
}: PurchasedItemCardProps) {
  const isUnsorted = !item.bucket;
  const bucketLabel = isUnsorted ? UNSORTED_LABEL : item.bucket;
  const badgeColor = getBucketColorSync(
    isUnsorted ? UNASSIGNED_BUCKET_ID : item.bucket!,
    bucketColors,
  );

  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-xl border p-3",
        "border-theme-neutral-300/40 bg-white/60",
        interactive.transitionFast,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 shrink-0">
          <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-medium line-through text-theme-text-tertiary">
            {item.name}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            {item.quantity && (
              <span className="text-[11px] font-medium text-theme-text-tertiary">Qty: {item.quantity}</span>
            )}
            <Badge
              className="border-0 text-xs font-medium"
              style={{ backgroundColor: hexToRgba(badgeColor, 0.15), color: badgeColor }}
            >
              {bucketLabel}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 touch-reveal sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
        <button
          type="button"
          className="rounded-lg p-1.5 text-theme-text-tertiary hover:bg-theme-brand-tint-light hover:text-theme-text-primary transition-colors duration-150"
          onClick={() => onRestore(item)}
          aria-label={`Restore ${item.name}`}
          title="Restore to active list"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-lg p-1.5 text-theme-text-tertiary transition-colors duration-150 hover:bg-red-50 hover:text-red-500"
          onClick={() => onDelete(item)}
          aria-label={`Delete ${item.name}`}
          title="Delete permanently"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

/* ─── Add Item Modal ─── */

interface AddItemSheetInput {
  name: string;
  bucket: string | null;
  quantity: string | null;
  neededBy: string | null;
  assigneeId: string | null;
  notes: string | null;
  createEvent: boolean;
  eventBucket: string;
  eventDate: string;
  eventTime: string;
  eventAllDay: boolean;
  eventDuration: string;
  createWidget: boolean;
  widgetName: string;
  widgetBucket: string;
  widgetTarget: number;
  widgetSchedule: boolean[];
  mirrorAsTask: boolean;
}

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBuckets: string[];
  familyMembers: FamilyMemberOption[];
  widgetBucketOptions: string[];
  isCreating: boolean;
  onSubmit: (input: AddItemSheetInput) => void;
}

function AddItemDialog({
  open,
  onOpenChange,
  availableBuckets,
  familyMembers,
  widgetBucketOptions,
  isCreating,
  onSubmit,
}: AddItemDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [bucket, setBucket] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Quick action state
  const [qaCreateEvent, setQaCreateEvent] = useState(false);
  const [qaEventBucket, setQaEventBucket] = useState("");
  const [qaEventDate, setQaEventDate] = useState("");
  const [qaEventTime, setQaEventTime] = useState("");
  const [qaEventAllDay, setQaEventAllDay] = useState(true);
  const [qaEventDuration, setQaEventDuration] = useState("60");
  const [qaCreateWidget, setQaCreateWidget] = useState(false);
  const [qaWidgetName, setQaWidgetName] = useState("");
  const [qaWidgetBucket, setQaWidgetBucket] = useState("");
  const [qaWidgetTarget, setQaWidgetTarget] = useState(1);
  const [qaWidgetSchedule, setQaWidgetSchedule] = useState([true, true, true, true, true, true, true]);
  const [qaMirrorAsTask, setQaMirrorAsTask] = useState(false);

  // Reset fields when modal opens
  useEffect(() => {
    if (open) {
      setName("");
      setBucket("");
      setQuantity("");
      setNeededBy("");
      setAssigneeId("");
      setNotes("");
      // Reset quick actions
      setQaCreateEvent(false);
      setQaEventBucket(widgetBucketOptions[0] ?? "");
      setQaEventDate(new Date().toISOString().split("T")[0]);
      setQaEventTime("");
      setQaEventAllDay(true);
      setQaEventDuration("60");
      setQaCreateWidget(false);
      setQaWidgetName("");
      setQaWidgetBucket(widgetBucketOptions[0] ?? "");
      setQaWidgetTarget(1);
      setQaWidgetSchedule([true, true, true, true, true, true, true]);
      setQaMirrorAsTask(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: "Item name required",
        description: "Please add an item description before saving.",
        type: "warning",
      });
      return;
    }
    if (qaCreateEvent && !qaEventDate) {
      toast({
        title: "Date required",
        description: "Set a date for the calendar event.",
        type: "warning",
      });
      return;
    }
    if (qaCreateEvent && !qaEventAllDay && !qaEventTime) {
      toast({
        title: "Time required",
        description: "Add a time or mark the event as all-day.",
        type: "warning",
      });
      return;
    }
    if (qaCreateWidget && !qaWidgetBucket) {
      toast({
        title: "Bucket required",
        description: "Pick a dashboard bucket for the widget.",
        type: "warning",
      });
      return;
    }
    if (qaCreateWidget && qaWidgetSchedule.every((day) => !day)) {
      toast({
        title: "Schedule required",
        description: "Select at least one day for the widget schedule.",
        type: "warning",
      });
      return;
    }
    onSubmit({
      name: trimmed,
      bucket: bucket || null,
      quantity: quantity.trim() || null,
      neededBy: neededBy || null,
      assigneeId: assigneeId || null,
      notes: notes.trim() || null,
      createEvent: qaCreateEvent,
      eventBucket: qaEventBucket,
      eventDate: qaEventDate,
      eventTime: qaEventTime,
      eventAllDay: qaEventAllDay,
      eventDuration: qaEventDuration,
      createWidget: qaCreateWidget,
      widgetName: qaWidgetName,
      widgetBucket: qaWidgetBucket,
      widgetTarget: qaWidgetTarget,
      widgetSchedule: qaWidgetSchedule,
      mirrorAsTask: qaMirrorAsTask,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[520px] overflow-y-auto flex flex-col">
        <SheetHeader>
          <SheetTitle className={text.primary}>Add Item</SheetTitle>
          <SheetDescription className={text.tertiary}>
            Add a new item to your shopping list.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-1 flex-col space-y-4">
          <div className={cn(card.inset, "space-y-3 p-4")}>
            <div>
              <label className={cn(form.label, "mb-1 block")}>
                Item name <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What do you need to pick up?"
                className={form.input}
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={cn(form.label, "mb-1 block")}>
                  Category
                </label>
                <select
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  className={form.select}
                >
                  <option value="">Unsorted</option>
                  {availableBuckets.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={cn(form.label, "mb-1 block")}>
                  Quantity
                </label>
                <Input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 3 packs"
                  className={form.input}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={cn(form.label, "mb-1 block")}>
                  Needed by
                </label>
                <Input
                  type="date"
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                  className={form.input}
                />
              </div>
              <div>
                <label className={cn(form.label, "mb-1 block")}>
                  Assign to
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className={form.select}
                >
                  <option value="">Unassigned</option>
                  {familyMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={cn(form.label, "mb-1 block")}>
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional details or reminders"
                rows={2}
                className={form.textarea}
              />
            </div>
          </div>

          {/* ── Quick Actions ── */}
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-theme-neutral-300" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-theme-text-secondary">
              Quick Actions
            </span>
            <div className="h-px flex-1 bg-theme-neutral-300" />
          </div>

          {/* Toggle 1 — Calendar Event */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="add-event"
                checked={qaCreateEvent}
                onCheckedChange={(checked) => setQaCreateEvent(Boolean(checked))}
              />
              <CalendarPlus className="h-4 w-4 text-theme-text-tertiary" />
              <label htmlFor="add-event" className={cn("text-sm font-medium", text.primary)}>
                Create calendar event
              </label>
            </div>
            {qaCreateEvent && (
              <div className={cn(card.inset, "space-y-3 p-4")}>
                <div>
                  <label className={cn(form.label, "mb-1 block")}>Bucket</label>
                  <select
                    value={qaEventBucket}
                    onChange={(e) => setQaEventBucket(e.target.value)}
                    className={form.select}
                  >
                    {widgetBucketOptions.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={cn(form.label, "mb-1 block")}>Date</label>
                    <Input
                      type="date"
                      value={qaEventDate}
                      onChange={(e) => setQaEventDate(e.target.value)}
                      className={form.input}
                    />
                  </div>
                  <div>
                    <label className={cn(form.label, "mb-1 block")}>Time</label>
                    <Input
                      type="time"
                      value={qaEventTime}
                      onChange={(e) => {
                        setQaEventTime(e.target.value);
                        if (e.target.value) setQaEventAllDay(false);
                      }}
                      disabled={qaEventAllDay}
                      className={form.input}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="add-event-all-day"
                    checked={qaEventAllDay}
                    onCheckedChange={(checked) => {
                      const next = Boolean(checked);
                      setQaEventAllDay(next);
                      if (next) setQaEventTime("");
                    }}
                  />
                  <label htmlFor="add-event-all-day" className={cn(text.size.md, text.body)}>
                    Treat as all-day event
                  </label>
                </div>
                {!qaEventAllDay && (
                  <div>
                    <label className={cn(form.label, "mb-1 block")}>Duration (minutes)</label>
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      value={qaEventDuration}
                      onChange={(e) => setQaEventDuration(e.target.value)}
                      className={form.input}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toggle 2 — Dashboard Widget */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="add-widget"
                checked={qaCreateWidget}
                onCheckedChange={(checked) => setQaCreateWidget(Boolean(checked))}
              />
              <LayoutGrid className="h-4 w-4 text-theme-text-tertiary" />
              <label htmlFor="add-widget" className={cn("text-sm font-medium", text.primary)}>
                Create dashboard widget
              </label>
            </div>
            {qaCreateWidget && (
              <div className={cn(card.inset, "space-y-3 p-4")}>
                <div>
                  <label className={cn(form.label, "mb-1 block")}>Widget name</label>
                  <Input
                    value={qaWidgetName}
                    onChange={(e) => setQaWidgetName(e.target.value)}
                    placeholder={`Buy ${name || "item"}`}
                    className={form.input}
                  />
                </div>
                <div>
                  <label className={cn(form.label, "mb-1 block")}>Bucket</label>
                  <select
                    value={qaWidgetBucket}
                    onChange={(e) => setQaWidgetBucket(e.target.value)}
                    className={form.select}
                  >
                    {widgetBucketOptions.length === 0 ? (
                      <option value="">No buckets available</option>
                    ) : (
                      widgetBucketOptions.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className={cn(form.label, "mb-1 block")}>Daily target</label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setQaWidgetTarget((prev) => Math.max(1, prev - 1))}
                      aria-label="Decrease target"
                    >
                      -
                    </Button>
                    <div className={cn("flex items-center gap-2", text.size.md, text.body)}>
                      <span className={cn("min-w-[24px] text-center", text.heading.sm)}>
                        {qaWidgetTarget}
                      </span>
                      <span>item{qaWidgetTarget !== 1 ? "s" : ""}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => setQaWidgetTarget((prev) => prev + 1)}
                      aria-label="Increase target"
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div>
                  <label className={cn(form.label, "mb-2 block")}>Schedule</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_LABELS.map((day, index) => (
                      <button
                        key={day + index}
                        type="button"
                        onClick={() =>
                          setQaWidgetSchedule((prev) =>
                            prev.map((value, idx) => (idx === index ? !value : value)),
                          )
                        }
                        className={cn(
                          "h-8 w-8 rounded-full border text-xs font-semibold",
                          interactive.transitionFast,
                          qaWidgetSchedule[index]
                            ? "bg-warm-500 text-white border-warm-500"
                            : cn(surface.raised, "text-theme-text-subtle border-theme-neutral-300"),
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Toggle 3 — Mirror as Task */}
          <div className={cn(card.inset, "space-y-3 p-4")}>
            <div className="flex items-start gap-2">
              <Checkbox
                id="add-task"
                checked={qaMirrorAsTask}
                onCheckedChange={(checked) => setQaMirrorAsTask(Boolean(checked))}
              />
              <div>
                <label htmlFor="add-task" className={cn("text-sm font-medium", text.primary)}>
                  Mirror as task
                </label>
                <p className={cn(text.size.sm, text.tertiary)}>
                  Adds this item to your Tasks view and keeps it in sync with widget updates.
                </p>
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 mt-auto pt-4 pb-2 bg-white border-t border-theme-neutral-300">
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="bg-theme-primary text-white hover:bg-theme-primary-600"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Plus size={15} className="mr-1.5" />
                )}
                Add Item
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function ShoppingListLayout() {
  const { toast } = useToast();
  const { buckets } = useBuckets();
  const familyMembers = useFamilyMembers();
  const {
    items,
    purchasedItems,
    loading: loadingItems,
    loadingPurchased,
    error,
    createItem,
    deleteItem,
    togglePurchased,
    updateItem,
    loadPurchasedItems,
  } = useShoppingList();
  const { addWidget, updateWidget, removeWidget, widgetsByBucket } = useWidgets();
  const [bucketColors, setBucketColors] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<string>("all");
  const [addModalOpen, setAddModalOpen] = useState(false);

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
  const [widgetSchedule, setWidgetSchedule] = useState<boolean[]>([true, true, true, true, true, true, true]);
  const [taskEnabled, setTaskEnabled] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemNotes, setItemNotes] = useState("");
  const [itemBucket, setItemBucket] = useState<string>("");
  const [itemNeededBy, setItemNeededBy] = useState("");
  const [itemAssigneeId, setItemAssigneeId] = useState<string>("");
  const [isConverting, setIsConverting] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
  const [justPurchased, setJustPurchased] = useState<Set<string>>(new Set());
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null);

  const dueSoonCount = useMemo(() => {
    const now = Date.now();
    return items.filter((i) => {
      if (!i.neededBy) return false;
      const diff = new Date(i.neededBy).getTime() - now;
      return diff >= 0 && diff <= 7 * 86_400_000;
    }).length;
  }, [items]);

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
      items
        .filter((i) => !hiddenItems.has(i.id))
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [items, hiddenItems],
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

  const handleCreateItem = async (input: AddItemSheetInput) => {
    setIsCreating(true);
    try {
      const created = await createItem({
        name: input.name,
        bucket: input.bucket,
        quantity: input.quantity,
        neededBy: input.neededBy,
        assigneeId: input.assigneeId,
        notes: input.notes,
      });
      if (created?.id) {
        setLastCreatedId(created.id);
        setTimeout(() => setLastCreatedId(null), 300);
      }

      const itemId = created?.id;
      const hasQuickActions = input.createEvent || input.createWidget || input.mirrorAsTask;

      if (itemId && hasQuickActions) {
        const updates: Record<string, string | null> = {};
        const summary: string[] = [];
        const nowIso = new Date().toISOString();
        const headers = { "Content-Type": "application/json" };

        const fallbackBucket = input.bucket || input.eventBucket || input.widgetBucket || "Shopping";
        const eventBucketFinal = input.eventBucket || fallbackBucket;
        const bucketForWidget = input.widgetBucket || fallbackBucket;
        const taskBucket = eventBucketFinal || bucketForWidget || input.bucket || null;
        const taskDueDate = input.eventDate || input.neededBy || null;
        const durationMinutes = Number.parseInt(input.eventDuration || "0", 10);
        const normalizedDuration =
          !input.eventAllDay && Number.isFinite(durationMinutes) && durationMinutes > 0
            ? durationMinutes
            : null;
        const taskAllDay = input.eventAllDay || !input.eventTime;
        const taskHourSlot = !taskAllDay && input.eventTime ? input.eventTime : null;

        let taskId: string | null = null;

        // Create task first so widget can reference it
        if (input.mirrorAsTask) {
          const taskPayload = {
            content: input.name,
            bucket: taskBucket,
            due_date: taskDueDate,
            all_day: taskAllDay,
            hour_slot: taskHourSlot,
            repeat_rule: "none",
          };
          const response = await fetch("/api/tasks", {
            method: "POST",
            credentials: "same-origin",
            headers,
            body: JSON.stringify(taskPayload),
          });
          if (response.ok) {
            const json = await response.json();
            taskId = json?.task?.id ?? null;
            if (taskId) {
              updates.taskId = taskId;
              updates.taskCreatedAt = nowIso;
              summary.push("task");
            }
          }
        }

        // Create calendar event
        if (input.createEvent) {
          const descriptionParts: string[] = [];
          if (input.quantity) descriptionParts.push(`Qty: ${input.quantity}`);
          if (input.notes) descriptionParts.push(input.notes);

          const response = await fetch("/api/calendar/events", {
            method: "POST",
            credentials: "same-origin",
            headers,
            body: JSON.stringify({
              title: input.name,
              description: descriptionParts.length > 0 ? descriptionParts.join(" \u2022 ") : null,
              date: input.eventDate,
              time: input.eventAllDay ? null : input.eventTime,
              durationMinutes: normalizedDuration,
              allDay: taskAllDay,
              bucket: eventBucketFinal ?? null,
              source: "shopping_list",
              externalId: `shopping-item-${itemId}`,
            }),
          });
          if (response.ok) {
            const json = await response.json();
            const eventId = json?.event?.id as string | undefined;
            if (eventId) {
              updates.calendarEventId = eventId;
              updates.calendarEventCreatedAt = nowIso;
              summary.push("calendar event");
            }
          }
        }

        // Create dashboard widget
        if (input.createWidget) {
          const widgetTitle = input.widgetName.trim() || input.name;
          const description = input.quantity
            ? `Quantity: ${input.quantity}`
            : input.notes || "Auto-created from shopping list";

          const linkedTaskConfig = input.mirrorAsTask
            ? {
                enabled: true,
                title: input.name,
                bucket: taskBucket ?? undefined,
                dueDate: taskDueDate ?? undefined,
                allDay: taskAllDay,
                startTime: taskHourSlot ?? "",
                endTime: "",
                repeat: "none" as const,
              }
            : { enabled: false };

          const instanceId =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? `shopping-${itemId}-${crypto.randomUUID()}`
              : `shopping-${itemId}-${Math.random().toString(36).slice(2)}`;

          const widgetInstance: WidgetInstance = {
            id: "shopping-item",
            name: widgetTitle,
            description,
            icon: ShoppingCart,
            category: "shopping",
            unit: "item",
            units: ["item", "items"],
            defaultTarget: input.widgetTarget,
            target: input.widgetTarget,
            schedule: [...input.widgetSchedule],
            color: "indigo",
            dataSource: "manual",
            createdAt: nowIso,
            instanceId,
            linkedTaskId: input.mirrorAsTask && taskId ? taskId : undefined,
            linkedTaskSource: taskId ? "supabase" : undefined,
            linkedTaskAutoCreated: input.mirrorAsTask,
            linkedTaskTitle: input.name,
            linkedTaskConfig,
          };

          addWidget(bucketForWidget, widgetInstance);
          updates.widgetInstanceId = instanceId;
          updates.widgetCreatedAt = nowIso;
          updates.widgetBucket = bucketForWidget;
          summary.push("dashboard widget");
        }

        if (Object.keys(updates).length > 0) {
          await updateItem(itemId, updates);
        }

        setAddModalOpen(false);
        toast({
          title: "Item added",
          description: summary.length > 0
            ? `${input.name} added with ${summary.join(" and ")}.`
            : `${input.name} added to ${input.bucket ?? UNSORTED_LABEL}.`,
          type: "success",
        });
      } else {
        setAddModalOpen(false);
        toast({
          title: "Item added",
          description: `${input.name} added to ${input.bucket ?? UNSORTED_LABEL}.`,
          type: "success",
        });
      }
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

  const handleTogglePurchased = useCallback(async (item: ShoppingListItem) => {
    const wasPurchased = item.isPurchased;
    try {
      if (!wasPurchased) {
        setJustPurchased((prev) => new Set(prev).add(item.id));
        setTimeout(() => {
          setJustPurchased((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }, 600);
      }
      await togglePurchased(item.id, !wasPurchased);
      toast({
        title: wasPurchased ? "Item restored" : "Marked as purchased",
        description: item.name,
        type: "success",
        duration: 2500,
      });
    } catch (err) {
      console.error("Failed to toggle purchased state", err);
      setJustPurchased((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      toast({
        title: "Unable to update item",
        description: "Please try again in a moment.",
        type: "error",
      });
    }
  }, [togglePurchased, toast]);

  const handleDelete = useCallback((item: ShoppingListItem) => {
    // Optimistically hide the item
    setHiddenItems((prev) => new Set(prev).add(item.id));

    let undone = false;
    const timeoutId = setTimeout(async () => {
      if (undone) return;
      try {
        await deleteItem(item.id);
      } catch {
        setHiddenItems((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        toast({
          title: "Unable to delete item",
          description: "Please try again in a moment.",
          type: "error",
        });
      }
    }, 5000);

    toast({
      title: "Item removed",
      description: item.name,
      type: "success",
      undoAction: () => {
        undone = true;
        clearTimeout(timeoutId);
        setHiddenItems((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
        toast({ title: "Item restored", type: "success", duration: 2000 });
      },
    });
  }, [deleteItem, toast]);

  const handleOpenConvert = useCallback((item: ShoppingListItem) => {
    setConvertItem(item);
    setConvertOpen(true);
  }, []);

  const handleToggleArchive = () => {
    const next = !showArchive;
    setShowArchive(next);
    if (next && !archiveLoaded) {
      setArchiveLoaded(true);
      loadPurchasedItems();
    }
  };

  const handleRestore = useCallback(async (item: ShoppingListItem) => {
    try {
      await togglePurchased(item.id, false);
      toast({
        title: "Item restored",
        description: `${item.name} moved back to your active list.`,
        type: "success",
      });
    } catch (err) {
      console.error("Failed to restore item", err);
      toast({
        title: "Unable to restore item",
        description: "Please try again in a moment.",
        type: "error",
      });
    }
  }, [togglePurchased, toast]);

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
    setItemAssigneeId(convertItem.assigneeId ?? "");
    setWidgetName(`Buy ${convertItem.name}`);
    setWidgetBucket(convertItem.widgetBucket ?? fallbackBucket);
    setEventBucket(fallbackBucket);
    setWidgetTarget(Number.isFinite(numericQuantity) && numericQuantity > 0 ? numericQuantity : 1);
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
    const currentAssigneeId = convertItem.assigneeId ?? null;
    const newAssigneeId = itemAssigneeId || null;
    if (newAssigneeId !== currentAssigneeId) {
      itemUpdates.assigneeId = newAssigneeId;
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
          color: "indigo",
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
            color: "indigo",
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

  const renderBucketBadge = useCallback((bucketValue: string | null) => {
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
  }, [bucketColors]);

  // ── Virtualizer setup ──
  const activeScrollRef = useRef<HTMLDivElement>(null);
  const purchasedScrollRef = useRef<HTMLDivElement>(null);

  const activeVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => activeScrollRef.current,
    estimateSize: () => 76,
    overscan: 5,
  });

  const purchasedVirtualizer = useVirtualizer({
    count: purchasedItems.length,
    getScrollElement: () => purchasedScrollRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  // Reset scroll position when bucket filter changes
  useEffect(() => {
    activeScrollRef.current?.scrollTo({ top: 0 });
  }, [selectedBucket]);

  // Scroll to bottom when a new item is created
  useEffect(() => {
    if (lastCreatedId && filteredItems.length > 0) {
      activeVirtualizer.scrollToIndex(filteredItems.length - 1, { align: 'end' });
    }
  }, [lastCreatedId, filteredItems.length, activeVirtualizer]);

  return (
    <>
      <div className="flex w-full flex-col gap-3 sm:gap-4 pb-24">
        {/* ── Header Row: Title + Stats + Add button ── */}
        <div className="flex items-center gap-5">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs text-theme-text-tertiary">
              {loadingItems ? "Loading…" : `${totalOpen} item${totalOpen !== 1 ? "s" : ""}`}
              {purchasedItems.length > 0 ? ` · ${purchasedItems.length} purchased` : ""}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-theme-primary text-white text-[13px] font-medium hover:bg-theme-primary-600 transition-colors shadow-warm-sm"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Item</span>
          </button>
        </div>

        {/* ── Stat Tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-theme-neutral-300/80 bg-white transition-all">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: "rgba(124,110,189,0.15)" }}
            >
              <ShoppingCart size={18} style={{ color: "#7C6EBD" }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[18px] font-bold text-theme-text-primary leading-tight">{totalOpen}</span>
              <span className="text-[11px] text-theme-text-tertiary">To Buy</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleArchive}
            className={cn(
              "flex items-center gap-3 px-3.5 py-3 rounded-xl border bg-white transition-all text-left",
              showArchive
                ? "border-[rgba(72,184,130,0.4)] ring-1 ring-[rgba(72,184,130,0.15)] shadow-sm"
                : "border-theme-neutral-300/80 hover:border-[rgba(72,184,130,0.3)] hover:shadow-warm-sm",
            )}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: "rgba(72,184,130,0.15)" }}
            >
              <Archive size={18} style={{ color: "#48B882" }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[18px] font-bold text-theme-text-primary leading-tight">{purchasedItems.length}</span>
              <span className="text-[11px] text-theme-text-tertiary">Purchased</span>
            </div>
          </button>

          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-theme-neutral-300/80 bg-white transition-all">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: "rgba(74,173,224,0.15)" }}
            >
              <LayoutGrid size={18} style={{ color: "#4AADE0" }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[18px] font-bold text-theme-text-primary leading-tight">{bucketFilters.length}</span>
              <span className="text-[11px] text-theme-text-tertiary">Buckets</span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-theme-neutral-300/80 bg-white transition-all">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: "rgba(219,171,62,0.15)" }}
            >
              <Clock size={18} style={{ color: "#DBA73E" }} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[18px] font-bold text-theme-text-primary leading-tight">
                {dueSoonCount}
              </span>
              <span className="text-[11px] text-theme-text-tertiary">Due Soon</span>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-[13px] text-red-600">
            Couldn&apos;t load your list. Try refreshing.
          </p>
        )}

        {/* ── Bucket Filter Dropdown ── */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-tertiary" />
            <select
              value={selectedBucket}
              onChange={(e) => setSelectedBucket(e.target.value)}
              className={cn(
                "h-9 appearance-none rounded-lg border border-theme-neutral-300 bg-white pl-8 pr-8",
                "text-[13px] font-medium text-theme-text-primary",
                "transition-all duration-150 hover:border-theme-neutral-300/80 hover:shadow-warm-sm",
                "focus:outline-none focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary/40",
                "cursor-pointer",
              )}
            >
              <option value="all">All items</option>
              {bucketFilters.map((bucket) => {
                const isUnsorted = bucket === UNASSIGNED_BUCKET_ID;
                const label = isUnsorted ? UNSORTED_LABEL : bucket;
                return (
                  <option key={bucket} value={bucket}>
                    {label}
                  </option>
                );
              })}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-text-tertiary" />
          </div>
        </div>

        {/* ── Items List (Virtualized) ── */}
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-theme-brand-tint-subtle">
              <ShoppingCart className="h-10 w-10 text-theme-brand-tint-strong" />
            </div>
            <h3 className="text-lg font-semibold text-theme-text-primary">
              {selectedBucket === "all"
                ? "Start your shopping list"
                : "No items in this bucket"}
            </h3>
            <p className="mt-1 max-w-xs text-sm text-theme-text-tertiary">
              {selectedBucket === "all"
                ? "Add your first item using the input above to get started."
                : "Items tagged with this bucket will appear here."}
            </p>
          </div>
        ) : (
          <div
            ref={activeScrollRef}
            className="overflow-y-auto rounded-xl"
            style={{ maxHeight: '60vh' }}
          >
            <div
              style={{
                height: `${activeVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {activeVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = filteredItems[virtualRow.index];
                return (
                  <div
                    key={item.id}
                    data-index={virtualRow.index}
                    ref={activeVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="pb-2">
                      <ShoppingListItemCard
                        item={item}
                        bucketColors={bucketColors}
                        isPurchaseAnimating={justPurchased.has(item.id)}
                        isNewlyCreated={lastCreatedId === item.id}
                        onTogglePurchased={handleTogglePurchased}
                        onOpenConvert={handleOpenConvert}
                        onDelete={handleDelete}
                        familyMembers={familyMembers}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Purchased / Archive section ── */}
        {showArchive && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[13px] font-semibold text-theme-text-secondary uppercase tracking-wide">
                Purchased
              </h3>
              <button
                type="button"
                onClick={handleToggleArchive}
                className="text-[12px] text-theme-text-tertiary hover:text-theme-text-secondary transition-colors"
              >
                Hide
              </button>
            </div>
            {loadingPurchased ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-theme-primary" />
                <span className="ml-2 text-xs text-theme-text-tertiary">Loading purchased items…</span>
              </div>
            ) : purchasedItems.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Archive className="mb-2 h-6 w-6 text-theme-text-subtle" />
                <p className="text-sm text-theme-text-tertiary">
                  No purchased items yet.
                </p>
              </div>
            ) : (
              <div
                ref={purchasedScrollRef}
                className="overflow-y-auto rounded-xl"
                style={{ maxHeight: '40vh' }}
              >
                <div
                  style={{
                    height: `${purchasedVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {purchasedVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item = purchasedItems[virtualRow.index];
                    return (
                      <div
                        key={item.id}
                        data-index={virtualRow.index}
                        ref={purchasedVirtualizer.measureElement}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="pb-1.5">
                          <PurchasedItemCard
                            item={item}
                            bucketColors={bucketColors}
                            onRestore={handleRestore}
                            onDelete={handleDelete}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AddItemDialog
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        availableBuckets={availableWidgetBuckets}
        familyMembers={familyMembers}
        widgetBucketOptions={widgetBucketOptions}
        isCreating={isCreating}
        onSubmit={handleCreateItem}
      />

      <Sheet open={convertOpen} onOpenChange={(open) => {
        setConvertOpen(open);
        if (!open) {
          setConvertItem(null);
        }
      }}>
        <SheetContent className="w-full sm:w-[520px] overflow-y-auto">
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
              <div className={cn(card.inset, "space-y-3 p-4")}>
                <div>
                  <label className={cn(form.label, "mb-1 block")}>
                    Item name
                  </label>
                  <Input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Item name"
                    className={form.input}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={cn(form.label, "mb-1 block")}>
                      Quantity
                    </label>
                    <Input
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      placeholder="e.g. 3 packs"
                      className={form.input}
                    />
                  </div>
                  <div>
                    <label className={cn(form.label, "mb-1 block")}>
                      Needed by
                    </label>
                    <Input
                      type="date"
                      value={itemNeededBy}
                      onChange={(e) => setItemNeededBy(e.target.value)}
                      className={form.input}
                    />
                  </div>
                </div>
                <div>
                  <label className={cn(form.label, "mb-1 block")}>
                    Bucket
                  </label>
                  <select
                    value={itemBucket}
                    onChange={(event) => setItemBucket(event.target.value)}
                    className={form.select}
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={cn(form.label, "mb-1 block")}>
                      Assign to
                    </label>
                    <select
                      value={itemAssigneeId}
                      onChange={(e) => setItemAssigneeId(e.target.value)}
                      className={form.select}
                    >
                      <option value="">Unassigned</option>
                      {familyMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={cn(form.label, "mb-1 block")}>
                      Notes
                    </label>
                    <textarea
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                      rows={3}
                      className={form.textarea}
                      placeholder="Optional details or reminders"
                    />
                  </div>
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
                  <label htmlFor="convert-event" className={cn("text-sm font-medium", text.primary)}>
                    Create calendar event
                  </label>
                </div>
                {convertItem.calendarEventId && (
                  <p className={cn("pl-7", text.size.sm, text.tertiary)}>
                    This item already links to a calendar event.
                  </p>
                )}

                {(convertItem.calendarEventId || convertCreateEvent) && (
                  <div className={cn(card.inset, "space-y-3 p-4")}>
                    <div>
                      <label className={cn(form.label, "mb-1 block")}>
                        Bucket
                      </label>
                      <select
                        value={eventBucket}
                        onChange={(e) => setEventBucket(e.target.value)}
                        className={form.select}
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
                        <label className={cn(form.label, "mb-1 block")}>
                          Date
                        </label>
                        <Input
                          type="date"
                          value={eventDate}
                          onChange={(e) => setEventDate(e.target.value)}
                          className={form.input}
                        />
                      </div>
                      <div>
                        <label className={cn(form.label, "mb-1 block")}>
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
                          className={form.input}
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
                        className={cn(text.size.md, text.body)}
                      >
                        Treat as all-day event
                      </label>
                    </div>
                    {!eventAllDay && (
                      <div>
                        <label className={cn(form.label, "mb-1 block")}>
                          Duration (minutes)
                        </label>
                        <Input
                          type="number"
                          min={5}
                          step={5}
                          value={eventDuration}
                          onChange={(e) => setEventDuration(e.target.value)}
                          className={form.input}
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
                  <label htmlFor="convert-widget" className={cn("text-sm font-medium", text.primary)}>
                    Create dashboard widget
                  </label>
                </div>
                {convertItem.widgetInstanceId && (
                  <p className={cn("pl-7", text.size.sm, text.tertiary)}>
                    This item already has a dashboard widget.
                  </p>
                )}

                {(convertItem.widgetInstanceId || convertCreateWidget) && (
                  <div className={cn(card.inset, "space-y-3 p-4")}>
                    <div>
                      <label className={cn(form.label, "mb-1 block")}>
                        Widget name
                      </label>
                      <Input
                        value={widgetName}
                        onChange={(e) => setWidgetName(e.target.value)}
                        placeholder={`Buy ${convertItem.name}`}
                        className={form.input}
                      />
                    </div>
                    <div>
                      <label className={cn(form.label, "mb-1 block")}>
                        Bucket
                      </label>
                      <select
                        value={widgetBucket}
                        onChange={(event) => setWidgetBucket(event.target.value)}
                        className={form.select}
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
                      <label className={cn(form.label, "mb-1 block")}>
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
                        <div className={cn("flex items-center gap-2", text.size.md, text.body)}>
                          <span className={cn("min-w-[24px] text-center", text.heading.sm)}>
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
                      <label className={cn(form.label, "mb-2 block")}>
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
                            className={cn(
                              "h-8 w-8 rounded-full border text-xs font-semibold",
                              interactive.transitionFast,
                              widgetSchedule[index]
                                ? "bg-warm-500 text-white border-warm-500"
                                : cn(surface.raised, "text-theme-text-subtle border-theme-neutral-300"),
                            )}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={cn(card.inset, "space-y-3 p-4")}>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="convert-task"
                    checked={taskEnabled}
                    onCheckedChange={(checked) => setTaskEnabled(Boolean(checked))}
                  />
                  <div>
                    <label htmlFor="convert-task" className={cn("text-sm font-medium", text.primary)}>
                      Mirror as task
                    </label>
                    <p className={cn(text.size.sm, text.tertiary)}>
                      Adds this item to your Tasks view and keeps it in sync with widget updates.
                    </p>
                  </div>
                </div>
                {convertItem.taskId && (
                  <p className={cn("pl-7", text.size.sm, text.tertiary)}>
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
    </>
  );
}

export default function ShoppingListPageClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <ShoppingListLayout />;
}
