// src/routes/customers.routes.js
import { Router } from 'express';
import { getAllRegistroCaja, } from "../controllers/registroCaja.controller.js";
import { getAllFacturas, getFacturaById } from '../controllers/facturas.controller.js';
import { getAllAudit, getAuditById } from '../controllers/auditoria.controller.js';


const router = Router();

//& Obtener todos los registro de moviminto de caja:
router.get('/caja', getAllRegistroCaja);


//& Obtener todos los registro de auditorias:
router.get('/auditoria', getAllAudit);
//& Obtener un registro de auditoria:
router.get('/auditorias/detail/:id', getAuditById);


//& Obtener todos los registro de facturacion:
router.get('/facturas', getAllFacturas);
//& Obtener un registro de facturacion:
router.get('/facturas/detail/:id/', getFacturaById);

export default router;
