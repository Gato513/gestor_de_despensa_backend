// src/routes/session.routes.js
import { Router } from 'express';
import { sessionLogin, sessionLogout, getLoginUser } from "../controllers/session.controller.js";
import { jwtTokenValidation } from '../middleware/jwt-token-validation.middleware.js';

const router = Router();

router.post('/login', sessionLogin);

router.post('/logout', sessionLogout);

router.get('/getLoginUser', jwtTokenValidation, getLoginUser);


export default router;
