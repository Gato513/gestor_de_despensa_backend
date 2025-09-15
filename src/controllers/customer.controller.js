import { pool } from '../config/mysql.config.js'
import { registerAudit } from './auditoria.controller.js';

export const createCustomer = async (req, res) => {
    const { nombreCliente, telefonoCliente, direccionCliente } = req.body;

    try {
        // Insertar nuevo cliente
        await pool.query(
            "INSERT INTO Clientes ( nombre_cliente, telefono_cliente, direccion_cliente) VALUES (?, ?, ?)",
            [nombreCliente, telefonoCliente, direccionCliente]
        );

        // Obtén el último id_factura
        const [[{ clientId }]] = await pool.query("SELECT MAX(id_cliente) AS clientId FROM Clientes");

        res.status(201).json(
            {
                id_cliente: clientId,
                nombre_cliente: nombreCliente,
                telefono_cliente: telefonoCliente,
                direccion_cliente: direccionCliente,
            });

    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllCustomers = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
                SELECT 
                    id_cliente,
                    nombre_cliente,
                    telefono_cliente,
                    direccion_cliente,
                    is_hidden
                FROM 
                    Clientes
                WHERE
                    is_hidden = false;
            `
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getCustomerById = async (req, res) => {
    const { id } = req.params;

    try {
        const [clientRows] = await pool.query(
            `
                SELECT
                    cl.id_cliente,
                    cl.nombre_cliente,
                    cl.telefono_cliente,
                    cl.direccion_cliente,
                    COUNT(r.id_remito) AS cantidad_remitos,
                    COALESCE(ROUND(SUM(CASE WHEN r.estado != 3 THEN r.saldo_restante ELSE 0 END), 0), 0) AS deuda_total
                FROM
                    Clientes cl
                LEFT JOIN
                    Remitos r ON cl.id_cliente = r.id_cliente
                WHERE
                    cl.id_cliente = ?
                GROUP BY
                    cl.id_cliente;
            `, [id]
        );

        if (clientRows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const [remitosDelClient] = await pool.query(
            `
                SELECT
                    r.id_remito AS num_remito,
                    DATE_FORMAT(r.fecha_remito, '%Y/%m/%d') AS fecha_remito,
					ROUND(r.monto_total, 0) AS monto_original,
					ROUND(r.saldo_restante, 0) AS saldo_restante,
                    er.estados AS estado
                FROM
                    Remitos r
                JOIN
					Estados_Remito er ON r.estado = er.id_Estados
                WHERE
                    r.id_cliente = ? AND estado != 3;
            `, [id]
        );

        // Estructurar el resultado final
        const client = clientRows[0];
        client.list_of_remitos = remitosDelClient;

        res.json(client);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateCustomer = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.session.user;
    const { nombre_cliente, telefono_cliente, direccion_cliente, } = req.body;

    try {

        const [rows] = await pool.query(`SELECT nombre_cliente, telefono_cliente, direccion_cliente FROM Clientes WHERE id_cliente = ?`, [id]);
        const previousValues = JSON.stringify(rows[0]);

        const [result] = await pool.query(
            "UPDATE Clientes SET nombre_cliente = ?, telefono_cliente = ?, direccion_cliente = ? WHERE id_cliente = ?",
            [nombre_cliente, telefono_cliente, direccion_cliente, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Remito not found' });
        }

        const auditData = {
            userId: userId,
            tableName: 'Clientes',
            recordId: id,
            previousValues,
            modifiedValues: JSON.stringify({ nombre_cliente, telefono_cliente, direccion_cliente }),
            modificationType: 2
        }

        // Registrar auditoría
        await registerAudit(auditData);

        res.json({ message: 'Client updated' });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const hideCustomer = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.session.user;

    try {
        const [result] = await pool.query(
            "UPDATE Clientes SET is_hidden = TRUE WHERE id_cliente = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }


        const auditData = {
            userId: userId,
            tableName: 'Clientes',
            recordId: id,
            previousValues: JSON.stringify({ is_hidden: 'is_hidden: FALSE' }),
            modifiedValues: JSON.stringify({ is_hidden: 'is_hidden: TRUE' }),
            modificationType: 3
        }

        await registerAudit(auditData);

        res.json({ message: 'Client hidden successfully' });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

