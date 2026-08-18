-- Keep the database income domain aligned with the shared income category
-- registry used by the Web and Mobile forms.
alter table public.income drop constraint if exists income_type_check;
alter table public.income add constraint income_type_check check (type in (
  'salary', 'freelance', 'business', 'remittance', 'allowance', 'bonus',
  'commission', 'overtime', 'tips', 'investment-income', 'interest',
  'dividend', 'rental-income', 'government-benefit', 'pension', 'scholarship',
  'gift-received', 'refund', 'reimbursement', 'cashback-rewards',
  'sale-of-item', 'side-hustle', 'royalties', 'other-income', 'other'
));
