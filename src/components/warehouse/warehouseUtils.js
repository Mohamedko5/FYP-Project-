export function getUsedCapacity(warehouse) {
  if (warehouse.usedCapacity !== undefined) return Number(warehouse.usedCapacity);
  return warehouse.storedProducts.reduce((sum, item) => sum + Number(item.quantity), 0);
}

export function getAvailableCapacity(warehouse) {
  if (warehouse.availableCapacity !== undefined) return Number(warehouse.availableCapacity);
  return Math.max(Number(warehouse.capacity) - getUsedCapacity(warehouse), 0);
}

export function getUsagePercent(warehouse) {
  if (warehouse.usagePercent !== undefined) return Number(warehouse.usagePercent);
  if (!warehouse.capacity) return 0;
  return Math.min(Math.round((getUsedCapacity(warehouse) / Number(warehouse.capacity)) * 100), 100);
}

export function getWarehouseStatus(warehouse) {
  if (warehouse.status) return warehouse.status;
  const used = getUsedCapacity(warehouse);
  const percent = getUsagePercent(warehouse);

  if (percent >= 100) return 'Full';
  if (percent >= 80) return 'Almost Full';
  if (used > 0 && percent <= 15) return 'Low Stock';
  if (used === 0) return 'Inactive';
  return 'Available';
}

export function getStockStatus(stockItem) {
  if (Number(stockItem.quantity) <= Number(stockItem.minimumThreshold || 50)) {
    return 'Low Stock';
  }
  return 'Available';
}

export function getProductCategory(products, productName) {
  return products.find((product) => product.name === productName)?.category || 'Commodity';
}

export function getUnitOptions(productUnitOptionsByProduct, productName) {
  return productUnitOptionsByProduct[productName] || [];
}
