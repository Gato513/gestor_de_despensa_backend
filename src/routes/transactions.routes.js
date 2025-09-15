import { Router } from 'express';
import { purchaseProduct, collectionAndBilling } from "../controllers/transactions.controller.js";
import { jwtTokenValidation } from '../middleware/jwt-token-validation.middleware.js';

const router = Router();

router.use(jwtTokenValidation);
router.post('/purchase', purchaseProduct);
router.post('/collectionAndBilling', collectionAndBilling);


export default router;
