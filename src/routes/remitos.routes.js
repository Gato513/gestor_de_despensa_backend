// src/routes/customers.routes.js
import { Router } from 'express';
import {
    getAllCustomerRemitos,
    createRemito,
    getAllRemitos,
    getRemitoById,
} from "../controllers/remitos.controller.js";

const router = Router();

// Ruta para crear un nuevo remito
router.post('/', createRemito);

// Ruta para obtener todos los remitos
router.get('/', getAllRemitos);

// Ruta para obtener todos los remitos de un cliente:
router.get('/byClient/:clientId', getAllCustomerRemitos);

// Ruta para obtener un remito específico por ID
router.get('/:id', getRemitoById);

export default router;
