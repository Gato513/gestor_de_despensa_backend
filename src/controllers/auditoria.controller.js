import { pool } from '../config/mysql.config.js'

const getCurrentDateTime = () => {
    const currentDate = new Date();
    return {
        date: currentDate.toISOString().split('T')[0],
        time: currentDate.toLocaleTimeString()
    };
};

export const registerAudit = async ({ userId, tableName, recordId, modifiedValues, previousValues, modificationType }) => {
    const { date, time } = getCurrentDateTime();
    try {

        await pool.query(
            `
                INSERT INTO 
                    Auditoria (id_usuario, fecha_de_cambio, hora_de_cambio, tabla_afectada, id_registro_afectado, valores_modificado, previous_values, tipo_de_modificacion) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [userId, date, time, tableName, recordId, modifiedValues, previousValues, modificationType]
        );
    } catch (error) {
        console.error('Error registering audit:', error);
        throw new Error('Audit registration failed');
    }
};


export const getAllAudit = async (req, res) => {
    try {
        const [aditorias] = await pool.query(
            `
                SELECT
                    ad.id_auditoria AS numero_auditoria,
                    us.nombre_usuario AS responsable,
                    DATE_FORMAT(ad.fecha_de_cambio, '%Y/%m/%d') AS fecha_de_cambio,
                    ad.hora_de_cambio,
                    ad.tabla_afectada,
                    ad.id_registro_afectado AS registro_afectado
                FROM 
                    Auditoria ad
                JOIN
                    Usuarios_del_sistema us ON  ad.id_usuario = us.id_usuario;
            `
        );
        res.status(200).json(aditorias);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAuditById = async (req, res) => {
    const { id } = req.params;

    try {
        const [auditoriaData] = await pool.query(
            `
                SELECT
                    ad.id_auditoria AS numero_auditoria,
                    us.nombre_usuario AS responsable,
                    DATE_FORMAT(ad.fecha_de_cambio, '%Y/%m/%d') AS fecha_de_cambio,
                    ad.hora_de_cambio,
                    ad.tabla_afectada,
                    ad.id_registro_afectado AS registro_afectado
                FROM
                    Auditoria ad
                JOIN
                    Usuarios_del_sistema us ON ad.id_usuario = us.id_usuario
                WHERE
                    id_auditoria = ?;
            `, [id]
        );

        if (auditoriaData.length === 0) {
            return res.status(404).json({ error: 'Auditoría no encontrada' });
        }

        const [cambiosRealizados] = await pool.query(
            `
                SELECT
                    valores_modificado AS data_before_modification,
                    previous_values AS data_after_modification
                FROM
                    Auditoria
                WHERE
                    id_auditoria = ?
            `, [id]
        );

        // Estructurar el resultado final
        const auditoria = auditoriaData[0];

        let data_before_access = [];
        let data_after_access = [];

        if (cambiosRealizados.length > 0) {
            const cambios = cambiosRealizados[0];

            const data_before = JSON.parse(cambios.data_before_modification);
            const data_after = JSON.parse(cambios.data_after_modification);

            auditoria.lista_de_cambios = {
                data_before_modification: data_before,
                data_after_modification: data_after
            };

            // Extraer las claves de cada objeto
            data_before_access = Object.keys(data_before);
            data_after_access = Object.keys(data_after);
        } else {
            auditoria.lista_de_cambios = {};
        }

        res.json({
            auditoria,
            data_before_access,
            data_after_access
        });

    } catch (error) {
        console.error('Error ejecutando la consulta:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};


