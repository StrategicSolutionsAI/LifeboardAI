import { useCallback, useEffect, useMemo, useState } from "react";

export interface ShoppingListItem {
  id: string;
  bucket: string | null;
  name: string;
  quantity: string | null;
  notes: string | null;
  assigneeId: string | null;
  isPurchased: boolean;
  neededBy: string | null;
  calendarEventId: string | null;
  calendarEventCreatedAt: string | null;
  widgetInstanceId: string | null;
  widgetCreatedAt: string | null;
  widgetBucket: string | null;
  taskId: string | null;
  taskCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateItemInput {
  name: string;
  bucket?: string | null;
  quantity?: string | null;
  notes?: string | null;
  neededBy?: string | null;
  assigneeId?: string | null;
}

type UpdateItemInput = Partial<Omit<CreateItemInput, "name">> & {
  name?: string;
  isPurchased?: boolean;
  calendarEventId?: string | null;
  calendarEventCreatedAt?: string | null;
  widgetInstanceId?: string | null;
  widgetCreatedAt?: string | null;
  widgetBucket?: string | null;
  taskId?: string | null;
  taskCreatedAt?: string | null;
};

export function useShoppingList() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [purchasedItems, setPurchasedItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPurchased, setLoadingPurchased] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/shopping-list", {
        method: "GET",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const json = await response.json();
      const fetched: ShoppingListItem[] = Array.isArray(json?.items) ? json.items : [];
      setItems(fetched);
    } catch (err: any) {
      console.error("Failed to load shopping list", err);
      setError("Failed to load shopping list items.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPurchasedItems = useCallback(async () => {
    setLoadingPurchased(true);
    try {
      const response = await fetch("/api/shopping-list?includePurchased=true", {
        method: "GET",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const json = await response.json();
      const fetched: ShoppingListItem[] = Array.isArray(json?.items) ? json.items : [];
      setPurchasedItems(fetched.filter((item) => item.isPurchased));
    } catch (err: any) {
      console.error("Failed to load purchased items", err);
    } finally {
      setLoadingPurchased(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const createItem = useCallback(
    async (input: CreateItemInput) => {
      const payload = {
        name: input.name,
        bucket: input.bucket ?? null,
        quantity: input.quantity ?? null,
        notes: input.notes ?? null,
        neededBy: input.neededBy ?? null,
        assigneeId: input.assigneeId ?? null,
      };

      const response = await fetch("/api/shopping-list", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const json = await response.json();
      if (json?.item) {
        setItems((prev) => [...prev, json.item as ShoppingListItem]);
      }
      return json?.item as ShoppingListItem | undefined;
    },
    [],
  );

  const updateItem = useCallback(async (id: string, updates: UpdateItemInput) => {
    const response = await fetch("/api/shopping-list", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const json = await response.json();
    if (json?.item) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? (json.item as ShoppingListItem) : item)),
      );
    }

    return json?.item as ShoppingListItem | undefined;
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const response = await fetch("/api/shopping-list", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
    setPurchasedItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const togglePurchased = useCallback(async (id: string, nextValue: boolean) => {
    const response = await fetch("/api/shopping-list", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isPurchased: nextValue }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const json = await response.json();
    const updated = json?.item as ShoppingListItem | undefined;

    if (!updated) {
      return undefined;
    }

    if (updated.isPurchased) {
      // Move from active to purchased
      setItems((prev) => prev.filter((item) => item.id !== id));
      setPurchasedItems((prev) => [...prev, updated]);
    } else {
      // Move from purchased to active
      setPurchasedItems((prev) => prev.filter((item) => item.id !== id));
      setItems((prev) => [...prev, updated]);
    }

    return updated;
  }, []);

  const itemsByBucket = useMemo(() => {
    const map = new Map<string | null, ShoppingListItem[]>();
    items.forEach((item) => {
      const key = item.bucket ?? null;
      const bucketItems = map.get(key) ?? [];
      bucketItems.push(item);
      map.set(key, bucketItems);
    });
    return map;
  }, [items]);

  return {
    items,
    purchasedItems,
    itemsByBucket,
    loading,
    loadingPurchased,
    error,
    reload: loadItems,
    loadPurchasedItems,
    createItem,
    updateItem,
    deleteItem,
    togglePurchased,
  };
}
