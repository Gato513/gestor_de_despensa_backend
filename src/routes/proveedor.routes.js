// src/routes/customers.routes.js
import { Router } from 'express';
import {
    createProveedor,
    getAllProveedores,
    getProveedorById,
    updateProveedor,
    hideProveedor
} from "../controllers/proveedor.controller.js";
import { jwtTokenValidation } from '../middleware/jwt-token-validation.middleware.js';

const router = Router();

// Ruta para crear un nuevo cliente
router.post('/', createProveedor);

// Ruta para obtener todos los clientes
router.get('/', getAllProveedores);

// Ruta para obtener un cliente específico por ID
router.get('/:id', getProveedorById);

// Ruta para actualizar un cliente existente
router.put('/:id', jwtTokenValidation, updateProveedor);

// Ruta para Ocultar un provedor existente
router.patch('/:id', jwtTokenValidation, hideProveedor);

export default router;
