import { pool } from '../config/mysql.config.js'

export const getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Validar que se proporcionen fechas y que el rango sea de al menos un mes
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Se requieren startDate y endDate' });
        }
        const dateDiffQuery = `SELECT DATEDIFF(?, ?) AS diff`;
        const [[{ diff }]] = await pool.query(dateDiffQuery, [endDate, startDate]);
        if (diff < 30) {
            return res.status(400).json({ error: 'El rango de fechas debe ser de al menos un mes' });
        }

        // Consulta para obtener el resumen general de ventas
        const [generalSummary] = await pool.query(`
            SELECT 
                COUNT(DISTINCT r.id_remito) AS total_ventas,
                ROUND(SUM(r.monto_total), 0) AS monto_total_ventas,
                ROUND(SUM(r.saldo_restante), 0) AS saldo_pendiente
            FROM Remitos r
            WHERE r.fecha_remito BETWEEN ? AND ?;
        `, [startDate, endDate]);

        // Ventas por período (Diario, Semanal, Mensual)
        const [salesByPeriod] = await pool.query(`
            SELECT 
                DATE_FORMAT(r.fecha_remito, '%Y-%m-%d') AS fecha,
                ROUND(SUM(r.monto_total), 0) AS total_ventas
            FROM Remitos r
            WHERE r.fecha_remito BETWEEN ? AND ?
            GROUP BY fecha;
        `, [startDate, endDate]);

        // Ventas por producto
        const [salesByProduct] = await pool.query(`
            SELECT 
                p.nombre_producto,
                SUM(d.cantidad) AS cantidad_vendida,
                ROUND(SUM(d.subtotal), 0) AS total_ventas
            FROM Detalles_de_Remito d
            JOIN Productos p ON d.id_producto = p.id_producto
            JOIN Remitos r ON d.id_remito = r.id_remito
            WHERE r.fecha_remito BETWEEN ? AND ?
            GROUP BY p.id_producto, p.nombre_producto;
        `, [startDate, endDate]);

        // Ventas por cliente
        const [salesByClient] = await pool.query(`
            SELECT 
                c.nombre_cliente,
                COUNT(r.id_remito) AS total_compras,
                ROUND(SUM(r.monto_total), 0) AS monto_total_compras
            FROM Remitos r
            JOIN Clientes c ON r.id_cliente = c.id_cliente
            WHERE r.fecha_remito BETWEEN ? AND ?
            GROUP BY c.id_cliente;
        `, [startDate, endDate]);

        // Datos financieros (Deudas, Descuentos, Impuestos)
        const [financialData] = await pool.query(`
            SELECT 
                ROUND(SUM(ca.monto), 0) AS pagos_recibidos,
				ROUND(SUM(fr.monto_descontado), 0) AS descuentos
            FROM Cobranza_a_Clientes ca
            LEFT JOIN Factura_de_Remitos fr ON ca.id_pago = fr.id_pago
            WHERE ca.fecha_pago BETWEEN ? AND ?;
        `, [startDate, endDate]);

        // Comparación con el mismo período anterior
        const [previousPeriodComparison] = await pool.query(`
            SELECT 
                ROUND(SUM(r.monto_total), 0) AS total_ventas_anterior
            FROM Remitos r
            WHERE r.fecha_remito BETWEEN DATE_SUB(?, INTERVAL 1 MONTH) AND DATE_SUB(?, INTERVAL 1 MONTH);
        `, [startDate, endDate]);

        // Respuesta en formato JSON
        res.status(200).json({
            resumenGeneral: generalSummary[0],
            ventasPorPeriodo: salesByPeriod,
            ventasPorProducto: salesByProduct,
            ventasPorCliente: salesByClient,
            datosFinancieros: financialData[0],
            comparacionPeriodoAnterior: previousPeriodComparison[0]
        });

    } catch (error) {
        console.error('Error ejecutando la consulta:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const getInventoryReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Validar que se proporcionen fechas y que el rango sea de al menos un mes
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Se requieren startDate y endDate' });
        }
        const dateDiffQuery = `SELECT DATEDIFF(?, ?) AS diff`;
        const [[{ diff }]] = await pool.query(dateDiffQuery, [endDate, startDate]);
        if (diff < 30) {
            return res.status(400).json({ error: 'El rango de fechas debe ser de al menos un mes' });
        }

        // Obtener el resumen general del inventario
        const [generalSummary] = await pool.query(`
            SELECT 
                COUNT(p.id_producto) AS total_productos,
                ROUND(SUM(p.stock_disponible * p.precio_compra), 0) AS valor_total_compra,
                ROUND(SUM(p.stock_disponible * p.precio_venta), 0) AS valor_total_venta
            FROM Productos p
            WHERE p.is_hidden = 0;
        `);

        // Obtener el stock actual de cada producto
        const [currentStock] = await pool.query(`
            SELECT 
                p.id_producto,
                p.nombre_producto,
                p.stock_disponible,
                ROUND(p.precio_compra,0) AS precio_compra,
                ROUND(p.precio_venta,0) AS precio_venta
            FROM Productos p
            WHERE p.is_hidden = 0;
        `);

        // Obtener productos con bajo stock
        const [lowStockProducts] = await pool.query(`
            SELECT 
                p.id_producto,
                p.nombre_producto,
                p.stock_disponible,
                p.stock_minimo
            FROM Productos p
            WHERE p.stock_disponible <= p.stock_minimo AND p.is_hidden = 0;
        `);

        // Obtener productos de alta y baja demanda
        const [highDemandProducts] = await pool.query(`
            SELECT 
                p.id_producto,
                p.nombre_producto,
                SUM(d.cantidad) AS cantidad_vendida
            FROM Detalles_de_Remito d
            JOIN Productos p ON d.id_producto = p.id_producto
            JOIN Remitos r ON d.id_remito = r.id_remito
            WHERE r.fecha_remito BETWEEN ? AND ?
            GROUP BY p.id_producto, p.nombre_producto
            ORDER BY cantidad_vendida DESC
            LIMIT 5;
        `, [startDate, endDate]);

        const [lowDemandProducts] = await pool.query(`
            SELECT 
                p.id_producto,
                p.nombre_producto,
                COALESCE(SUM(d.cantidad), 0) AS cantidad_vendida
            FROM Productos p
            LEFT JOIN Detalles_de_Remito d ON p.id_producto = d.id_producto
            LEFT JOIN Remitos r ON d.id_remito = r.id_remito AND r.fecha_remito BETWEEN ? AND ?
            WHERE p.is_hidden = 0
            GROUP BY p.id_producto, p.nombre_producto
            ORDER BY cantidad_vendida ASC
            LIMIT 5;
        `, [startDate, endDate]);

        // Obtener los movimientos de inventario (entradas y salidas)
        const [inventoryMovements] = await pool.query(`
            (
                SELECT 
                    fc.fecha_compra AS fecha,
                    'Entrada' AS tipo,
                    dfc.id_producto,
                    p.nombre_producto,
                    dfc.cantidad
                FROM Detalle_Factura_Compra dfc
                JOIN Factura_de_Compras fc ON dfc.id_factura = fc.id_factura
                JOIN Productos p ON dfc.id_producto = p.id_producto
                WHERE fc.fecha_compra BETWEEN ? AND ?
            )
            UNION ALL
            (
                SELECT 
                    r.fecha_remito AS fecha,
                    'Salida' AS tipo,
                    dr.id_producto,
                    p.nombre_producto,
                    dr.cantidad
                FROM Detalles_de_Remito dr
                JOIN Remitos r ON dr.id_remito = r.id_remito
                JOIN Productos p ON dr.id_producto = p.id_producto
                WHERE r.fecha_remito BETWEEN ? AND ?
            )
            ORDER BY fecha DESC;
        `, [startDate, endDate, startDate, endDate]);

        // Obtener el stock del período anterior
        const [previousStock] = await pool.query(
            `
                SELECT
                    p.id_producto,
                    p.nombre_producto,
                    ROUND(p.precio_compra, 0) AS precio_compra,
                    GREATEST(0, p.stock_disponible
                    + COALESCE((SELECT SUM(dfc.cantidad) FROM Detalle_Factura_Compra dfc
                                JOIN Factura_de_Compras fc ON dfc.id_factura = fc.id_factura
                                WHERE dfc.id_producto = p.id_producto
                                AND fc.fecha_compra < '2024-12-10'), 0)
                    - COALESCE((SELECT SUM(dr.cantidad) FROM Detalles_de_Remito dr
                                JOIN Remitos r ON dr.id_remito = r.id_remito
                                WHERE dr.id_producto = p.id_producto
                                AND r.fecha_remito < '2025-01-31'), 0)) AS stock_anterior
                FROM Productos p
                WHERE p.is_hidden = 0;
            `, [startDate, startDate]);

        // Calcular la variación del stock
        let totalStockAnterior = previousStock.reduce((acc, prod) => acc + (parseInt(prod.stock_anterior) || 0), 0);
        let totalStockActual = currentStock.reduce((acc, prod) => acc + (parseInt(prod.stock_disponible) || 0), 0);

        let valorStockAnterior = previousStock.reduce((acc, prod) => {
            let precioCompra = parseInt(prod.precio_compra) || 0;
            let stockAnterior = parseInt(prod.stock_anterior) || 0;
            return acc + (stockAnterior * precioCompra);
        }, 0);

        let valorStockActual = parseInt(generalSummary[0].valor_total_compra) || 0;

        // Asegurar que los valores sean numéricos y válidos
        totalStockAnterior = Number.isNaN(totalStockAnterior) ? 0 : totalStockAnterior;
        totalStockActual = Number.isNaN(totalStockActual) ? 0 : totalStockActual;
        valorStockAnterior = Number.isNaN(valorStockAnterior) ? 0 : valorStockAnterior;
        valorStockActual = Number.isNaN(valorStockActual) ? 0 : valorStockActual;

        // Estructura de comparación de stock
        const stockComparison = {
            stock_anterior: {
                total_productos: totalStockAnterior,
                valor_total: valorStockAnterior
            },
            stock_actual: {
                total_productos: totalStockActual,
                valor_total: valorStockActual
            },
            variacion: {
                diferencia_productos: totalStockActual - totalStockAnterior,
                diferencia_valor: valorStockActual - valorStockAnterior
            }
        };

        // Responder con el JSON
        res.status(200).json({
            resumenGeneral: generalSummary[0],
            stockActual: currentStock,
            productosBajoStock: lowStockProducts,
            rotacionProductos: {
                altaDemanda: highDemandProducts,
                bajaDemanda: lowDemandProducts
            },
            registroMovimientos: inventoryMovements,
            comparacionPeriodos: stockComparison
        });

    } catch (error) {
        console.error('Error ejecutando la consulta:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const getDebtReport = async (req, res) => {
    try {
        // **1. Obtener clientes con deudas pendientes**
        const [clientesConDeudas] = await pool.query(`
            SELECT 
                c.id_cliente,
                c.nombre_cliente,
                c.telefono_cliente,
                c.direccion_cliente,
                ROUND(COALESCE(SUM(r.saldo_restante), 0), 0) AS total_adeudado,
                COUNT(r.id_remito) AS cantidad_remitos_pendientes
            FROM Clientes c
            LEFT JOIN Remitos r ON c.id_cliente = r.id_cliente
            WHERE r.saldo_restante > 0 AND c.is_hidden = 0
            GROUP BY c.id_cliente
            ORDER BY total_adeudado DESC;
        `);

        // **2. Obtener historial de pagos de clientes**
        const [historialPagos] = await pool.query(`
            SELECT 
                p.id_pago,
                c.id_cliente,
                c.nombre_cliente,
                ROUND(p.monto, 0) AS monto,
                DATE_FORMAT(p.fecha_pago, '%Y/%m/%d') AS fecha_pago,
                p.hora_pago
            FROM Cobranza_a_Clientes p
            INNER JOIN Clientes c ON p.id_cliente = c.id_cliente
            ORDER BY p.fecha_pago DESC, p.hora_pago DESC;
        `);

        // **3. Obtener remitos pendientes organizados por cliente y fecha**
        const [remitosPendientes] = await pool.query(`
            SELECT 
                r.id_remito,
                c.id_cliente,
                c.nombre_cliente,
                DATE_FORMAT(r.fecha_remito, '%Y/%m/%d') AS fecha_remito,
                ROUND(r.monto_total, 0) AS monto_total,
                ROUND(r.saldo_restante, 0) AS saldo_restante,
                CASE 
                    WHEN r.estado = 1 THEN 'Pendiente'
                    WHEN r.estado = 2 THEN 'Parcialmente'
                    WHEN r.estado = 3 THEN 'Pagado'
                    ELSE 'Desconocido'
                END AS estado_remito
            FROM Remitos r
            INNER JOIN Clientes c ON r.id_cliente = c.id_cliente
            WHERE r.saldo_restante > 0
            ORDER BY c.nombre_cliente, r.fecha_remito;
        `);

        // **4. Evolución de la deuda en el tiempo (Deuda total por mes)**
        const [evolucionDeuda] = await pool.query(`
            SELECT 
                DATE_FORMAT(r.fecha_remito, '%Y-%m') AS mes,
                ROUND(SUM(r.saldo_restante), 0) AS total_adeudado
            FROM Remitos r
            WHERE r.saldo_restante > 0
            GROUP BY mes
            ORDER BY mes;
        `);

        // **5. Flujo de pagos en el tiempo (Pagos realizados por mes)**
        const [flujoPagos] = await pool.query(`
            SELECT 
                DATE_FORMAT(p.fecha_pago, '%Y-%m') AS mes,
                ROUND(SUM(p.monto), 0) AS total_pagado
            FROM Cobranza_a_Clientes p
            GROUP BY mes
            ORDER BY mes;
        `);

        // **6. Clientes que tardan más en pagar (Días promedio de pago)**
        const [tiempoPromedioPago] = await pool.query(`
            SELECT 
                c.id_cliente,
                c.nombre_cliente,
                ROUND(AVG(DATEDIFF(p.fecha_pago, r.fecha_remito)), 2) AS dias_promedio_pago
            FROM Cobranza_a_Clientes p
            JOIN Factura_de_Remitos fr ON p.id_pago = fr.id_pago
            JOIN Remitos r ON fr.id_remito = r.id_remito
            JOIN Clientes c ON r.id_cliente = c.id_cliente
            WHERE p.fecha_pago IS NOT NULL
            GROUP BY c.id_cliente
            ORDER BY dias_promedio_pago DESC;
        `);

        // **7. Porcentaje de deuda recuperada (Pagado vs pendiente)**
        const [[{ porcentaje_recuperado }]] = await pool.query(`
            SELECT 
                ROUND((SUM(f.monto_descontado) / SUM(r.monto_total)) * 100, 2) AS porcentaje_recuperado
            FROM Factura_de_Remitos f
            JOIN Remitos r ON f.id_remito = r.id_remito;
        `);

        // **8. Clientes con deudas de más de 30 dias**
        const [deudasAntiguas] = await pool.query(`
            SELECT 
                c.id_cliente,
                c.nombre_cliente,
                SUM(r.saldo_restante) AS total_adeudado
            FROM Remitos r
            JOIN Clientes c ON r.id_cliente = c.id_cliente
            WHERE r.saldo_restante > 0 
            AND DATEDIFF(CURDATE(), r.fecha_remito) > 30
            GROUP BY c.id_cliente
            ORDER BY total_adeudado DESC;
        `);

        // **9. Segmentación de clientes por nivel de deuda**
        const [segmentacionClientes] = await pool.query(`
            SELECT 
                c.id_cliente,
                c.nombre_cliente,
                SUM(r.saldo_restante) AS total_adeudado,
                CASE
                    WHEN SUM(r.saldo_restante) < 5000 THEN 'Baja'
                    WHEN SUM(r.saldo_restante) BETWEEN 5000 AND 15000 THEN 'Media'
                    ELSE 'Alta'
                END AS categoria_deuda
            FROM Clientes c
            JOIN Remitos r ON c.id_cliente = r.id_cliente
            WHERE r.saldo_restante > 0
            GROUP BY c.id_cliente
            ORDER BY total_adeudado DESC;
        `);

        // **Enviar la respuesta en JSON**
        res.status(200).json({
            clientesConDeudas,
            historialPagos,
            remitosPendientes,
            evolucionDeuda,
            flujoPagos,
            tiempoPromedioPago,
            porcentajeRecuperado: porcentaje_recuperado || 0,
            deudasAntiguas,
            segmentacionClientes
        });

    } catch (error) {
        console.error('Error al obtener el informe de deudas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const getPurchaseReport = async (req, res) => {
    try {
        // **1. Obtener historial de compras por proveedor con más detalles**
        const [compras] = await pool.query(`
            SELECT 
                fc.id_factura,
                p.nombre_proveedor,
                p.telefono_proveedor,
                p.email_proveedor,
                p.direccion_proveedor,
                fc.fecha_compra,
                fc.hora_compra,
                ROUND(fc.monto_total, 0) AS monto_total
            FROM Factura_de_Compras fc
            JOIN Proveedores p ON fc.id_proveedor = p.id_proveedor
            ORDER BY fc.fecha_compra DESC;
        `);

        // **2. Obtener productos adquiridos con costos, stock y precios de venta**
        const [detallesCompra] = await pool.query(`
            SELECT 
                dfc.id_factura AS numero_factura,
                pr.nombre_producto,
                dfc.cantidad,
                ROUND(pr.precio_compra, 0) AS precio_compra,
                ROUND(pr.precio_venta, 0) AS precio_venta,
                ROUND(dfc.subtotal, 0) AS subtotal,
                pr.stock_disponible,
                pr.stock_minimo,
                CASE 
                    WHEN pr.stock_disponible < pr.stock_minimo THEN 'Reponer'
                    ELSE 'Suficiente'
                END AS estado_stock
            FROM Detalle_Factura_Compra dfc
            JOIN Productos pr ON dfc.id_producto = pr.id_producto
            ORDER BY dfc.id_factura;
        `);

        // **3. Comparación de precios entre proveedores**
        const [comparacionPrecios] = await pool.query(`
            SELECT 
                pr.nombre_producto,
                p.nombre_proveedor,
                ROUND(pr.precio_compra, 0) AS precio_compra,
                ROUND(pr.precio_venta, 0) AS precio_venta
            FROM Productos pr
            JOIN Factura_de_Compras fc ON pr.id_producto = fc.id_proveedor
            JOIN Proveedores p ON fc.id_proveedor = p.id_proveedor
            ORDER BY pr.nombre_producto, pr.precio_compra;
        `);

        // **4. Enviar datos al frontend en formato JSON**
        res.json({
            historialCompras: compras,
            productosAdquiridos: detallesCompra,
            comparacionPrecios: comparacionPrecios
        });

    } catch (error) {
        console.error('Error al obtener el informe de compras:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const getCashFlowReport = async (req, res) => {
    try {
        const { fecha, periodo = "dia" } = req.query;

        if (!fecha) {
            return res.status(400).json({ error: 'La fecha es obligatoria' });
        }

        let filtroFecha = "";
        let params = [fecha];

        // 📌 Definir el filtro según el período seleccionado
        switch (periodo) {
            case "mes":
                filtroFecha = "WHERE YEAR(fecha_movimiento) = YEAR(?) AND MONTH(fecha_movimiento) = MONTH(?)";
                params = [fecha, fecha];
                break;
            case "año":
                filtroFecha = "WHERE YEAR(fecha_movimiento) = YEAR(?)";
                break;
            case "dia":
            default:
                filtroFecha = "WHERE DATE(fecha_movimiento) = ?";
                break;
        }

        // **1. Obtener saldo inicial antes del período**
        const [saldoInicial] = await pool.query(
            `
                SELECT COALESCE(ROUND(SUM(monto), 0), 0) AS saldo_inicial
                FROM Flujo_De_Caja
                WHERE fecha_movimiento < ?;
            `, [fecha]
        );

        // **2. Obtener movimientos de caja detallados**
        const [movimientos] = await pool.query(`
            SELECT 
                fc.id_movimiento,
                u.nombre_usuario,
                tm.movimiento AS tipo_movimiento,
                fc.numero_de_factura,
                DATE_FORMAT(fc.fecha_movimiento, '%Y/%m/%d') AS fecha_movimiento,
                fc.hora_movimiento,
                ROUND(fc.monto, 0) AS monto
            FROM Flujo_De_Caja fc
            JOIN Usuarios_del_sistema u ON fc.id_usuario = u.id_usuario
            JOIN tipos_movimientos tm ON fc.id_tipo_movimiento = tm.id_tipo_movimiento
            ${filtroFecha}
            ORDER BY fc.fecha_movimiento, fc.hora_movimiento;
        `, params);

        // **3. Obtener total de entradas y salidas**
        const [totales] = await pool.query(
            `
                SELECT 
                    (SELECT ROUND(COALESCE(SUM(monto), 0), 0) 
                        FROM Flujo_De_Caja 
                        ${filtroFecha} AND id_tipo_movimiento = 1) AS total_entradas,
                    (SELECT ROUND(COALESCE(SUM(monto), 0), 0) 
                        FROM Flujo_De_Caja 
                        ${filtroFecha} AND id_tipo_movimiento = 2) AS total_salidas;
            `, [...params, ...params]);

        // **4. Obtener saldo final con conversión **
        const saldoFinal =
            Number(saldoInicial[0].saldo_inicial) +
            Number(totales[0].total_entradas) -
            Number(totales[0].total_salidas);

        // **5. Relacionar salidas con compras de productos**
        const filtroCompras = filtroFecha.replace(/fecha_movimiento/g, "fecha_compra");
        const [compras] = await pool.query(`
            SELECT 
                fc.id_factura,
                p.nombre_proveedor,
                DATE_FORMAT(fc.fecha_compra, '%Y/%m/%d') AS fecha_compra,
                fc.hora_compra,
                ROUND(fc.monto_total, 0) AS monto_total
            FROM Factura_de_Compras fc
            JOIN Proveedores p ON fc.id_proveedor = p.id_proveedor
            ${filtroCompras}
            ORDER BY fc.fecha_compra, fc.hora_compra;
        `, params);

        // **6. Relacionar entradas con pagos de clientes**
        const filtroCobranzas = filtroFecha.replace(/fecha_movimiento/g, "fecha_pago");
        const [cobranzas] = await pool.query(`
            SELECT 
                c.id_pago,
                cl.nombre_cliente,
                DATE_FORMAT(c.fecha_pago, '%Y/%m/%d') AS fecha_pago,
                c.hora_pago,
                ROUND(c.monto, 0) AS monto
            FROM Cobranza_a_Clientes c
            JOIN Clientes cl ON c.id_cliente = cl.id_cliente
            ${filtroCobranzas}
            ORDER BY c.fecha_pago, c.hora_pago;
        `, params);

        // **7. Enviar datos al frontend**
        res.json({
            fecha,
            periodo,
            saldoInicial: saldoInicial[0].saldo_inicial,
            totalEntradas: totales[0].total_entradas,
            totalSalidas: totales[0].total_salidas,
            saldoFinal,
            movimientos,
            compras,
            cobranzas
        });

    } catch (error) {
        console.error('Error al obtener el informe de movimientos de caja:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const getAuditReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: "Las fechas de inicio y fin son obligatorias" });
        }

        // **Obtener registros de auditoría detallados**
        const [auditoria] = await pool.query(
            `
                SELECT 
                    a.id_auditoria,
                    u.nombre_usuario,
                    r.roles AS rol_usuario,
                    DATE_FORMAT(a.fecha_de_cambio, '%Y/%m/%d') AS fecha_de_cambio,
                    a.hora_de_cambio,
                    a.tabla_afectada,
                    a.id_registro_afectado,
                    CASE 
                        WHEN tipo_de_modificacion = 2 THEN 'Modificación'
                        WHEN tipo_de_modificacion = 3 THEN 'Ocultacion'
                        ELSE 'Desconocido'
                    END AS tipo_modificacion
                FROM Auditoria a
                JOIN Usuarios_del_sistema u ON a.id_usuario = u.id_usuario
                JOIN Roles_de_Usuario r ON u.id_role = r.id_role
                WHERE a.fecha_de_cambio BETWEEN ? AND ?
                ORDER BY a.fecha_de_cambio DESC, a.hora_de_cambio DESC;
            `, [startDate, endDate]
        );

        // **Contar tipos de modificaciones**
        const [conteoModificaciones] = await pool.query(
            `
                SELECT 
                    CASE 
                        WHEN tipo_de_modificacion = 2 THEN 'Modificación'
                        WHEN tipo_de_modificacion = 3 THEN 'Ocultacion'
                    END AS tipo_modificacion,
                    COUNT(*) AS cantidad
                FROM Auditoria
                WHERE fecha_de_cambio BETWEEN ? AND ?
                GROUP BY tipo_de_modificacion;
            `, [startDate, endDate]
        );

        // **Obtener actividad por usuario**
        const [actividadUsuarios] = await pool.query(
            `
                SELECT 
                    u.nombre_usuario,
                    r.roles AS rol_usuario,
                    COUNT(a.id_auditoria) AS cambios_realizados
                FROM Auditoria a
                JOIN Usuarios_del_sistema u ON a.id_usuario = u.id_usuario
                JOIN Roles_de_Usuario r ON u.id_role = r.id_role
                WHERE a.fecha_de_cambio BETWEEN ? AND ?
                GROUP BY a.id_usuario
                ORDER BY cambios_realizados DESC;
            `, [startDate, endDate]
        );

        // **Historial de cambios por registro**
        const [historialCambios] = await pool.query(
            `
                SELECT 
                    id_registro_afectado, 
                    tabla_afectada, 
                    COUNT(id_auditoria) AS veces_modificado
                FROM Auditoria
                WHERE fecha_de_cambio BETWEEN ? AND ?
                GROUP BY id_registro_afectado, tabla_afectada
                ORDER BY veces_modificado DESC;
            `, [startDate, endDate]
        );

        // **Detección de usuarios con cambios excesivos**
        const [usuariosSospechosos] = await pool.query(
            `
                SELECT 
                    u.nombre_usuario,
                    COUNT(a.id_auditoria) AS cambios_realizados
                FROM Auditoria a
                JOIN Usuarios_del_sistema u ON a.id_usuario = u.id_usuario
                WHERE a.fecha_de_cambio BETWEEN ? AND ?
                GROUP BY a.id_usuario
                HAVING cambios_realizados > 5
                ORDER BY cambios_realizados DESC;
            `, [startDate, endDate]
        );

        // **Enviar datos al frontend**
        res.json({
            startDate,
            endDate,
            totalRegistros: auditoria.length,
            auditoria: auditoria,
            conteoModificaciones,
            actividadUsuarios,
            historialCambios,
            usuariosSospechosos
        });

    } catch (error) {
        console.error("Error al obtener el informe de auditoría:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

