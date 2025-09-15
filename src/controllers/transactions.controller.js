import { pool } from '../config/mysql.config.js';

// Función auxiliar para obtener la fecha y hora actuales
const getCurrentDateTime = () => {
    const currentDate = new Date();
    return {
        date: currentDate.toISOString().split('T')[0],
        time: currentDate.toLocaleTimeString()
    };
};

// Función auxiliar para ejecutar una transacción
const executeTransaction = async (queries) => {
    try {
        await pool.query('START TRANSACTION');
        for (const query of queries) {
            await pool.query(query.sql, query.params);
        }
        await pool.query('COMMIT');
    } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
    }
};

//$ Compra de Productos:
export const purchaseProduct = async (req, res) => {
    const { proveedorId, montoDeCompra, productosComprados } = req.body;
    const { userId } = req.session.user;
    const { date: purchaseDate, time: purchaseTime } = getCurrentDateTime();

    if (!proveedorId || !montoDeCompra || !Array.isArray(productosComprados) || productosComprados.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos o inválidos en la solicitud' });
    }

    try {
        const queryList = [];

        // Insertar en Factura_de_Compras y obtener el ID generado
        const [result] = await pool.query(
            "INSERT INTO Factura_de_Compras (id_proveedor, monto_total, fecha_compra, hora_compra) VALUES (?, ?, ?, ?)",
            [proveedorId, montoDeCompra, purchaseDate, purchaseTime]
        );
        const { insertId: facturaId } = result;

        if (!facturaId) {
            throw new Error("No se pudo obtener el ID de la factura insertada.");
        }

        // Construir consultas para Detalle_Factura_Compra y Productos
        for (const producto of productosComprados) {
            const { id_producto, cantidad, subtotal, stockActual, precio_compra, precio_venta } = producto;

            if (!id_producto || !cantidad || !subtotal || stockActual === undefined) {
                throw new Error("Datos de producto incompletos.");
            }

            const newStock = stockActual + cantidad;

            queryList.push({
                sql: "INSERT INTO Detalle_Factura_Compra (id_factura, id_producto, cantidad, subtotal) VALUES (?, ?, ?, ?)",
                params: [facturaId, id_producto, cantidad, subtotal]
            });

            queryList.push({
                sql: "UPDATE Productos SET stock_disponible = ?, ultima_actualizacion = ?, precio_compra = ?, precio_venta= ? WHERE id_producto = ?",
                params: [newStock, purchaseDate, precio_compra, precio_venta, id_producto]
            });
        }

        // Insertar en Flujo_De_Caja
        queryList.push({
            sql: "INSERT INTO Flujo_De_Caja (id_usuario, numero_de_factura, fecha_movimiento, hora_movimiento, id_tipo_movimiento, monto) VALUES (?, ?, ?, ?, ?, ?)",
            params: [userId, facturaId, purchaseDate, purchaseTime, 2, montoDeCompra]
        });

        await executeTransaction(queryList);

        res.status(201).json({ message: 'Successful operation', facturaId });
    } catch (error) {
        console.error('Error en purchaseProduct:', error.stack || error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
};

//% Cobranza y facturación de remitos:
export const collectionAndBilling = async (req, res) => {
    const { cliente, monto, billingRemito } = req.body;
    const { userId } = req.session.user;
    const { date: billingDate, time: billingTime } = getCurrentDateTime();

    if (!cliente || !monto || !Array.isArray(billingRemito) || billingRemito.length === 0) {
        return res.status(400).json({ error: 'Datos incompletos o inválidos en la solicitud' });
    }

    try {
        const queryList = [];

        // Insertar en Cobranza_a_Clientes y obtener el ID generado
        const [result] = await pool.query(
            "INSERT INTO Cobranza_a_Clientes (id_cliente, monto, fecha_pago, hora_pago) VALUES (?, ?, ?, ?)",
            [cliente, monto, billingDate, billingTime]
        );
        const facturaId = result.insertId;

        if (!facturaId) {
            throw new Error("No se pudo obtener el ID del pago insertado.");
        }

        // Construir consultas para Factura_de_Remitos y actualizar Remitos
        for (const billing of billingRemito) {
            const { remitoId, nuevoEstado, montoRestante, montoDescontado } = billing;

            if (!remitoId || nuevoEstado === undefined || montoRestante === undefined || !montoDescontado) {
                throw new Error("Datos de remito incompletos o inválidos.");
            }

            queryList.push({
                sql: "INSERT INTO Factura_de_Remitos (id_remito, id_pago, monto_descontado) VALUES (?, ?, ?)",
                params: [remitoId, facturaId, montoDescontado]
            });

            queryList.push({
                sql: "UPDATE Remitos SET saldo_restante = ?, estado = ? WHERE id_remito = ?",
                params: [montoRestante, nuevoEstado, remitoId]
            });
        }

        // Insertar en Flujo_De_Caja
        queryList.push({
            sql: "INSERT INTO Flujo_De_Caja (id_usuario, numero_de_factura, fecha_movimiento, hora_movimiento, id_tipo_movimiento, monto) VALUES (?, ?, ?, ?, ?, ?)",
            params: [userId, facturaId, billingDate, billingTime, 1, monto]
        });

        await executeTransaction(queryList);

        res.status(201).json({ message: 'Factura creada', facturaId });
    } catch (error) {
        console.error('Error en collectionAndBilling:', error.stack || error.message);
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
};


