import { zodResolver } from '@hookform/resolvers/zod';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useEffect, useId, useRef } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { z } from 'zod';
import { useApiMutation } from '../../hooks/useApiMutation';
import { useApiQuery } from '../../hooks/useApiQuery';
import type {
  Bill,
  BudgetSummary,
  Expense,
  IncomeEntry,
  SavingsGoal,
  Subscription,
  Wallet,
} from '../../hooks/types';
import { formatCurrency } from '../../utils/formatters';
import { getMonthlyNeeded } from '../../utils/savingsGoals';
import { getCategories } from '../../lib/appSettings';
import { Button } from '../ui/Button';
import { SlideOver } from '../ui/SlideOver';
import { TextInput } from '../ui/TextInput';
import { CurrencyInput } from '../ui/CurrencyInput';
import { CategorySelect } from '../ui/CategorySelect';
import { institutionFor } from '@shared/institution-registry';
import {
  incomeCategoryKeys,
  subscriptionCategoryDefinitions,
} from '@shared/category-registry';

type FormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (result?: unknown) => void | Promise<void>;
};

type IncomeFormPanelProps = FormDialogProps & {
  income?: IncomeEntry | null;
};

type BillFormPanelProps = FormDialogProps & {
  bill?: Bill | null;
};

type SubscriptionFormPanelProps = FormDialogProps & {
  subscription?: Subscription | null;
};

type ExpenseFormPanelProps = FormDialogProps & {
  expense?: Expense | null;
};

type SavingsGoalFormPanelProps = FormDialogProps & {
  goal?: SavingsGoal | null;
};

type SavingsGoalProgressPanelProps = FormDialogProps & {
  goal: SavingsGoal | null;
};

const billCategoryOptions = getCategories('expense').map((category) => category.name);
const subscriptionCategoryOptions = subscriptionCategoryDefinitions.map((category) => category.label);

function isPresetBillCategory(category: string | null | undefined) {
  return billCategoryOptions.includes((category ?? '') as (typeof billCategoryOptions)[number]);
}

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
  className = '',
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
  className = '',
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
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
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
    title: z.string().trim().min(1, 'Biller name is required'),
    amount: z.coerce.number().positive('Please enter an amount greater than 0'),
    category: z.string().trim().min(1, 'Category is required'),
    custom_category: z.string().optional(),
    due_date: z.string().date('Due date is required'),
    recurring: z.boolean(),
    frequency: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['monthly', 'weekly', 'yearly', 'quarterly']).optional(),
    ),
    notes: z.string().optional(),
    attachment_url: z.union([z.string().url('Enter a valid URL'), z.literal('')]).optional(),
    wallet_id: z.string().uuid().nullable().optional(),
    credit_wallet_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((values, context) => {
    if (values.recurring && !values.frequency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['frequency'],
        message: 'Select how often this bill repeats.',
      });
    }

    if (values.category === 'Other' && !values.custom_category?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['custom_category'],
        message: 'Enter a custom category',
      });
    }
  });

type BillFormInput = z.input<typeof billSchema>;
type BillFormValues = z.output<typeof billSchema>;

function defaultBillValues(bill?: Bill | null): BillFormInput {
  const existingCategory = bill?.category ?? '';
  const isPresetCategory = isPresetBillCategory(existingCategory);

  return {
    title: bill?.title ?? '',
    amount: bill ? Number(bill.amount) : undefined,
    category: existingCategory ? (isPresetCategory ? existingCategory : 'Other') : '',
    custom_category: existingCategory && !isPresetCategory ? existingCategory : '',
    due_date: bill?.next_due_date ?? bill?.due_date ?? todayInputValue(),
    recurring: bill ? Boolean(bill.recurring) : false,
    frequency: bill?.frequency ?? undefined,
    notes: bill?.notes ?? '',
    attachment_url: bill?.attachment_url ?? '',
    wallet_id: bill?.wallet_id ?? null,
    credit_wallet_id: bill?.credit_wallet_id ?? null,
  };
}

export function BillFormPanel({ open, onClose, onSuccess, bill }: BillFormPanelProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
    control,
    setValue,
  } = useForm<BillFormInput, unknown, BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: defaultBillValues(bill),
    shouldUnregister: true,
  });
  const recurring = watch('recurring');
  const frequency = watch('frequency');
  const category = watch('category');
  const walletId = watch('wallet_id');
  const creditWalletId = watch('credit_wallet_id');

  useEffect(() => {
    if (open) {
      reset(defaultBillValues(bill));
      resetMutation();
    }
  }, [bill, open, reset, resetMutation]);

  useEffect(() => {
    if (!recurring && frequency) {
      setValue('frequency', undefined, { shouldDirty: true, shouldValidate: true });
    }
  }, [frequency, recurring, setValue]);

  async function onSubmit(values: BillFormValues) {
    const { custom_category, ...restValues } = values;
    const payload = {
      ...restValues,
      category:
        values.category === 'Other' ? (custom_category?.trim() ?? 'Other') : values.category,
      frequency: values.recurring ? values.frequency : null,
      notes: toOptionalString(values.notes),
      attachment_url: toOptionalString(values.attachment_url),
    };

    if (bill) {
      await mutate<Bill>(`/bills/${bill.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await mutate<Bill>('/bills', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={bill ? 'Edit bill' : 'Add bill'}
      description="Keep the bill details clean, categorized, and easy to review later."
      footer={
        <DialogActions
          formId={formId}
          onClose={onClose}
          isSubmitting={isSubmitting}
          submitLabel={bill ? 'Update bill' : 'Save bill'}
        />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <TextInput
          id="bill-title"
          label="Biller"
          placeholder="Meralco"
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormCurrencyInput
            id="bill-amount"
            label="Amount"
            control={control}
            name="amount"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            error={errors.amount?.message}
          />
          <CategorySelect
            id="bill-category"
            label="Category"
            value={category}
            options={billCategoryOptions}
            onChange={(value) =>
              setValue('category', value, { shouldDirty: true, shouldValidate: true })
            }
            error={errors.category?.message}
          />
        </div>

        {category === 'Other' ? (
          <TextInput
            id="bill-custom-category"
            label="Custom category"
            placeholder="Enter your category"
            error={errors.custom_category?.message}
            {...register('custom_category')}
          />
        ) : null}

        <TextInput
          id="bill-due-date"
          label="Due date"
          type="date"
          error={errors.due_date?.message}
          {...register('due_date')}
        />

        <WalletSelector
          id="bill-wallet"
          label="Payment method"
          value={walletId}
          excludeCredit
          onChange={(value) => setValue('wallet_id', value || null, { shouldDirty: true })}
        />

        <WalletSelector
          id="bill-credit-wallet"
          label="Credit statement account (optional)"
          value={creditWalletId}
          onlyCredit
          onChange={(value) =>
            setValue('credit_wallet_id', value || null, { shouldDirty: true })
          }
          emptyMessage="Add a credit wallet before linking a statement."
        />

        <CheckboxField
          id="bill-recurring"
          label="Recurring bill"
          description="Turn this on for monthly or repeating bills."
          {...register('recurring')}
        />

        {recurring ? (
          <SelectField
            id="bill-frequency"
            label="Frequency"
            error={errors.frequency?.message}
            {...register('frequency')}
          >
            <option value="">Select frequency</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </SelectField>
        ) : null}

        <div>
          <TextInput
            id="bill-attachment-url"
            label="Bill link"
            type="url"
            placeholder="https://..."
            error={errors.attachment_url?.message}
            {...register('attachment_url')}
          />
          <p className="mt-2 text-xs text-slate-500">
            Optional. Add a billing portal or statement link. Alalay will use the site's logo when
            available.
          </p>
        </div>

        <TextAreaField
          id="bill-notes"
          label="Notes"
          placeholder="Account number, reminder note, or backend-friendly context."
          error={errors.notes?.message}
          {...register('notes')}
        />
      </form>
    </SlideOver>
  );
}

const subscriptionSchema = z.object({
  name: z.string().trim().min(1, 'Subscription name is required'),
  category: z.string().trim().min(1, 'Select a subscription category'),
  custom_category: z.string().optional(),
  amount: z.coerce.number().positive('Please enter an amount greater than 0'),
  renewal_date: z.string().date('Renewal date is required'),
  billing_cycle: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  auto_renew: z.boolean(),
  last_used_at: z.string().optional(),
  logo_url: z.union([z.string().url('Enter a valid URL'), z.literal('')]).optional(),
  wallet_id: z.string().uuid('Choose a payment wallet'),
}).superRefine((values, context) => {
  if (values.category === 'Other' && !values.custom_category?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['custom_category'], message: 'Specify the subscription category' });
  }
});

type SubscriptionFormInput = z.input<typeof subscriptionSchema>;
type SubscriptionFormValues = z.output<typeof subscriptionSchema>;

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function defaultSubscriptionValues(subscription?: Subscription | null): SubscriptionFormInput {
  return {
    name: subscription?.name ?? '',
    category: subscription?.category ?? '',
    custom_category: subscription?.custom_category ?? '',
    amount: subscription ? Number(subscription.amount) : undefined,
    renewal_date: subscription?.renewal_date ?? todayInputValue(),
    billing_cycle: subscription?.billing_cycle ?? 'monthly',
    auto_renew: subscription ? Boolean(subscription.auto_renew) : true,
    last_used_at: dateInputValue(subscription?.last_used_at),
    logo_url: subscription?.logo_url ?? '',
    wallet_id: subscription?.wallet_id ?? '',
  };
}

export function SubscriptionFormPanel({
  open,
  onClose,
  onSuccess,
  subscription,
}: SubscriptionFormPanelProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    control,
    setValue,
    watch,
  } = useForm<SubscriptionFormInput, unknown, SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: defaultSubscriptionValues(subscription),
  });
  const walletId = watch('wallet_id');

  useEffect(() => {
    if (open) {
      reset(defaultSubscriptionValues(subscription));
      resetMutation();
    }
  }, [open, reset, resetMutation, subscription]);

  async function onSubmit(values: SubscriptionFormValues) {
    const payload = {
      ...values,
      custom_category:
        values.category === 'Other' ? toOptionalString(values.custom_category) ?? null : null,
      logo_url: toOptionalString(values.logo_url),
      last_used_at: values.last_used_at
        ? new Date(`${values.last_used_at}T00:00:00`).toISOString()
        : null,
    };

    if (subscription) {
      await mutate<Subscription>(`/subscriptions/${subscription.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await mutate<Subscription>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={subscription ? 'Edit subscription' : 'Add subscription'}
      description="Save the details you know so Alalay can review renewals locally."
      footer={
        <DialogActions
          formId={formId}
          onClose={onClose}
          isSubmitting={isSubmitting}
          submitLabel={subscription ? 'Update subscription' : 'Save subscription'}
        />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <TextInput
          id="subscription-name"
          label="Subscription name"
          placeholder="Netflix"
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormCurrencyInput
            id="subscription-amount"
            label="Amount"
            control={control}
            name="amount"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            error={errors.amount?.message}
          />
          <TextInput
            id="subscription-renewal-date"
            label="Renewal date"
            type="date"
            error={errors.renewal_date?.message}
            {...register('renewal_date')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CategorySelect
            id="subscription-category"
            label="Category"
            value={watch('category')}
            options={subscriptionCategoryOptions}
            onChange={(value) => setValue('category', value, { shouldDirty: true, shouldValidate: true })}
            error={errors.category?.message}
          />
          <SelectField
            id="subscription-billing-cycle"
            label="Billing cycle"
            error={errors.billing_cycle?.message}
            {...register('billing_cycle')}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </SelectField>
        </div>

        {watch('category') === 'Other' ? (
          <TextInput
            id="subscription-custom-category"
            label="Specify category"
            placeholder="e.g. Professional membership"
            error={errors.custom_category?.message}
            {...register('custom_category')}
          />
        ) : null}

        <WalletSelector
          id="subscription-wallet"
          label="Payment method"
          value={walletId}
          required
          error={errors.wallet_id?.message}
          onChange={(value) =>
            setValue('wallet_id', value, { shouldDirty: true, shouldValidate: true })
          }
        />

        <TextInput
          id="subscription-logo-url"
          label="Subscription link"
          type="url"
          placeholder="https://..."
          error={errors.logo_url?.message}
          {...register('logo_url')}
        />
        <p className="-mt-3 text-xs text-slate-500">
          Optional. Add the service website so the card can show its logo and open the link.
        </p>

        <TextInput
          id="subscription-last-used"
          label="Last used"
          type="date"
          error={errors.last_used_at?.message}
          {...register('last_used_at')}
        />
        <p className="-mt-3 text-xs text-slate-500">
          Optional manual date. Alalay does not check provider activity or app usage.
        </p>

        <CheckboxField
          id="subscription-auto-renew"
          label="Renewal reminder"
          description="Local tracking only. This does not change renewal, billing, or cancellation settings with the provider."
          {...register('auto_renew')}
        />
      </form>
    </SlideOver>
  );
}

const expenseSchema = z.object({
  merchant: z.string().trim().min(1, 'Merchant is required'),
  amount: z.coerce.number().positive('Please enter an amount greater than 0'),
  category: z.string().trim().min(1, 'Category is required'),
  date: z.string().date('Date is required'),
  receipt_url: z.union([z.string().url('Enter a valid URL'), z.literal('')]).optional(),
  is_split: z.boolean(),
  wallet_id: z.string().uuid('Select a payment method.'),
});

type ExpenseFormInput = z.input<typeof expenseSchema>;
type ExpenseFormValues = z.output<typeof expenseSchema>;

function defaultExpenseValues(expense?: Expense | null): ExpenseFormInput {
  return {
    merchant: expense?.merchant ?? '',
    amount: expense ? Number(expense.amount) : undefined,
    category: expense?.category ?? '',
    date: expense?.date ?? todayInputValue(),
    receipt_url: expense?.receipt_url ?? '',
    is_split: Boolean(expense?.is_split),
    wallet_id: expense?.wallet_id ?? '',
  };
}

function WalletSelector({
  id,
  label,
  value,
  onChange,
  required = false,
  excludeCredit = false,
  onlyCredit = false,
  error,
  emptyMessage = 'Add a wallet before continuing.',
}: {
  id: string;
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  required?: boolean;
  excludeCredit?: boolean;
  onlyCredit?: boolean;
  error?: string;
  emptyMessage?: string;
}) {
  const { data: wallets, isLoading, error: walletError } = useApiQuery<Wallet[]>('/wallets');
  const eligibleWallets = (wallets ?? []).filter(
    (wallet) =>
      onlyCredit
        ? wallet.account_type === 'credit'
        : !excludeCredit || wallet.account_type !== 'credit',
  );
  const selectorError =
    error ??
    (walletError ? 'Payment accounts are unavailable.' : undefined) ??
    (eligibleWallets.length === 0 && !isLoading && required ? emptyMessage : undefined);

  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      <select
        id={id}
        value={value ?? ''}
        required={required}
        disabled={isLoading || Boolean(walletError) || eligibleWallets.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:opacity-60"
      >
        <option value="">
          {isLoading ? 'Loading wallets…' : required ? 'Select wallet' : 'No wallet selected'}
        </option>
        {eligibleWallets.map((wallet) => {
          const institution = institutionFor(wallet.institution_key);
          const account = wallet.account_type ? ` · ${wallet.account_type}` : '';
          return (
            <option key={wallet.id} value={wallet.id}>
              {institution.displayName} — {wallet.name}
              {account} · {formatCurrency(Number(wallet.balance))}
            </option>
          );
        })}
      </select>
      {selectorError ? <p className="mt-2 text-sm text-red-600">{selectorError}</p> : null}
    </label>
  );
}

function FormCurrencyInput<TFieldValues extends FieldValues>({
  control,
  name,
  ...props
}: {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  id: string;
  label: string;
  error?: string;
  min?: string | number;
  step?: string | number;
  placeholder?: string;
  helper?: ReactNode;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <CurrencyInput
          {...props}
          name={field.name}
          value={field.value}
          onChange={(value) => field.onChange(value)}
          onBlur={field.onBlur}
          inputRef={field.ref}
        />
      )}
    />
  );
}

export function ExpenseFormPanel({ open, onClose, onSuccess, expense }: ExpenseFormPanelProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const isEditing = Boolean(expense);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    control,
    setValue,
    watch,
  } = useForm<ExpenseFormInput, unknown, ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: defaultExpenseValues(expense),
  });
  const walletId = watch('wallet_id');
  const category = watch('category');

  useEffect(() => {
    if (open) {
      reset(defaultExpenseValues(expense));
      resetMutation();
    }
  }, [expense, open, reset, resetMutation]);

  async function onSubmit(values: ExpenseFormValues) {
    const result = await mutate<Expense>(isEditing ? `/expenses/${expense!.id}` : '/expenses', {
      method: isEditing ? 'PATCH' : 'POST',
      body: JSON.stringify({
        ...values,
        receipt_url: toOptionalString(values.receipt_url),
      }),
    });
    onSuccess(result);
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit expense' : 'Log expense'}
      description={
        isEditing
          ? 'Correct merchant, amount, date, category, or payment method for this expense.'
          : 'Capture the purchase details and let the backend store the final expense record.'
      }
      footer={
        <DialogActions
          formId={formId}
          onClose={onClose}
          isSubmitting={isSubmitting}
          submitLabel={isEditing ? 'Update expense' : 'Save expense'}
        />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <TextInput
          id="expense-merchant"
          label="Merchant"
          placeholder="Mercury Drug"
          error={errors.merchant?.message}
          {...register('merchant')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormCurrencyInput
            id="expense-amount"
            label="Amount"
            control={control}
            name="amount"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            error={errors.amount?.message}
          />
          <TextInput
            id="expense-date"
            label="Date"
            type="date"
            error={errors.date?.message}
            {...register('date')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CategorySelect
            id="expense-category"
            label="Category"
            value={category}
            options={getCategories('expense').map((item) => item.name)}
            onChange={(value) =>
              setValue('category', value, { shouldDirty: true, shouldValidate: true })
            }
            error={errors.category?.message}
          />
          <WalletSelector
            id="expense-wallet"
            label="Payment method"
            value={walletId}
            required
            error={errors.wallet_id?.message}
            emptyMessage="Add a wallet before recording an expense."
            onChange={(value) =>
              setValue('wallet_id', value, { shouldDirty: true, shouldValidate: true })
            }
          />
        </div>

        <TextInput
          id="expense-receipt-url"
          label="Receipt URL"
          type="url"
          placeholder="https://..."
          error={errors.receipt_url?.message}
          {...register('receipt_url')}
        />

        <CheckboxField
          id="expense-is-split"
          label="Split expense"
          description="Use this when the backend should mark the entry as shared."
          {...register('is_split')}
        />
      </form>
    </SlideOver>
  );
}

const incomeSchema = z.object({
  source: z.string().trim().min(1, 'Income source is required'),
  type: z
    .string()
    .refine((value) => incomeCategoryKeys.includes(value), 'Choose an income category'),
  amount: z.coerce.number().positive('Please enter an amount greater than 0'),
  date: z.string().date('Date is required'),
  is_recurring: z.boolean(),
  frequency: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['monthly', 'weekly', 'biweekly', 'yearly']).optional(),
  ),
  wallet_id: z.string().uuid('Select where this income was received.'),
});

type IncomeFormInput = z.input<typeof incomeSchema>;
type IncomeFormValues = z.output<typeof incomeSchema>;

function defaultIncomeValues(income?: IncomeEntry | null): IncomeFormInput {
  return {
    source: income?.source ?? '',
    type: income?.type === 'other' ? 'other-income' : income?.type ?? 'salary',
    amount: income ? Number(income.amount) : undefined,
    date: income?.date ?? todayInputValue(),
    is_recurring: income ? Boolean(income.is_recurring) : false,
    frequency: income?.frequency ?? undefined,
    wallet_id: income?.wallet_id ?? '',
  };
}

export function IncomeFormPanel({ open, onClose, onSuccess, income }: IncomeFormPanelProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    control,
    setValue,
    watch,
  } = useForm<IncomeFormInput, unknown, IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: defaultIncomeValues(income),
    shouldUnregister: true,
  });
  const recurring = watch('is_recurring');
  const frequency = watch('frequency');
  const walletId = watch('wallet_id');

  useEffect(() => {
    if (open) {
      reset(defaultIncomeValues(income));
      resetMutation();
    }
  }, [income, open, reset, resetMutation]);

  useEffect(() => {
    if (!recurring && frequency) {
      setValue('frequency', undefined, { shouldDirty: true, shouldValidate: true });
    }
  }, [frequency, recurring, setValue]);

  async function onSubmit(values: IncomeFormValues) {
    const payload = { ...values, frequency: values.is_recurring ? values.frequency : null };
    await mutate<IncomeEntry>(income ? `/income/${income.id}` : '/income', {
      method: income ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={income ? 'Edit income' : 'Add income'}
      description="Collect the income details here and send them straight to the backend income endpoint."
      footer={
        <DialogActions
          formId={formId}
          onClose={onClose}
          isSubmitting={isSubmitting}
          submitLabel={income ? 'Update income' : 'Save income'}
        />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <TextInput
          id="income-source"
          label="Source"
          placeholder="ACME Payroll"
          error={errors.source?.message}
          {...register('source')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <CategorySelect
            id="income-type"
            label="Category"
            value={watch('type')}
            options={incomeCategoryKeys}
            onChange={(value) =>
              setValue('type', value, { shouldDirty: true, shouldValidate: true })
            }
            error={errors.type?.message}
          />
          <FormCurrencyInput
            id="income-amount"
            label="Amount"
            control={control}
            name="amount"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            error={errors.amount?.message}
          />
        </div>

        <WalletSelector
          id="income-wallet"
          label="Deposit to"
          value={walletId}
          required
          excludeCredit
          error={errors.wallet_id?.message}
          onChange={(value) =>
            setValue('wallet_id', value, { shouldDirty: true, shouldValidate: true })
          }
        />

        <TextInput
          id="income-date"
          label="Date received"
          type="date"
          error={errors.date?.message}
          {...register('date')}
        />

        <CheckboxField
          id="income-recurring"
          label="Recurring income"
          description="Turn this on if the source repeats on a fixed schedule."
          {...register('is_recurring')}
        />

        {recurring ? (
          <SelectField
            id="income-frequency"
            label="Frequency"
            error={errors.frequency?.message}
            {...register('frequency')}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="yearly">Yearly</option>
          </SelectField>
        ) : null}
      </form>
    </SlideOver>
  );
}

const savingsGoalSchema = z.object({
  title: z.string().trim().min(1, 'Goal title is required'),
  emoji: z.string().max(8, 'Keep the emoji short').optional(),
  target_amount: z.coerce.number().positive('Please enter a target amount greater than 0'),
  current_amount: z.coerce.number().nonnegative('Current amount cannot be negative').optional(),
  monthly_target: z.coerce.number().nonnegative('Monthly contribution cannot be negative'),
  deadline: z.string().date('Deadline is required'),
});

type SavingsGoalFormInput = z.input<typeof savingsGoalSchema>;
type SavingsGoalFormValues = z.output<typeof savingsGoalSchema>;

function defaultSavingsGoalValues(goal?: SavingsGoal | null): SavingsGoalFormInput {
  return {
    title: goal?.title ?? '',
    emoji: goal?.emoji ?? '',
    target_amount: goal ? Number(goal.target_amount) : undefined,
    current_amount: Number(goal?.current_amount ?? 0),
    monthly_target: Number(goal?.monthly_target ?? 0),
    deadline: goal?.deadline ?? todayInputValue(),
  };
}

export function SavingsGoalFormPanel({
  open,
  onClose,
  onSuccess,
  goal,
}: SavingsGoalFormPanelProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    control,
  } = useForm<SavingsGoalFormInput, unknown, SavingsGoalFormValues>({
    resolver: zodResolver(savingsGoalSchema),
    defaultValues: defaultSavingsGoalValues(goal),
  });
  const isEditing = Boolean(goal);
  const watchedValues = useWatch({ control });
  const watchedTarget = Number(watchedValues.target_amount);
  const watchedCurrent = Number(watchedValues.current_amount ?? goal?.current_amount ?? 0);
  const watchedContribution = Number(watchedValues.monthly_target);
  const watchedDeadline = String(watchedValues.deadline ?? '');
  const watchedNeeded =
    watchedTarget > 0 && watchedDeadline
      ? getMonthlyNeeded(watchedCurrent, watchedTarget, watchedDeadline)
      : 0;
  const contributionHint =
    !watchedTarget || !watchedDeadline
      ? 'Enter a target amount and deadline to see what you need each month.'
      : watchedNeeded === 0
        ? 'This goal is already fully funded.'
        : watchedContribution >= watchedNeeded
          ? `Needed to hit your deadline: ${formatCurrency(watchedNeeded)}/mo. Your plan is on track.`
          : `Needed to hit your deadline: ${formatCurrency(watchedNeeded)}/mo. Your plan is ${formatCurrency(watchedNeeded - watchedContribution)}/mo below that amount.`;

  useEffect(() => {
    if (open) {
      reset(defaultSavingsGoalValues(goal));
      resetMutation();
    }
  }, [goal, open, reset, resetMutation]);

  async function onSubmit(values: SavingsGoalFormValues) {
    const payload = {
      title: values.title,
      emoji: toOptionalString(values.emoji),
      target_amount: values.target_amount,
      deadline: values.deadline,
      monthly_target: values.monthly_target,
    };

    if (goal) {
      await mutate<SavingsGoal>(`/savings-goals/${goal.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await mutate<SavingsGoal>('/savings-goals', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          current_amount: 0,
        }),
      });
    }

    await onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit goal' : 'Create goal'}
      description={
        isEditing
          ? 'Update the goal details here. Progress is handled from the goal card.'
          : 'Set a target and target date. Add progress later from an eligible wallet.'
      }
      footer={
        <DialogActions
          formId={formId}
          onClose={onClose}
          isSubmitting={isSubmitting}
          submitLabel={isEditing ? 'Update goal' : 'Save goal'}
        />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <TextInput
          id="goal-title"
          label="Goal title"
          placeholder="Laptop fund"
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            id="goal-emoji"
            label="Emoji"
            placeholder="Optional"
            error={errors.emoji?.message}
            {...register('emoji')}
          />
          <TextInput
            id="goal-deadline"
            label="Deadline"
            type="date"
            error={errors.deadline?.message}
            {...register('deadline')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormCurrencyInput
            id="goal-target-amount"
            label="Target amount"
            control={control}
            name="target_amount"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            error={errors.target_amount?.message}
          />
          <FormCurrencyInput
            id="goal-monthly-target"
            label="Monthly contribution"
            control={control}
            name="monthly_target"
            min="0"
            step="0.01"
            placeholder="5000"
            error={errors.monthly_target?.message}
            helper={contributionHint}
          />
        </div>

      </form>
    </SlideOver>
  );
}

const savingsGoalProgressSchema = z.object({
  amount: z.coerce.number().positive('Please enter an amount greater than 0'),
  wallet_id: z.string().uuid('Choose the wallet this contribution comes from.'),
});

type SavingsGoalProgressInput = z.input<typeof savingsGoalProgressSchema>;
type SavingsGoalProgressValues = z.output<typeof savingsGoalProgressSchema>;

function defaultSavingsGoalProgressValues(): SavingsGoalProgressInput {
  return {
    amount: undefined,
    wallet_id: '',
  };
}

export function SavingsGoalProgressPanel({
  open,
  onClose,
  onSuccess,
  goal,
}: SavingsGoalProgressPanelProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    control,
    setValue,
    watch,
  } = useForm<SavingsGoalProgressInput, unknown, SavingsGoalProgressValues>({
    resolver: zodResolver(savingsGoalProgressSchema),
    defaultValues: defaultSavingsGoalProgressValues(),
  });
  const currentAmount = Number(goal?.current_amount ?? 0);
  const targetAmount = Number(goal?.target_amount ?? 0);
  const remaining = Math.max(0, targetAmount - currentAmount);
  const walletId = watch('wallet_id');

  useEffect(() => {
    if (open) {
      reset(defaultSavingsGoalProgressValues());
      resetMutation();
    }
  }, [open, reset, resetMutation]);

  async function onSubmit(values: SavingsGoalProgressValues) {
    if (!goal) {
      return;
    }

    await mutate(`/savings-goals/${goal.id}/contributions`, {
      method: 'POST',
      body: JSON.stringify({
        wallet_id: values.wallet_id,
        amount: values.amount,
      }),
    });

    await onSuccess();
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Add contribution"
      description={goal ? `Allocate money from a wallet to ${goal.title}.` : 'Allocate money to a goal.'}
      footer={
        <DialogActions
          formId={formId}
          onClose={onClose}
          isSubmitting={isSubmitting}
          submitLabel="Add contribution"
        />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        {goal ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">Current progress</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-950">
              {formatCurrency(currentAmount)}{' '}
              <span className="font-sans text-sm font-normal text-slate-500">of</span>{' '}
              {formatCurrency(targetAmount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{formatCurrency(remaining)} remaining</p>
          </div>
        ) : null}

        <FormCurrencyInput
          id="goal-add-amount"
          label="Contribution amount"
          control={control}
          name="amount"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          error={errors.amount?.message}
        />

        <WalletSelector
          id="goal-contribution-wallet"
          label="From wallet"
          value={walletId}
          required
          excludeCredit
          error={errors.wallet_id?.message}
          onChange={(value) =>
            setValue('wallet_id', value, { shouldDirty: true, shouldValidate: true })
          }
        />

        {remaining > 0 ? <p className="text-xs text-slate-500">Contributions cannot exceed the remaining {formatCurrency(remaining)}.</p> : null}
      </form>
    </SlideOver>
  );
}

const budgetCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, 'Category name is required'),
  budget: z.coerce.number().nonnegative('Budget cannot be negative'),
});

const budgetSchema = z.object({
  categories: z.array(budgetCategorySchema).min(1, 'At least one category is required'),
  savings_allocation: z.coerce.number().nonnegative('Monthly savings budget cannot be negative'),
  auto_distribute_savings: z.boolean(),
  remaining_savings_behavior: z.enum(['auto_general', 'leave_unallocated', 'ask_monthly']),
});

type BudgetFormInput = z.input<typeof budgetSchema>;
type BudgetFormValues = z.output<typeof budgetSchema>;

const starterBudgetCategories = getCategories('expense')
  .slice(0, 4)
  .map((category) => ({ id: category.id, name: category.name, budget: 0 }));

const budgetSliderMax = 50000;
const budgetSliderStep = 100;
const budgetSliderColors = [
  '#e8775d',
  '#6fa3d2',
  '#7db59c',
  '#f2c87c',
  '#9d90ac',
  '#bdb2a5',
  '#0f8a6b',
];

function normalizeDistributedMonth(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) return normalized;
  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(normalized)) return normalized.slice(0, 7);
  return null;
}

function createBudgetCategoryId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `budget-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

function buildBudgetDefaults(budgetSummary: BudgetSummary | null): BudgetFormInput {
  const savingsCategory = budgetSummary?.categories.find((category) => category.goal);
  const spendingCategories = budgetSummary?.categories.filter((category) => !category.goal) ?? [];

  return {
    categories: spendingCategories.length
      ? spendingCategories.map((category) => ({
          id: category.id,
          name: category.name,
          budget: category.budget,
        }))
      : starterBudgetCategories,
    savings_allocation: Number(budgetSummary?.savings_allocation ?? savingsCategory?.budget ?? 0),
    auto_distribute_savings: Boolean(
      budgetSummary?.savings_auto_distribute ?? savingsCategory?.auto_distribute,
    ),
    remaining_savings_behavior: budgetSummary?.remaining_savings_behavior ?? 'auto_general',
  };
}

type BudgetFormPanelProps = FormDialogProps & {
  budgetSummary: BudgetSummary | null;
  month: string;
};

export function BudgetFormPanel({
  open,
  onClose,
  onSuccess,
  budgetSummary,
  month,
}: BudgetFormPanelProps) {
  const formId = useId();
  const { mutate, isSubmitting, error, reset: resetMutation } = useApiMutation();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<BudgetFormInput, unknown, BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: buildBudgetDefaults(budgetSummary),
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'categories',
  });
  const watchedCategories = useWatch({ control, name: 'categories' });
  const savingsAllocation = Number(useWatch({ control, name: 'savings_allocation' }) ?? 0);
  const autoDistributeSavings = Boolean(useWatch({ control, name: 'auto_distribute_savings' }));
  const remainingSavingsBehavior =
    useWatch({ control, name: 'remaining_savings_behavior' }) ?? 'auto_general';
  const isEditing = Boolean(budgetSummary);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      reset(buildBudgetDefaults(budgetSummary));
      resetMutation();
    }

    wasOpen.current = open;
  }, [budgetSummary, open, reset, resetMutation]);

  async function onSubmit(values: BudgetFormValues) {
    const savingsCategory = budgetSummary?.categories.find((category) => category.goal);

    const savedBudget = await mutate<BudgetSummary>('/budget', {
      method: 'PATCH',
      body: JSON.stringify({
        month,
        auto_distribute_savings: values.auto_distribute_savings,
        remaining_savings_behavior: values.remaining_savings_behavior,
        categories: [
          ...values.categories.map((category) => ({
            id: category.id,
            name: category.name,
            budget: category.budget,
          })),
          {
            id: savingsCategory?.id ?? 'savings',
            name: savingsCategory?.name ?? 'Monthly Savings Budget',
            budget: values.savings_allocation,
            auto_distribute: values.auto_distribute_savings,
            last_distributed_month: normalizeDistributedMonth(
              savingsCategory?.last_distributed_month ??
                budgetSummary?.savings_last_distributed_month,
            ),
            last_distributed_amount:
              savingsCategory?.last_distributed_amount ??
              budgetSummary?.savings_last_distributed_amount ??
              0,
          },
        ],
      }),
    });
    await onSuccess(savedBudget);
    onClose();
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit budget' : 'Create budget'}
      description={
        isEditing
          ? 'Adjust your category targets and keep the current plan in sync.'
          : 'Set up your first budget by category, then add more rows if you need them.'
      }
      footer={
        <DialogActions
          formId={formId}
          onClose={onClose}
          isSubmitting={isSubmitting}
          submitLabel={isEditing ? 'Save budget' : 'Create budget'}
        />
      }
    >
      <form id={formId} className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormError message={error} />

        <section className="rounded-2xl border border-emerald-200 bg-[#f0faf6] px-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Savings allocation</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Plan how much to save this month. Goal progress still belongs on the Savings Goals
                page.
              </p>
            </div>
            <span className="rounded-full bg-brand-primary/10 px-3 py-1 font-mono text-xs font-semibold text-brand-primary">
              {formatCurrency(savingsAllocation)}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <FormCurrencyInput
              id="budget-savings-allocation"
              label="Monthly Savings Budget"
              control={control}
              name="savings_allocation"
              min="0"
              step={budgetSliderStep}
              placeholder="5000"
              error={errors.savings_allocation?.message}
            />

            <Controller
              control={control}
              name="auto_distribute_savings"
              render={({ field }) => {
                const isEnabled = Boolean(field.value);

                return (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    onClick={() => field.onChange(!isEnabled)}
                    className={`flex min-h-11 items-center gap-3 rounded-full border px-4 py-3 text-left transition ${
                      isEnabled
                        ? 'border-brand-primary bg-brand-primary text-white'
                        : 'border-emerald-200 bg-white text-slate-900 hover:border-brand-primary'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${isEnabled ? 'bg-white/25' : 'bg-slate-200'}`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full bg-white shadow-sm transition ${isEnabled ? 'translate-x-4' : ''}`}
                      />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">
                        {isEnabled ? 'Auto-distribute On' : 'Auto-distribute Off'}
                      </span>
                      <span
                        className={`block text-xs ${isEnabled ? 'text-white/80' : 'text-slate-500'}`}
                      >
                        Plan goal allocations
                      </span>
                    </span>
                  </button>
                );
              }}
            />
          </div>

          <SelectField
            id="budget-savings-preference"
            label="Remaining savings preference"
            className="mt-4"
            error={errors.remaining_savings_behavior?.message}
            {...register('remaining_savings_behavior')}
          >
            <option value="auto_general">
              Automatically move remaining savings into General Savings
            </option>
            <option value="leave_unallocated">Leave remaining savings unallocated</option>
            <option value="ask_monthly">Ask every month</option>
          </SelectField>

          <div className="mt-3 rounded-xl bg-white/70 px-4 py-3 text-xs leading-5 text-slate-600">
            {autoDistributeSavings
              ? 'Auto-distribute creates a goal allocation plan from active savings goals. Any savings budget left after goal allocation follows your preference below.'
              : 'With auto-distribute off, the Monthly Savings Budget stays outside goal allocation and follows your remaining savings preference.'}
            {remainingSavingsBehavior === 'auto_general'
              ? ' Remaining savings will be labeled General Savings.'
              : null}
          </div>
        </section>

        <div className="space-y-4">
          {fields.map((field, index) =>
            (() => {
              const categoryValue = watchedCategories?.[index];
              const currentBudget = Number(categoryValue?.budget ?? 0);
              const currentSpent = Number(
                budgetSummary?.categories.find((category) => category.id === categoryValue?.id)
                  ?.spent ?? 0,
              );
              const deficit = Math.max(0, currentSpent - currentBudget);
              const maxBudget = Math.max(
                budgetSliderMax,
                currentBudget + 5000,
                currentSpent + 5000,
              );
              const progress = maxBudget
                ? Math.max(0, Math.min(100, (currentBudget / maxBudget) * 100))
                : 0;
              const color = budgetSliderColors[index % budgetSliderColors.length];

              return (
                <div
                  key={field.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                >
                  <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
                    <div>
                      <TextInput
                        id={`budget-category-name-${field.id}`}
                        label="Category"
                        placeholder="Groceries"
                        error={errors.categories?.[index]?.name?.message}
                        {...register(`categories.${index}.name`)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                          <span>Slide to adjust</span>
                          <span className="font-mono text-slate-700">
                            {formatCurrency(currentBudget)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={maxBudget}
                          step={budgetSliderStep}
                          value={currentBudget}
                          onChange={(event) =>
                            setValue(`categories.${index}.budget`, Number(event.target.value), {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          className="h-2 w-full cursor-pointer appearance-none rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${color} 0%, ${color} ${progress}%, #e2e8f0 ${progress}%, #e2e8f0 100%)`,
                            accentColor: color,
                          }}
                        />
                      </div>

                      <Controller
                        control={control}
                        name={`categories.${index}.budget`}
                        render={({ field: budgetField }) => (
                          <CurrencyInput
                            id={`budget-category-${field.id}`}
                            label="Budget amount"
                            value={
                              budgetField.value === 0 || budgetField.value === '0'
                                ? ''
                                : budgetField.value
                            }
                            onChange={(value) => budgetField.onChange(value)}
                            onBlur={budgetField.onBlur}
                            inputRef={budgetField.ref}
                            min="0"
                            step={budgetSliderStep}
                            placeholder="0"
                            error={errors.categories?.[index]?.budget?.message}
                          />
                        )}
                      />

                      {deficit > 0 ? (
                        <p className="text-xs font-medium text-red-600">
                          This category is short by {formatCurrency(deficit)} this month.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <input type="hidden" {...register(`categories.${index}.id`)} />
                </div>
              );
            })(),
          )}

          <button
            type="button"
            onClick={() => append({ id: createBudgetCategoryId(), name: '', budget: 0 })}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
          >
            <span className="text-lg leading-none">+</span>
            Add category
          </button>
        </div>
      </form>
    </SlideOver>
  );
}
