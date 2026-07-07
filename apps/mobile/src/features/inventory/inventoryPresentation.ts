import type { Inventory, Item } from "@mongchi/shared";

export interface OwnedInventoryItemPresentation {
  entry: Inventory["items"][number];
  item: Item;
}

export interface InventorySummaryPresentation {
  ownedItems: OwnedInventoryItemPresentation[];
  ownedQuantity: number;
  previewItems: OwnedInventoryItemPresentation[];
}

export const getInventorySummaryPresentation = (catalogItems: Item[], inventory: Inventory): InventorySummaryPresentation => {
  const itemById = new Map(catalogItems.map((item) => [item.id, item]));
  const ownedItems = inventory.items
    .map((entry) => {
      const item = itemById.get(entry.itemId);

      return item ? { entry, item } : null;
    })
    .filter((item): item is OwnedInventoryItemPresentation => item !== null);
  const ownedQuantity = inventory.items.reduce((total, entry) => total + entry.quantity, 0);

  return {
    ownedItems,
    ownedQuantity,
    previewItems: ownedItems.slice(0, 5)
  };
};
