// src/routes/customers.routes.js
import { Router } from 'express';
import {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    hideCustomer
} from "../controllers/customer.controller.js";
import { jwtTokenValidation } from '../middleware/jwt-token-validation.middleware.js';

const router = Router();

// Ruta para crear un nuevo cliente
router.post('/', createCustomer);

// Ruta para obtener todos los clientes
router.get('/', getAllCustomers);

// Ruta para obtener un cliente específico por ID
router.get('/:id', getCustomerById);

// Ruta para actualizar un cliente existente
router.put('/:id', jwtTokenValidation, updateCustomer);

// Ruta para Ocultar un cliente existente
router.patch('/:id', jwtTokenValidation, hideCustomer);

export default router;
