import dynamic from "next/dynamic";
import { Suspense } from "react";
import LoadingShoppingList from "./loading";
import SectionLoadTimer from "@/components/section-load-timer";

// Eagerly start downloading the chunk at module evaluation time
const shoppingListChunk = import("./page.client");

const ShoppingListPageClient = dynamic(
  () => shoppingListChunk,
  {
    ssr: false,
    loading: () => <LoadingShoppingList />,
  }
);

export default function ShoppingListPage() {
  return (
    <>
      <SectionLoadTimer name="/shopping-list" />
      <Suspense fallback={<LoadingShoppingList />}>
        <ShoppingListPageClient />
      </Suspense>
    </>
  );
}
