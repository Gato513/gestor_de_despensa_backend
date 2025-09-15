// src/routes/customers.routes.js
import { Router } from 'express';
import {
    getSalesReport,
    getInventoryReport,
    getDebtReport,
    getPurchaseReport,
    getCashFlowReport,
    getAuditReport
} from '../controllers/informes.controller.js';

const router = Router();

// Ruta de Informe de ventas:
router.get('/sales_report', getSalesReport);

// Ruta de informe de inventario:
router.get('/inventory_report', getInventoryReport);

// Ruta de Informe de Deudas:
router.get('/debt_report', getDebtReport);

// Ruta de Informe de Compras a Proveedores:
router.get('/purchase_report', getPurchaseReport);

// Ruta de Informe de Compras a Proveedores:
router.get('/cash_flow_report', getCashFlowReport);

// Ruta de Informe de auditoria:
router.get('/audit_report', getAuditReport);

export default router;
