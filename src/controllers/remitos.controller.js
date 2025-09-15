import { pool } from '../config/mysql.config.js'

export const createRemito = async (req, res) => {
    const { clientId, montoTotal, productosVendidos } = req.body;
    const fechaCreacioRemito = new Date();

    try {
        await pool.query(
            "INSERT INTO Remitos ( id_cliente, fecha_remito, monto_total, saldo_restante, estado) VALUES (?, ?, ?, ?, ?)",
            [clientId, fechaCreacioRemito, montoTotal, montoTotal, 1]
        );

        const [[{ remitoId }]] = await pool.query("SELECT MAX(id_remito) AS remitoId FROM Remitos");

        for (const producto of productosVendidos) {
            const { productId, cantidad, subtotal, stockActual } = producto;

            const newStock = stockActual - cantidad;

            await pool.query(
                "INSERT INTO Detalles_de_Remito ( id_remito, id_producto, cantidad, subtotal) VALUES (?, ?, ?, ?)",
                [remitoId, productId, cantidad, subtotal]
            );

            await pool.query(
                "UPDATE Productos SET stock_disponible = ? WHERE id_producto = ?",
                [newStock, productId]
            );
        };

        res.status(201).json({ message: 'Remito created' });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllRemitos = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                r.id_remito AS id,
                c.nombre_cliente AS cliente,
                DATE_FORMAT(r.fecha_remito, '%Y/%m/%d') AS fecha_remito,
                ROUND(r.monto_total, 0) AS monto_total,
                ROUND(r.saldo_restante, 0) AS saldo_restante,
                e.estados AS estado
            FROM 
                Remitos r
            JOIN 
                Clientes c ON r.id_cliente = c.id_cliente
            JOIN 
                Estados_Remito e ON r.estado = e.id_Estados;
        `);


        res.status(200).json(rows);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllCustomerRemitos = async (req, res) => {
    const { clientId } = req.params;

    try {
        const [rows] = await pool.query(`
        SELECT
            r.id_remito,
            DATE_FORMAT(r.fecha_remito, '%Y/%m/%d') AS fecha_remito,
            r.saldo_restante,
            r.monto_total,
            er.estados AS estado
        FROM
            Remitos r
        JOIN
            Estados_Remito er ON r.estado = er.id_Estados
        WHERE
            r.id_cliente = ? AND er.estados != 'pagado';`,
            [clientId]
        );

        if (rows.length === 0) {
            return res.status(200).json({ remitosData: [], totalClientDebt: 0 });
        }

        const [[{ totalClientDebt }]] = await pool.query("SELECT SUM(saldo_restante) AS totalClientDebt FROM Remitos WHERE id_cliente = ?", [clientId]);

        const newRows = rows.map(row => {
            const { monto_total, saldo_restante } = row
            return { ...row, monto_total: parseInt(monto_total), saldo_restante: parseInt(saldo_restante) }
        })

        const remitoData = {
            remitosData: newRows,
            totalClientDebt: parseInt(totalClientDebt)
        };

        res.status(200).json(remitoData);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }

};

export const getRemitoById = async (req, res) => {
    const { id } = req.params;

    try {
        // Consulta principal para obtener la información del remito
        const [remitoRows] = await pool.query(
            `SELECT
                r.id_remito AS num_remito,
                cl.nombre_cliente,
                r.fecha_remito,
                ROUND(r.monto_total, 0) AS monto_total,
                ROUND(r.saldo_restante, 0) AS saldo_restante,
                er.estados AS estado
            FROM
                Remitos r
            JOIN Clientes cl ON r.id_cliente = cl.id_cliente
            JOIN Estados_Remito er ON r.estado = er.id_Estados
            WHERE r.id_remito = ?`,
            [id]
        );

        if (remitoRows.length === 0) {
            return res.status(404).json({ error: 'Remito not found' });
        }

        // Consulta para obtener los detalles del remito
        const [detalleRows] = await pool.query(
            `SELECT
                p.nombre_producto,
                dr.cantidad,
                ROUND(dr.subtotal, 0) AS subtotal,
                ROUND(dr.subtotal / dr.cantidad, 0) AS precio_unitario
            FROM
                Detalles_de_Remito dr
            JOIN
                Productos p ON dr.id_producto = p.id_producto
            WHERE
                dr.id_remito =  ?`,
            [id]
        );

        // Estructurar el resultado final
        const remito = remitoRows[0];
        remito.list_of_details = detalleRows;

        res.status(200).json(remito);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


