import { zodResolver } from "@hookform/resolvers/zod";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useEffect, useId } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { useApiMutation } from "../../hooks/useApiMutation";
import type {
  Bill,
  BudgetSummary,
  Expense,
  IncomeEntry,
  SavingsGoal,
  Subscription,
} from "../../hooks/types";
import { Button } from "../ui/Button";
import { SlideOver } from "../ui/SlideOver";
import { TextInput } from "../ui/TextInput";

type FormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);

function toOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

function SelectField({
  id,
  label,
  error,
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      <select
        id={id}
        className={`min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 ${className}`}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </label>
  );
}

function TextAreaField({
  id,
  label,
  error,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      <textarea
        id={id}
        className={`min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 ${className}`}
        {...props}
      />
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </label>
  );
}

function CheckboxField({
  id,
  label,
  description,
  ...props
}: {
  id: string;
  label: string;
  description?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
        {...props}
      />
      <span>
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        {description ? (
          <span className="mt-1 block text-sm text-slate-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

function DialogActions({
  formId,
  onClose,
  isSubmitting,
  submitLabel,
}: {
  formId: string;
  onClose: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
      >
        Cancel
      </button>
      <Button form={formId} type="submit" isLoading={isSubmitting}>
        {submitLabel}
      </Button>
    </div>
  );
}

const billSchema = z
  .object({
    title: z.string().trim().min(1, "Biller name is required"),
    amount: z.coerce.number().positive("Amount must be greater than zero"),
    category: z.string().trim().min(1, "Category is required"),
    due_date: z.string().date("Due date is required"),
    recurring: z.boolean(),
    frequency: z.enum(["monthly", "weekly", "yearly", "quarterly"]).optional(),
    notes: z.string().optional(),
    attachment_url: z.union([z.string().url("Enter a valid URL"), z.literal("")]).optional(),
  })
  .superRefine((values, context) => {
    if (values.recurring && !values.frequency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["frequency"],
        message: "Choose how often this bill repeats",
      });
    }
  });

type BillFormValues = z.infer<typeof billSchema>;

function defaultBillValues(): BillFormValues {
  return {
    title: "",
    amount: 0,
    category: "",
    due_date: todayInputValue(),
    recurring: false,
    frequency: undefined,
    notes: "",
    attachment_url: "",
  };
}

export function BillFormPanel({ open, onClose, onSuccess }: FormDialogProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: defaultBillValues(),
  });
  const recurring = watch("recurring");

  useEffect(() => {
    if (open) {
      reset(defaultBillValues());
      resetMutation();
    }
  }, [open, reset, resetMutation]);

  async function onSubmit(values: BillFormValues) {
    await mutate<Bill>("/bills", {
      method: "POST",
      body: JSON.stringify({
        ...values,
        frequency: values.recurring ? values.frequency : null,
        notes: toOptionalString(values.notes),
        attachment_url: toOptionalString(values.attachment_url),
      }),
    });
    onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Add bill"
      description="Track a due date and let the backend handle the saved bill record."
      footer={
        <DialogActions formId={formId} onClose={onClose} isSubmitting={isSubmitting} submitLabel="Save bill" />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <TextInput
          id="bill-title"
          label="Biller"
          placeholder="Meralco"
          error={errors.title?.message}
          {...register("title")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="bill-amount"
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="2500"
            error={errors.amount?.message}
            {...register("amount")}
          />
          <TextInput
            id="bill-category"
            label="Category"
            placeholder="Utilities"
            error={errors.category?.message}
            {...register("category")}
          />
        </div>

        <TextInput
          id="bill-due-date"
          label="Due date"
          type="date"
          error={errors.due_date?.message}
          {...register("due_date")}
        />

        <CheckboxField
          id="bill-recurring"
          label="Recurring bill"
          description="Turn this on for monthly or repeating bills."
          {...register("recurring")}
        />

        <SelectField
          id="bill-frequency"
          label="Frequency"
          disabled={!recurring}
          error={errors.frequency?.message}
          {...register("frequency")}
        >
          <option value="">Select frequency</option>
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </SelectField>

        <TextInput
          id="bill-attachment-url"
          label="Attachment URL"
          type="url"
          placeholder="https://..."
          error={errors.attachment_url?.message}
          {...register("attachment_url")}
        />

        <TextAreaField
          id="bill-notes"
          label="Notes"
          placeholder="Account number, reminder note, or backend-friendly context."
          error={errors.notes?.message}
          {...register("notes")}
        />
      </form>
    </SlideOver>
  );
}

const subscriptionSchema = z.object({
  name: z.string().trim().min(1, "Subscription name is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  renewal_date: z.string().date("Renewal date is required"),
  billing_cycle: z.enum(["monthly", "yearly"]),
  auto_renew: z.boolean(),
  logo_url: z.union([z.string().url("Enter a valid URL"), z.literal("")]).optional(),
});

type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;

function defaultSubscriptionValues(): SubscriptionFormValues {
  return {
    name: "",
    amount: 0,
    renewal_date: todayInputValue(),
    billing_cycle: "monthly",
    auto_renew: true,
    logo_url: "",
  };
}

export function SubscriptionFormPanel({
  open,
  onClose,
  onSuccess,
}: FormDialogProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: defaultSubscriptionValues(),
  });

  useEffect(() => {
    if (open) {
      reset(defaultSubscriptionValues());
      resetMutation();
    }
  }, [open, reset, resetMutation]);

  async function onSubmit(values: SubscriptionFormValues) {
    await mutate<Subscription>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        ...values,
        logo_url: toOptionalString(values.logo_url),
      }),
    });
    onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Add subscription"
      description="Send a new recurring subscription to the backend subscription tracker."
      footer={
        <DialogActions formId={formId} onClose={onClose} isSubmitting={isSubmitting} submitLabel="Save subscription" />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <TextInput
          id="subscription-name"
          label="Subscription name"
          placeholder="Netflix"
          error={errors.name?.message}
          {...register("name")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="subscription-amount"
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="549"
            error={errors.amount?.message}
            {...register("amount")}
          />
          <TextInput
            id="subscription-renewal-date"
            label="Renewal date"
            type="date"
            error={errors.renewal_date?.message}
            {...register("renewal_date")}
          />
        </div>

        <SelectField
          id="subscription-billing-cycle"
          label="Billing cycle"
          error={errors.billing_cycle?.message}
          {...register("billing_cycle")}
        >
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </SelectField>

        <TextInput
          id="subscription-logo-url"
          label="Logo URL"
          type="url"
          placeholder="https://..."
          error={errors.logo_url?.message}
          {...register("logo_url")}
        />

        <CheckboxField
          id="subscription-auto-renew"
          label="Auto renew"
          description="Keep this on if the subscription renews automatically."
          {...register("auto_renew")}
        />
      </form>
    </SlideOver>
  );
}

const expenseSchema = z.object({
  merchant: z.string().trim().min(1, "Merchant is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  category: z.string().trim().min(1, "Category is required"),
  date: z.string().date("Date is required"),
  payment_method: z.enum(["cash", "card", "gcash", "maya", "bank_transfer", "other"]),
  receipt_url: z.union([z.string().url("Enter a valid URL"), z.literal("")]).optional(),
  is_split: z.boolean(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

function defaultExpenseValues(): ExpenseFormValues {
  return {
    merchant: "",
    amount: 0,
    category: "",
    date: todayInputValue(),
    payment_method: "cash",
    receipt_url: "",
    is_split: false,
  };
}

export function ExpenseFormPanel({ open, onClose, onSuccess }: FormDialogProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: defaultExpenseValues(),
  });

  useEffect(() => {
    if (open) {
      reset(defaultExpenseValues());
      resetMutation();
    }
  }, [open, reset, resetMutation]);

  async function onSubmit(values: ExpenseFormValues) {
    await mutate<Expense>("/expenses", {
      method: "POST",
      body: JSON.stringify({
        ...values,
        receipt_url: toOptionalString(values.receipt_url),
      }),
    });
    onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Log expense"
      description="Capture the purchase details and let the backend store the final expense record."
      footer={
        <DialogActions formId={formId} onClose={onClose} isSubmitting={isSubmitting} submitLabel="Save expense" />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <TextInput
          id="expense-merchant"
          label="Merchant"
          placeholder="Mercury Drug"
          error={errors.merchant?.message}
          {...register("merchant")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="expense-amount"
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="385.5"
            error={errors.amount?.message}
            {...register("amount")}
          />
          <TextInput
            id="expense-date"
            label="Date"
            type="date"
            error={errors.date?.message}
            {...register("date")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="expense-category"
            label="Category"
            placeholder="Health"
            error={errors.category?.message}
            {...register("category")}
          />
          <SelectField
            id="expense-payment-method"
            label="Payment method"
            error={errors.payment_method?.message}
            {...register("payment_method")}
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="gcash">GCash</option>
            <option value="maya">Maya</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </SelectField>
        </div>

        <TextInput
          id="expense-receipt-url"
          label="Receipt URL"
          type="url"
          placeholder="https://..."
          error={errors.receipt_url?.message}
          {...register("receipt_url")}
        />

        <CheckboxField
          id="expense-is-split"
          label="Split expense"
          description="Use this when the backend should mark the entry as shared."
          {...register("is_split")}
        />
      </form>
    </SlideOver>
  );
}

const incomeSchema = z.object({
  source: z.string().trim().min(1, "Income source is required"),
  type: z.enum(["salary", "freelance", "business", "remittance", "other"]),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  date: z.string().date("Date is required"),
  is_recurring: z.boolean(),
});

type IncomeFormValues = z.infer<typeof incomeSchema>;

function defaultIncomeValues(): IncomeFormValues {
  return {
    source: "",
    type: "salary",
    amount: 0,
    date: todayInputValue(),
    is_recurring: false,
  };
}

export function IncomeFormPanel({ open, onClose, onSuccess }: FormDialogProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: defaultIncomeValues(),
  });

  useEffect(() => {
    if (open) {
      reset(defaultIncomeValues());
      resetMutation();
    }
  }, [open, reset, resetMutation]);

  async function onSubmit(values: IncomeFormValues) {
    await mutate<IncomeEntry>("/income", {
      method: "POST",
      body: JSON.stringify(values),
    });
    onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Add income"
      description="Collect the income details here and send them straight to the backend income endpoint."
      footer={
        <DialogActions formId={formId} onClose={onClose} isSubmitting={isSubmitting} submitLabel="Save income" />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <TextInput
          id="income-source"
          label="Source"
          placeholder="ACME Payroll"
          error={errors.source?.message}
          {...register("source")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="income-type"
            label="Type"
            error={errors.type?.message}
            {...register("type")}
          >
            <option value="salary">Salary</option>
            <option value="freelance">Freelance</option>
            <option value="business">Business</option>
            <option value="remittance">Remittance</option>
            <option value="other">Other</option>
          </SelectField>
          <TextInput
            id="income-amount"
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="35000"
            error={errors.amount?.message}
            {...register("amount")}
          />
        </div>

        <TextInput
          id="income-date"
          label="Date received"
          type="date"
          error={errors.date?.message}
          {...register("date")}
        />

        <CheckboxField
          id="income-recurring"
          label="Recurring income"
          description="Turn this on if the source repeats on a fixed schedule."
          {...register("is_recurring")}
        />
      </form>
    </SlideOver>
  );
}

const savingsGoalSchema = z.object({
  title: z.string().trim().min(1, "Goal title is required"),
  emoji: z.string().max(8, "Keep the emoji short").optional(),
  target_amount: z.coerce.number().positive("Target amount must be greater than zero"),
  current_amount: z.coerce.number().nonnegative("Current amount cannot be negative"),
  deadline: z.string().date("Deadline is required"),
});

type SavingsGoalFormValues = z.infer<typeof savingsGoalSchema>;

function defaultSavingsGoalValues(): SavingsGoalFormValues {
  return {
    title: "",
    emoji: "",
    target_amount: 0,
    current_amount: 0,
    deadline: todayInputValue(),
  };
}

export function SavingsGoalFormPanel({
  open,
  onClose,
  onSuccess,
}: FormDialogProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SavingsGoalFormValues>({
    resolver: zodResolver(savingsGoalSchema),
    defaultValues: defaultSavingsGoalValues(),
  });

  useEffect(() => {
    if (open) {
      reset(defaultSavingsGoalValues());
      resetMutation();
    }
  }, [open, reset, resetMutation]);

  async function onSubmit(values: SavingsGoalFormValues) {
    await mutate<SavingsGoal>("/savings-goals", {
      method: "POST",
      body: JSON.stringify({
        ...values,
        emoji: toOptionalString(values.emoji),
      }),
    });
    onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Create savings goal"
      description="Set the target and starting amount here, then let the backend calculate the saved record."
      footer={
        <DialogActions formId={formId} onClose={onClose} isSubmitting={isSubmitting} submitLabel="Save goal" />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <TextInput
          id="goal-title"
          label="Goal title"
          placeholder="Laptop fund"
          error={errors.title?.message}
          {...register("title")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="goal-emoji"
            label="Emoji"
            placeholder="Optional"
            error={errors.emoji?.message}
            {...register("emoji")}
          />
          <TextInput
            id="goal-deadline"
            label="Deadline"
            type="date"
            error={errors.deadline?.message}
            {...register("deadline")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="goal-target-amount"
            label="Target amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="50000"
            error={errors.target_amount?.message}
            {...register("target_amount")}
          />
          <TextInput
            id="goal-current-amount"
            label="Current amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="10000"
            error={errors.current_amount?.message}
            {...register("current_amount")}
          />
        </div>
      </form>
    </SlideOver>
  );
}

const budgetCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  budget: z.coerce.number().nonnegative("Budget cannot be negative"),
});

const budgetSchema = z.object({
  categories: z.array(budgetCategorySchema).min(1, "At least one category is required"),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

function buildBudgetDefaults(
  categories: BudgetSummary["categories"],
): BudgetFormValues {
  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      budget: category.budget,
    })),
  };
}

type BudgetFormPanelProps = FormDialogProps & {
  categories: BudgetSummary["categories"];
};

export function BudgetFormPanel({
  open,
  onClose,
  onSuccess,
  categories,
}: BudgetFormPanelProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: buildBudgetDefaults(categories),
  });
  const { fields } = useFieldArray({
    control,
    name: "categories",
  });

  useEffect(() => {
    if (open) {
      reset(buildBudgetDefaults(categories));
      resetMutation();
    }
  }, [open, categories, reset, resetMutation]);

  async function onSubmit(values: BudgetFormValues) {
    await mutate<BudgetSummary>("/budget", {
      method: "PATCH",
      body: JSON.stringify({
        categories: values.categories.map((category) => ({
          id: category.id,
          budget: category.budget,
        })),
      }),
    });
    onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Edit monthly budget"
      description="Adjust the category targets here and send the new budget plan to the backend."
      footer={
        <DialogActions formId={formId} onClose={onClose} isSubmitting={isSubmitting} submitLabel="Save budget" />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
            >
              <div className="grid gap-4 sm:grid-cols-[1fr_180px] sm:items-end">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {field.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Backend budget amount for this category
                  </p>
                </div>
                <TextInput
                  id={`budget-category-${field.id}`}
                  label="Budget"
                  type="number"
                  min="0"
                  step="0.01"
                  error={errors.categories?.[index]?.budget?.message}
                  {...register(`categories.${index}.budget`)}
                />
              </div>
              <input type="hidden" {...register(`categories.${index}.id`)} />
              <input type="hidden" {...register(`categories.${index}.name`)} />
            </div>
          ))}
        </div>
      </form>
    </SlideOver>
  );
}
