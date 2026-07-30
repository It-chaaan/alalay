export async function capabilities() {
  return {
    status: "browser_ocr_ready",
    supported_uploads: ["image/jpeg", "image/png", "application/pdf"],
    readable_fields: ["merchant", "date", "items", "total_amount", "payment_method"],
    message: "JPG and PNG receipts are scanned locally in the browser. PDF uploads can be reviewed, but image receipts work best for live OCR.",
  };
}

export async function demoReceiptScan() {
  return {
    status: "scanned",
    confidence: 97,
    merchant: "SM Hypermarket Cubao",
    date: "2025-06-28",
    time: "2:47 PM",
    cashier: "Cashier #04 - Ana R.",
    payment_method: "gcash",
    suggested_category: "Food",
    items: [
      { id: "milk", name: "Magnolia Fresh Milk 1L", quantity: 2, unit_price: 74, total: 148 },
      { id: "tuna", name: "Century Tuna (3-pack)", quantity: 1, unit_price: 99, total: 99 },
      { id: "detergent", name: "Ariel Detergent Powder 2kg", quantity: 1, unit_price: 229, total: 229 },
      { id: "shampoo", name: "Palmolive Shampoo 200ml", quantity: 1, unit_price: 89, total: 89 },
      { id: "chips", name: "Lay's Original 68g", quantity: 2, unit_price: 39, total: 78 },
      { id: "coffee", name: "Kopiko Brown Coffee 30s", quantity: 1, unit_price: 119, total: 119 },
    ],
    totals: {
      subtotal: 762,
      vat: 87,
      total: 849,
    },
  };
}
