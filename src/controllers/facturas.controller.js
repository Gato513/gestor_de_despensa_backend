import { pool } from '../config/mysql.config.js'

export const getAllFacturas = async (req, res) => {
    try {
        const [facturasVentasDinero] = await pool.query(
            `
                SELECT
                    cc.id_pago AS numero_factura,
                    cl.nombre_cliente AS nombre_entidad,
                    ROUND(cc.monto, 0) AS monto_facturado,
                    DATE_FORMAT(cc.fecha_pago, '%Y/%m/%d') AS fecha_facturacion,
                    cc.hora_pago AS hora_facturacion,
                    'venta' AS tipo_factura,
                    'Clientes' AS tipo_entida
                FROM
                    Cobranza_a_Clientes cc
                JOIN
                    Clientes cl ON cc.id_cliente = cl.id_cliente;
            `
        );
        const [facturasComprasDinero] = await pool.query(
            `
                SELECT
                    fc.id_factura AS numero_factura,
                    pr.nombre_proveedor AS nombre_entidad,
                    ROUND(fc.monto_total, 0) AS monto_facturado,
                    DATE_FORMAT(fc.fecha_compra, '%Y/%m/%d') AS fecha_facturacion,
                    fc.hora_compra AS hora_facturacion,
                    'compra' AS tipo_factura,
                    'Proveedores' AS tipo_entida
                FROM
                    Factura_de_Compras fc
                JOIN
                    Proveedores pr ON fc.id_proveedor = pr.id_proveedor;
            `
        );

        const facturas = [...facturasVentasDinero, ...facturasComprasDinero];
        res.status(200).json(facturas);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getFacturaById = async (req, res) => {
    const { id } = req.params;
    const { facturaType } = req.query; // 'venta' o 'compra'

    try {
        let facturaQuery;
        let detallesQuery;
        let params = [id];

        if (facturaType === 'venta') {
            // Consulta para obtener los datos principales de la factura de venta
            facturaQuery = `
                SELECT 
                    cc.id_pago AS numero_factura,
                    cl.nombre_cliente AS nombre_entidad,
                    cl.telefono_cliente AS telefono_entidad,
                    cl.direccion_cliente AS direccion_entidad,
                    ROUND(cc.monto, 2) AS monto_facturado,
                    DATE_FORMAT(cc.fecha_pago, '%Y/%m/%d') AS fecha_factura,
                    cc.hora_pago AS hora_factura,
                    'Venta' AS tipo_factura
                FROM Cobranza_a_Clientes cc
                JOIN Clientes cl ON cc.id_cliente = cl.id_cliente
                WHERE cc.id_pago = ?;
            `;

            // Consulta para obtener los detalles de los productos en la factura de venta
            detallesQuery = `
                SELECT 
                    dr.id_remito,
                    DATE_FORMAT(r.fecha_remito, '%Y/%m/%d') AS fecha_remito,
                    ROUND(r.monto_total, 0) AS monto_original,
                    ROUND(r.saldo_restante, 0) AS saldo_restante,
                    p.id_producto,
                    p.nombre_producto,
                    dr.cantidad,
                    ROUND(dr.subtotal, 0) AS subtotal
                FROM Factura_de_Remitos fr
                JOIN Remitos r ON fr.id_remito = r.id_remito
                JOIN Detalles_de_Remito dr ON r.id_remito = dr.id_remito
                JOIN Productos p ON dr.id_producto = p.id_producto
                WHERE fr.id_pago = ?;
            `;

        } else if (facturaType === 'compra') {
            // Consulta para obtener los datos principales de la factura de compra
            facturaQuery = `
                SELECT
                    fc.id_factura AS numero_factura,
                    pr.nombre_proveedor AS nombre_entidad,
                    pr.telefono_proveedor AS telefono_entidad,
                    pr.direccion_proveedor AS direccion_entidad,
                    ROUND(fc.monto_total, 0) AS monto_facturado,
                    DATE_FORMAT(fc.fecha_compra, '%Y/%m/%d') AS fecha_factura,
                    fc.hora_compra AS hora_factura,
                    'Compra' AS tipo_factura
                FROM Factura_de_Compras fc
                JOIN Proveedores pr ON fc.id_proveedor = pr.id_proveedor
                WHERE fc.id_factura = ?;
            `;

            // Consulta para obtener los detalles de los productos en la factura de compra
            detallesQuery = `
                SELECT 
                    dfc.id_producto,
                    p.nombre_producto,
                    dfc.cantidad,
                    ROUND(dfc.subtotal, 0) AS subtotal
                FROM Detalle_Factura_Compra dfc
                JOIN Productos p ON dfc.id_producto = p.id_producto
                WHERE dfc.id_factura = ?;
            `;

        } else {
            return res.status(400).json({ error: 'Tipo de factura inválido. Use "venta" o "compra".' });
        }

        // Ejecutar la consulta principal
        const [facturaRows] = await pool.query(facturaQuery, params);

        if (facturaRows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }

        // Ejecutar la consulta de detalles
        const [detallesRows] = await pool.query(detallesQuery, params);

        // Estructurar la respuesta final
        const factura = facturaRows[0];
        factura.detalles_productos = detallesRows;

        res.json(factura);
    } catch (error) {
        console.error('Error ejecutando la consulta:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

