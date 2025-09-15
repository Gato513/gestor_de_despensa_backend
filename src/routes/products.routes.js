// src/routes/customers.routes.js
import { Router } from 'express';
import {
    createProduct,
    getAllProducts,
    checkMinimumStock,
    getProductById,
    updateProduct,
    hideProduct,
} from "../controllers/products.controller.js";
import { jwtTokenValidation } from '../middleware/jwt-token-validation.middleware.js';

const router = Router();

// Ruta para crear un nuevo producto
router.post('/', createProduct);

// Ruta para obtener todos los productos
router.get('/', getAllProducts);

// Ruta para obtener comprobacion de stock minimo:
router.get('/minimumStockControl', checkMinimumStock);

// Ruta para obtener un producto específico por ID
router.get('/:id', getProductById);

// Ruta para actualizar un producto existente
router.put('/:id', jwtTokenValidation, updateProduct);

// Ruta para Ocultar un producto existente
router.patch('/:id', jwtTokenValidation, hideProduct);


export default router;
