// src/routes/customers.routes.js
import { Router } from 'express';
import {
    createUserOfSystem,
    getAllUserOfSystem,
    getUserOfSystemById,
    updateUserOfSystem,
    hideUserOfSystem,
    passwordResetToken,
    passwordReset
} from "../controllers/systemUser.controller.js";
import { jwtTokenValidation } from '../middleware/jwt-token-validation.middleware.js';

const router = Router();

//% Ruta para obtener todos los Usuarios
router.get('/', getAllUserOfSystem);

//% Ruta para obtener un Usuario específico por ID
router.get('/:id', getUserOfSystemById);

//% Ruta para crear un nuevo Usuario
router.post('/', createUserOfSystem);

//% Ruta para actualizar un Usuario existente
router.put('/:id', jwtTokenValidation, updateUserOfSystem);

//% Ruta para Ocultar un cliente existente
router.patch('/:id', jwtTokenValidation, hideUserOfSystem);


//? Recuperacion Password
router.get("/passwordReset", passwordResetToken);

router.patch("/passwordReset", passwordReset);


export default router;
