import { pool } from '../config/mysql.config.js'
import { registerAudit } from './auditoria.controller.js';

export const createProveedor = async (req, res) => {
    const { nombreProveedor, telefonoProveedor, emailProveedor, direccionProveedor } = req.body;

    try {
        // Insertar nuevo cliente
        await pool.query(
            "INSERT INTO Proveedores ( nombre_proveedor, telefono_proveedor, email_proveedor, direccion_proveedor) VALUES (?, ?, ?, ?)",
            [nombreProveedor, telefonoProveedor, emailProveedor, direccionProveedor]
        );

        // Obtén el último id_factura
        const [[{ proveedorId }]] = await pool.query("SELECT MAX(id_proveedor) AS proveedorId FROM Proveedores");

        res.status(201).json(
            {
                id_proveedor: proveedorId,
                nombre_proveedor: nombreProveedor
            });

    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllProveedores = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
                SELECT
                    id_proveedor,
                    nombre_proveedor,
                    telefono_proveedor,
                    email_proveedor,
                    direccion_proveedor,
                    is_hidden
                FROM
                    Proveedores
                WHERE
                    is_hidden = false
            `
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getProveedorById = async (req, res) => {
    const { id } = req.params;

    try {
        // Obtener datos del proveedor
        const [proveedorRows] = await pool.query(
            `
                SELECT
                    p.nombre_proveedor,
                    p.telefono_proveedor,
                    p.email_proveedor,
                    p.direccion_proveedor
                FROM
                    Proveedores p
                WHERE
                    id_proveedor = ?
            `, [id]
        );

        if (proveedorRows.length === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        // Obtener productos que vende el proveedor con la última compra
        const [productosDelProveedor] = await pool.query(
            `
                SELECT
                    pr.nombre_producto,
                    ROUND(dfc.subtotal / NULLIF(dfc.cantidad, 0), 0) AS ultimo_precio_compra,
                    DATE_FORMAT(fc.fecha_compra, '%Y/%m/%d') AS ultima_fecha_compra
                FROM
                    Productos pr
                JOIN
                    Detalle_Factura_Compra dfc ON pr.id_producto = dfc.id_producto
                JOIN
                    Factura_de_Compras fc ON dfc.id_factura = fc.id_factura
                WHERE
                    fc.id_proveedor = ?
                AND dfc.id_factura = (
                    SELECT dfc2.id_factura
                    FROM Detalle_Factura_Compra dfc2
                    JOIN Factura_de_Compras fc2 ON dfc2.id_factura = fc2.id_factura
                    WHERE fc2.id_proveedor = ?
                    AND dfc2.id_producto = pr.id_producto
                    ORDER BY fc2.fecha_compra DESC, dfc2.id_factura DESC
                    LIMIT 1
                )
            `, [id, id]
        );

        // Estructurar la respuesta
        const proveedor = proveedorRows[0];
        proveedor.list_of_product = productosDelProveedor;

        res.json(proveedor);
    } catch (error) {
        console.error('Error en la consulta SQL:', error.sqlMessage || error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const updateProveedor = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.session.user;
    const { nombre_proveedor, telefono_proveedor, direccion_proveedor, email_proveedor } = req.body;

    try {

        const [rows] = await pool.query(`SELECT nombre_proveedor, telefono_proveedor, direccion_proveedor, email_proveedor FROM Proveedores WHERE id_proveedor = ?`, [id]);
        const previousValues = JSON.stringify(rows[0]);

        const [result] = await pool.query(
            "UPDATE Proveedores SET nombre_proveedor = ?, telefono_proveedor = ?, email_proveedor = ?, direccion_proveedor = ? WHERE id_proveedor = ?",
            [nombre_proveedor, telefono_proveedor, email_proveedor, direccion_proveedor, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        const auditData = {
            userId: userId,
            tableName: 'Proveedores',
            recordId: id,
            previousValues,
            modifiedValues: JSON.stringify({ nombre_proveedor, telefono_proveedor, direccion_proveedor, email_proveedor }),
            modificationType: 2
        }

        // Registrar auditoría
        await registerAudit(auditData);

        res.json({ message: 'Proveedor actualizado' });
    } catch (error) {
        console.error('Error ejecutando consulta:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const hideProveedor = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.session.user;

    try {
        const [result] = await pool.query(
            "UPDATE Proveedores SET is_hidden = TRUE WHERE id_proveedor = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Provider not found' });
        }

        const auditData = {
            userId: userId,
            tableName: 'Proveedores',
            recordId: id,
            previousValues: JSON.stringify({ is_hidden: 'is_hidden: FALSE' }),
            modifiedValues: JSON.stringify({ is_hidden: 'is_hidden: TRUE' }),
            modificationType: 3
        }

        await registerAudit(auditData);


        res.json({ message: 'Provider hidden successfully' });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};