import { Router } from 'express';
import * as controller from '../controllers/wallets.controller.js';
import { idParamSchema } from '../schemas/common.schema.js';
import {
  createWalletSchema,
  createWalletWithOpeningBalanceSchema,
  creditCardFinanceChargeSchema,
  creditCardStatementSchema,
  creditRepaymentSchema,
  updateWalletSchema,
  walletDepositSchema,
  walletInterestSchema,
  walletTransferSchema,
} from '../schemas/wallet.schema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { writeRateLimit } from '../middleware/rateLimit.js';

export const walletsRouter = Router();
walletsRouter.get('/', asyncHandler(controller.list));
walletsRouter.post(
  '/transfers',
  writeRateLimit,
  validateRequest({ body: walletTransferSchema }),
  asyncHandler(controller.transfer),
);
walletsRouter.get('/:id', validateRequest({ params: idParamSchema }), asyncHandler(controller.get));
walletsRouter.post(
  '/',
  writeRateLimit,
  validateRequest({ body: createWalletSchema }),
  asyncHandler(controller.create),
);
walletsRouter.post(
  '/with-opening-balance',
  writeRateLimit,
  validateRequest({ body: createWalletWithOpeningBalanceSchema }),
  asyncHandler(controller.createWithOpeningBalance),
);
walletsRouter.post(
  '/:id/deposits',
  writeRateLimit,
  validateRequest({ params: idParamSchema, body: walletDepositSchema }),
  asyncHandler(controller.deposit),
);
walletsRouter.post(
  '/:id/interest',
  writeRateLimit,
  validateRequest({ params: idParamSchema, body: walletInterestSchema }),
  asyncHandler(controller.interest),
);
walletsRouter.get(
  '/:id/interest-estimate',
  validateRequest({ params: idParamSchema }),
  asyncHandler(controller.interestEstimate),
);
walletsRouter.post(
  '/:id/finance-charges',
  writeRateLimit,
  validateRequest({ params: idParamSchema, body: creditCardFinanceChargeSchema }),
  asyncHandler(controller.financeCharge),
);
walletsRouter.post(
  '/:id/statements',
  writeRateLimit,
  validateRequest({ params: idParamSchema, body: creditCardStatementSchema }),
  asyncHandler(controller.statement),
);
walletsRouter.post(
  '/:id/repayments',
  writeRateLimit,
  validateRequest({ params: idParamSchema, body: creditRepaymentSchema }),
  asyncHandler(controller.repayment),
);
walletsRouter.patch(
  '/:id',
  writeRateLimit,
  validateRequest({ params: idParamSchema, body: updateWalletSchema }),
  asyncHandler(controller.update),
);
walletsRouter.delete(
  '/:id',
  writeRateLimit,
  validateRequest({ params: idParamSchema }),
  asyncHandler(controller.remove),
);
