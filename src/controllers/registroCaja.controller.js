import { pool } from '../config/mysql.config.js'

export const getAllRegistroCaja = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                fc.id_movimiento AS id,
                us.nombre_usuario,
                fc.numero_de_factura,
                DATE_FORMAT(fc.fecha_movimiento, '%Y/%m/%d') AS fecha,
                fc.hora_movimiento AS hora,
                ROUND(fc.monto, 0) AS monto,
                tm.movimiento
            FROM
                Flujo_De_Caja AS fc
            JOIN
                tipos_movimientos tm ON fc.id_tipo_movimiento = tm.id_tipo_movimiento
            JOIN
                Usuarios_del_sistema us ON fc.id_usuario = us.id_usuario;
        `);

        if (rows.length === 0) {
            return res.status(200).json([]);
        }


        res.status(200).json(rows);
    } catch (error) {
        console.error("Error executing query:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};





