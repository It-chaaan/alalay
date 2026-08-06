import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { Camera, Check, Loader2, Pencil, ReceiptText, RotateCcw, ScanLine, UploadCloud, X } from "lucide-react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { CategoryIcon } from "../../components/ui/CategoryIcon";
import { useApiMutation } from "../../hooks/useApiMutation";
import { useOcrScanner } from "../../hooks/useOcrScanner";
import type { Expense } from "../../hooks/types";
import { formatCurrency } from "../../utils/formatters";
import { isLowConfidenceOcr, shouldBlockOcrLogging } from "../../utils/ocrReview";
import { getCategories } from "../../lib/appSettings";
import { validateAndNormalizeOcrFile } from "../../utils/ocrFileSecurity";

type OcrStage = "upload" | "scanning" | "review" | "logged";

type OcrItem = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

type OcrScanResult = {
  status: string;
  confidence: number;
  merchant: string;
  date: string;
  time: string;
  cashier: string;
  payment_method: "cash" | "card" | "gcash" | "maya" | "bank_transfer" | "other";
  suggested_category: string;
  items: OcrItem[];
  totals: {
    subtotal: number;
    vat: number;
    total: number;
  };
  raw_text?: string;
};

const categories = getCategories("expense").map((category) => category.name);

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
] as const;

const fallbackScanResult: OcrScanResult = {
  status: "needs_review",
  confidence: 0,
  merchant: "Uploaded receipt",
  date: getTodayInputValue(),
  time: "",
  cashier: "Not detected",
  payment_method: "other",
  suggested_category: "Others",
  items: [],
  totals: {
    subtotal: 0,
    vat: 0,
    total: 0,
  },
};

function getDisplayName(session: Session) {
  return session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Juan";
}

function formatReceiptDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function paymentLabel(value: string) {
  return paymentMethods.find((method) => method.value === value)?.label ?? value;
}

function normalizeScanResult(result: unknown): OcrScanResult {
  if (
    result &&
    typeof result === "object" &&
    "items" in result &&
    Array.isArray((result as { items?: unknown }).items)
  ) {
    const candidate = result as Partial<OcrScanResult>;

    return {
      ...fallbackScanResult,
      ...candidate,
      payment_method: candidate.payment_method ?? fallbackScanResult.payment_method,
      suggested_category: candidate.suggested_category ?? fallbackScanResult.suggested_category,
      items: candidate.items ?? fallbackScanResult.items,
      totals: {
        ...fallbackScanResult.totals,
        ...candidate.totals,
      },
    };
  }

  return fallbackScanResult;
}

function toDateInputValue(value: string | null) {
  if (!value) return getTodayInputValue();

  const isoMatch = value.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const slashMatch = value.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (slashMatch) {
    const [, month, day, yearValue] = slashMatch;
    const year = yearValue.length === 2 ? `20${yearValue}` : yearValue;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return getTodayInputValue();
}

function getTodayInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${today.getFullYear()}-${month}-${day}`;
}

function isCurrentMonth(value: string) {
  return value.slice(0, 7) === getTodayInputValue().slice(0, 7);
}

function parseAmount(value: string) {
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseReceiptText(rawText: string, confidence: number): OcrScanResult {
  rawText = rawText.slice(0, 50_000);
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const merchant =
    lines.find((line) => /inc\.?|store|market|receipt|repair|shop|corp\.?|company/i.test(line) && !/^receipt$/i.test(line)) ??
    lines.find((line) => /[a-z]/i.test(line) && !/^(qty|description|unit price|amount|subtotal|total|tax|receipt)$/i.test(line)) ??
    "Scanned receipt";

  const dateLine = lines.find((line) => /(date|due|issued|invoice).*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/i.test(line)) ?? lines.find((line) => /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(line));
  const dateMatch = dateLine?.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/)?.[0] ?? null;
  const totalLine = [...lines].reverse().find((line) => /\b(total|amount due|balance due)\b/i.test(line) && /\d/.test(line));
  const subtotalLine = [...lines].reverse().find((line) => /\bsubtotal\b/i.test(line) && /\d/.test(line));
  const taxLine = [...lines].reverse().find((line) => /\b(tax|vat)\b/i.test(line) && /\d/.test(line));
  const allAmounts = lines.flatMap((line) => line.match(/[$₱]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})\b/g) ?? []).map(parseAmount);
  const total = totalLine ? parseAmount(totalLine) : Math.max(...allAmounts, 0);
  const subtotal = subtotalLine ? parseAmount(subtotalLine) : Math.max(0, total - (taxLine ? parseAmount(taxLine) : 0));
  const vat = taxLine ? parseAmount(taxLine) : Math.max(0, total - subtotal);

  const itemRows = lines
    .map((line, index) => {
      const match = line.match(/^(\d+)\s+(.+?)\s+([$₱]?\s*\d+(?:,\d{3})*(?:\.\d{2})?)\s+([$₱]?\s*\d+(?:,\d{3})*(?:\.\d{2})?)$/);
      if (!match) return null;

      const [, quantityText, description, unitPriceText, amountText] = match;
      const name = description.replace(/\b(subtotal|total|tax|amount|unit price)\b/gi, "").trim();

      if (!name || /description/i.test(name)) return null;

      return {
        id: `ocr-${index}`,
        name,
        quantity: Math.max(1, Number(quantityText) || 1),
        unit_price: parseAmount(unitPriceText),
        total: parseAmount(amountText),
      };
    })
    .filter((item): item is OcrItem => Boolean(item));

  const items = itemRows.length
    ? itemRows
    : total > 0
      ? [{ id: "ocr-total", name: merchant, quantity: 1, unit_price: total, total }]
      : [];

  return {
    status: items.length ? "scanned" : "needs_review",
    confidence: Math.round(confidence),
    merchant,
    date: toDateInputValue(dateMatch),
    time: "",
    cashier: "Not detected",
    payment_method: "other",
    suggested_category: /repair|auto|garage|transport|cable|brake/i.test(rawText) ? "Transport" : "Others",
    items,
    totals: {
      subtotal: subtotal || items.reduce((sum, item) => sum + item.total, 0),
      vat,
      total: total || items.reduce((sum, item) => sum + item.total, 0),
    },
    raw_text: rawText,
  };
}

function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function OcrScannerPage({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const name = getDisplayName(session);
  const { error } = useOcrScanner();
  const expenseMutation = useApiMutation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stage, setStage] = useState<OcrStage>("upload");
  const [progress, setProgress] = useState(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<OcrScanResult | null>(null);
  const [items, setItems] = useState<OcrItem[]>([]);
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState(fallbackScanResult.date);
  const [paymentMethod, setPaymentMethod] = useState<OcrScanResult["payment_method"]>("gcash");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !cameraStream) {
      return;
    }

    video.srcObject = cameraStream;
    void video.play().catch(() => {
      setCameraError("Camera preview could not start. Check browser camera permissions and try again.");
    });

    return () => {
      video.srcObject = null;
    };
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream(cameraStream);
    };
  }, [cameraStream]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);
  const vat = scanResult?.totals.vat ?? 0;
  const total = subtotal + vat;
  const isLowConfidence = Boolean(scanResult && isLowConfidenceOcr(scanResult.confidence));
  const isBlockedScan = Boolean(scanResult && shouldBlockOcrLogging(scanResult.confidence, total));
  const activeStep = stage === "upload" ? 1 : stage === "scanning" ? 2 : 3;

  function applyScanResult(result: unknown) {
    const normalizedResult = normalizeScanResult(result);
    const detectedDate = normalizedResult.date;
    const expenseDate = isCurrentMonth(detectedDate) ? detectedDate : getTodayInputValue();

    setScanResult(normalizedResult);
    setValidationError(null);
    setItems(normalizedResult.items);
    setCategory(normalizedResult.suggested_category);
    setDate(expenseDate);
    setPaymentMethod(normalizedResult.payment_method);

    if (detectedDate && detectedDate !== expenseDate) {
      setNotice(`Receipt date is ${formatReceiptDate(detectedDate)}. Expense date was set to today so Dashboard and Budget include it this month.`);
    }
  }

  async function startScan(file: File) {
    setStage("scanning");
    setProgress(6);
    setNotice(null);
    expenseMutation.reset();

    const progressTimer = window.setInterval(() => {
      setProgress((current) => Math.min(88, current + 7));
    }, 120);

    try {
      if (file) {
        const normalizedFile = await validateAndNormalizeOcrFile(file);
        const Tesseract = await import("tesseract.js");
        const result = await Tesseract.recognize(normalizedFile, "eng", {
          logger: (message) => {
            if (message.status === "recognizing text") {
              setProgress(Math.max(12, Math.min(96, Math.round(message.progress * 100))));
            }
          },
        });

        applyScanResult(parseReceiptText(result.data.text, result.data.confidence));
      }
    } catch (scanError: unknown) {
      applyScanResult({
        ...fallbackScanResult,
        status: "needs_review",
        confidence: 0,
        merchant: file?.name.replace(/\.[^.]+$/, "") || "Uploaded receipt",
        date: new Date().toISOString().slice(0, 10),
        cashier: "OCR failed",
        suggested_category: "Others",
        items: [],
        totals: { subtotal: 0, vat: 0, total: 0 },
        raw_text: "",
      });
      setNotice(scanError instanceof Error ? scanError.message : "OCR could not read this receipt. Try a clearer JPG or PNG image.");
    } finally {
      window.clearInterval(progressTimer);
      setProgress(100);
      window.setTimeout(() => setStage("review"), 250);
    }
  }

  function handleFile(file: File | null) {
    if (!file) return;

    closeCamera();
    setUploadFile(file);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    });
    void startScan(file);
  }

  async function openCamera() {
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera capture is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1700 },
        },
      });

      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (cameraAccessError: unknown) {
      setCameraError(cameraAccessError instanceof Error ? cameraAccessError.message : "Camera access was blocked.");
    }
  }

  function closeCamera() {
    stopCameraStream(cameraStream);
    setCameraStream(null);
    setIsCameraOpen(false);
  }

  async function captureReceipt() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("Camera is still loading. Hold the receipt steady and try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Unable to capture from this camera preview.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      setCameraError("Unable to create a receipt image from the camera.");
      return;
    }

    const file = new File([blob], `captured-receipt-${Date.now()}.jpg`, { type: "image/jpeg" });
    closeCamera();
    handleFile(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    handleFile(event.dataTransfer.files[0] ?? null);
  }

  function updateQuantity(itemId: string, nextValue: string) {
    const quantity = Math.max(1, Number(nextValue) || 1);

    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, quantity, total: quantity * item.unit_price }
          : item,
      ),
    );
  }

  async function logExpense() {
    if (!scanResult) return;

    if (total <= 0) {
      setValidationError("Please enter an amount greater than 0");
      return;
    }

    setValidationError(null);

    await expenseMutation.mutate<Expense>("/expenses", {
      method: "POST",
      body: JSON.stringify({
        amount: total,
        category,
        merchant: scanResult.merchant,
        date,
        payment_method: paymentMethod,
        ocr_raw: {
          confidence: scanResult.confidence,
          cashier: scanResult.cashier,
          items,
          notes,
          receipt_date: scanResult.date,
          expense_date: date,
          source: uploadFile?.name ?? "uploaded-receipt",
        },
      }),
    });

    setStage("logged");
    setNotice("Expense logged successfully.");
  }

  function resetScanner() {
    closeCamera();
    setStage("upload");
    setValidationError(null);
    setProgress(0);
    setUploadFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setScanResult(null);
    setItems([]);
    setCategory("Food");
    setDate(fallbackScanResult.date);
    setPaymentMethod("gcash");
    setNotes("");
    setNotice(null);
    setCameraError(null);
    expenseMutation.reset();
  }

  return (
    <DashboardShell
      activeLabel="OCR Scanner"
      title="OCR Scanner"
      subtitle="Scan a receipt to log expenses automatically"
      name={name}
      onSignOut={onSignOut}
    >
      <StepTracker activeStep={activeStep} stage={stage} />

      {stage === "upload" ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,615px)_300px]">
          <div className="space-y-3">
            {isCameraOpen ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="relative bg-slate-950">
                  <video ref={videoRef} className="aspect-[4/5] max-h-[430px] w-full object-cover" muted playsInline autoPlay />
                  <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-brand-primary/80" />
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-slate-950/70 text-white transition hover:bg-slate-900"
                    aria-label="Close camera"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex flex-col gap-2 p-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void captureReceipt()}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-dark"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" /> Capture receipt
                  </button>
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
                  >
                    Cancel
                  </button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            ) : (
              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="grid min-h-[280px] cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center shadow-sm transition hover:border-brand-primary hover:bg-brand-soft/50"
              >
                <input ref={fileInputRef} type="file" className="sr-only" accept="image/jpeg,image/png,application/pdf" capture="environment" onChange={handleFileChange} />
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-muted text-brand-primary">
                  <UploadCloud className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="mt-4 block text-sm font-semibold text-slate-950">Drop your receipt here</span>
                <span className="mt-1 block text-xs text-slate-500">or click to browse - JPG, PNG, PDF supported</span>
                <span className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-brand-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark">
                  Choose file
                </span>
              </label>
            )}
            {cameraError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{cameraError}</p> : null}
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => void openCamera()}
                disabled={isCameraOpen}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
              >
                <Camera className="h-4 w-4" aria-hidden="true" /> Open camera
              </button>
            </div>
          </div>

          <aside className="space-y-3">
            <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-950">Tips for best results</h2>
              <ul className="mt-4 space-y-3 text-xs text-slate-600">
                {["Lay the receipt flat", "Keep all text in focus", "Include the full receipt", "Avoid shadows and glare"].map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary" aria-hidden="true" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-lg bg-brand-muted p-4 text-xs leading-5 text-brand-dark">
              <h2 className="font-semibold">What Alalay can read</h2>
              <p className="mt-2">
                Merchant name, date, itemized list with prices, total amount, payment method. Supports thermal receipts, printed, and digital screenshots.
              </p>
              {error ? <p className="mt-2 text-red-700">{error}</p> : null}
            </article>
          </aside>
        </section>
      ) : null}

      {stage === "scanning" ? (
        <section className="mt-10 flex flex-col items-center">
          <ReceiptPreview previewUrl={previewUrl} fileName={uploadFile?.name} progress={progress} />
          <div className="mt-5 text-center">
            <h2 className="text-sm font-semibold text-slate-950">Analyzing receipt...</h2>
            <p className="mt-1 text-xs text-slate-500">Detecting merchant, items, and totals</p>
          </div>
          <div className="mt-5 w-full max-w-[260px]">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-primary transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Processing...</span>
              <span className="font-semibold text-brand-primary">{progress}%</span>
            </div>
          </div>
        </section>
      ) : null}

      {(stage === "review" || stage === "logged") && scanResult ? (
        <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-muted px-2.5 py-1 text-xs font-semibold text-brand-primary">
                      <Check className="h-3 w-3" aria-hidden="true" /> Scanned
                    </span>
                    <span className="text-xs text-slate-500">Confidence: {scanResult.confidence}%</span>
                  </div>
                  <h2 className="mt-2 text-base font-bold text-slate-950">{scanResult.merchant}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatReceiptDate(scanResult.date)} - {scanResult.time}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStage("upload")}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:border-brand-primary hover:text-brand-primary"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoTile label="Cashier" value={scanResult.cashier} />
                <InfoTile label="Payment" value={paymentLabel(scanResult.payment_method)} />
              </div>
            </article>

            {isLowConfidence ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
                <p className="font-semibold">We had trouble reading this receipt.</p>
                <p className="mt-1">Please review all fields carefully before logging.</p>
                {isBlockedScan ? (
                  <p className="mt-1 font-medium">Logging is disabled until a total greater than ₱0 is available.</p>
                ) : null}
              </div>
            ) : null}

            <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-950">Items ({items.length})</h2>
                <span className="text-xs text-slate-500">Adjust quantity before logging</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500">
                      <th className="px-4 py-3">Item</th>
                      <th className="w-24 px-4 py-3">Qty</th>
                      <th className="w-32 px-4 py-3">Unit price</th>
                      <th className="w-28 px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-950">{item.name}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(event) => updateQuantity(item.id, event.target.value)}
                            className="h-8 w-12 rounded-full border border-slate-200 text-center text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-muted"
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-950">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 text-xs">
                    <tr>
                      <td colSpan={3} className="px-4 pb-1 pt-4 text-slate-500">Subtotal</td>
                      <td className="px-4 pb-1 pt-4 text-right text-slate-700">{formatCurrency(subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-1 text-slate-500">VAT (12%)</td>
                      <td className="px-4 py-1 text-right text-slate-700">{formatCurrency(vat)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 pb-4 pt-1 font-semibold text-slate-950">Total</td>
                      <td className="px-4 pb-4 pt-1 text-right font-bold text-slate-950">{formatCurrency(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </article>

            {scanResult.raw_text ? (
              <details className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm">
                <summary className="cursor-pointer font-semibold text-slate-950">Raw OCR text</summary>
                <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans leading-5">{scanResult.raw_text}</pre>
              </details>
            ) : null}
          </div>

          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-8 xl:self-start">
            <h2 className="text-sm font-semibold text-slate-950">Log as expense</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-700">Category</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {categories.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCategory(option)}
                      className={`h-8 rounded-full border px-3 text-xs font-medium transition ${
                        category === option
                          ? "border-brand-primary bg-brand-muted text-brand-primary"
                          : "border-slate-200 bg-white text-slate-600 hover:border-brand-primary hover:text-brand-primary"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5"><CategoryIcon category={option} />{option}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-700">Expense date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-muted"
                />
                {scanResult.date !== date ? (
                  <span className="mt-1 block text-xs text-slate-500">
                    Receipt date detected: {formatReceiptDate(scanResult.date)}
                  </span>
                ) : null}
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-700">Payment method</span>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as OcrScanResult["payment_method"])}
                  className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-muted"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-700">Notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Add a note..."
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-muted"
                />
              </label>

              <div className="rounded-lg bg-brand-muted px-3 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-brand-dark">Total to log</span>
                  <span className="font-bold text-brand-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              {notice ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p> : null}
              {validationError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{validationError}</p> : null}
              {expenseMutation.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{expenseMutation.error}</p> : null}

              <button
                type="button"
                onClick={() => void logExpense()}
                disabled={expenseMutation.isSubmitting || stage === "logged" || isBlockedScan}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {expenseMutation.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {isBlockedScan ? "Review receipt before logging" : stage === "logged" ? "Expense logged" : "Log expense"}
              </button>

              <button
                type="button"
                onClick={resetScanner}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:border-brand-primary hover:text-brand-primary"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Scan a different receipt
              </button>
            </div>
          </aside>
        </section>
      ) : null}
    </DashboardShell>
  );
}

function StepTracker({ activeStep, stage }: { activeStep: number; stage: OcrStage }) {
  const steps = ["Upload", "Scan", "Review"];

  return (
    <section className="flex flex-wrap items-center gap-3">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isComplete = activeStep > stepNumber || stage === "logged";
        const isActive = activeStep === stepNumber && stage !== "logged";

        return (
          <div key={label} className="flex items-center gap-3">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                isComplete || isActive ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {isComplete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : stepNumber}
            </span>
            <span className={`text-xs ${isActive ? "font-semibold text-slate-950" : "text-slate-500"}`}>{label}</span>
            {index < steps.length - 1 ? <span className={`h-px w-12 ${activeStep > stepNumber ? "bg-brand-primary" : "bg-slate-200"}`} /> : null}
          </div>
        );
      })}
    </section>
  );
}

function ReceiptPreview({ previewUrl, fileName, progress }: { previewUrl: string | null; fileName?: string; progress: number }) {
  return (
    <div className="relative h-[340px] w-[260px] overflow-hidden rounded-xl border-2 border-brand-primary bg-[#151817] shadow-sm">
      {previewUrl ? (
        <img src={previewUrl} alt={fileName ?? "Receipt preview"} className="h-full w-full object-cover opacity-80 grayscale" />
      ) : (
        <div className="absolute inset-0 p-5">
          <ReceiptText className="h-8 w-8 text-slate-500" aria-hidden="true" />
          <div className="mt-20 space-y-2">
            {[70, 42, 55, 45, 60, 35, 50, 65, 42, 80, 55].map((width, index) => (
              <span key={index} className="block h-1.5 rounded-full bg-slate-400" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 h-px bg-brand-primary shadow-[0_0_20px_rgba(15,138,107,0.9)] transition-all duration-200" style={{ top: `${Math.max(7, Math.min(92, progress))}%` }} />
      <div className="absolute inset-x-0 h-10 bg-brand-primary/15 transition-all duration-200" style={{ top: `${Math.max(7, Math.min(88, progress - 3))}%` }} />
      <ScanLine className="absolute left-2 top-2 h-4 w-4 text-brand-primary" aria-hidden="true" />
      <ScanLine className="absolute right-2 top-2 h-4 w-4 rotate-90 text-brand-primary" aria-hidden="true" />
      <ScanLine className="absolute bottom-2 left-2 h-4 w-4 -rotate-90 text-brand-primary" aria-hidden="true" />
      <ScanLine className="absolute bottom-2 right-2 h-4 w-4 rotate-180 text-brand-primary" aria-hidden="true" />
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}
