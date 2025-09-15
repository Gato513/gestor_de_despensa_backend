import bcrypt from 'bcrypt';
import { pool } from '../config/mysql.config.js';
import { generateTempToken } from '../util/generateToken.js';
import { sendPasswordToken } from '../config/email.config.js';
import { SALT_ROUNDS } from '../config/dotEnv.config.js';
import { Validations } from '../validation/session.validation.js';
import { registerAudit } from './auditoria.controller.js';

export const createUserOfSystem = async (req, res) => {
    const { nombre_usuario, telefono_usuario, email_user, user_password } = req.body;

    try {
        // Validaciones de entrada
        Validations.email(email_user);
        Validations.password(user_password);

        // Verificar si el email ya está registrado
        const [rows] = await pool.query(
            "SELECT 1 FROM Usuarios_del_sistema WHERE email_user = ? LIMIT 1",
            [email_user]
        );
        if (rows.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(user_password, parseInt(SALT_ROUNDS));

        // Insertar nuevo usuario
        const idRole = 2; // Asignar el ID de rol por defecto, modificar si es necesario
        await pool.query(
            "INSERT INTO Usuarios_del_sistema (nombre_usuario, telefono_usuario, email_user, user_password, id_role) VALUES (?, ?, ?, ?, ?)",
            [nombre_usuario, telefono_usuario, email_user, hashedPassword, idRole]
        );

        return res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Error:', error);

        // Manejo de errores específicos
        if (error.message.includes('Validation')) {
            return res.status(400).json({ error: error.message });
        }

        // Manejo de errores genéricos
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllUserOfSystem = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `
                SELECT
                    us.id_usuario,
                    us.nombre_usuario,
                    us.telefono_usuario,
                    us.email_user,
                    usr.roles AS userRole
                FROM
                    Usuarios_del_sistema AS us
                JOIN
                    Roles_de_Usuario usr ON us.id_role = usr.id_role
                WHERE
                    is_hidden = false;
            `
        );
        res.json(rows);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getUserOfSystemById = async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await pool.query("SELECT * FROM Usuarios_del_sistema WHERE id_usuario = ?", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateUserOfSystem = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.session.user;
    const { nombre_usuario, telefono_usuario, email_user } = req.body;


    try {

        const [rows] = await pool.query(`SELECT nombre_usuario, telefono_usuario, email_user FROM Usuarios_del_sistema WHERE id_usuario = ?`, [id]);
        const previousValues = JSON.stringify(rows[0]);

        const [result] = await pool.query(
            "UPDATE Usuarios_del_sistema SET nombre_usuario = ?, telefono_usuario = ?, email_user = ? WHERE id_usuario = ?",
            [nombre_usuario, telefono_usuario, email_user, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const auditData = {
            userId: userId,
            tableName: 'Usuarios_del_sistema',
            recordId: id,
            previousValues,
            modifiedValues: JSON.stringify({ nombre_usuario, telefono_usuario, email_user }),
            modificationType: 2
        }

        // Registrar auditoría
        await registerAudit(auditData);

        res.json({ message: 'User updated' });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


export const hideUserOfSystem = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.session.user;

    try {
        const [result] = await pool.query(
            "UPDATE Usuarios_del_sistema SET is_hidden = TRUE WHERE id_usuario = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const auditData = {
            userId: userId,
            tableName: 'Usuarios_del_sistema',
            recordId: id,
            previousValues: JSON.stringify({ is_hidden: 'is_hidden: FALSE' }),
            modifiedValues: JSON.stringify({ is_hidden: 'is_hidden: TRUE' }),
            modificationType: 3
        }

        await registerAudit(auditData);

        res.json({ message: 'User hidden successfully' });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


//? Recuperacion Password
export const passwordResetToken = async (req, res) => {
    const { email } = req.query;

    try {
        const [rows] = await pool.query("SELECT * FROM Usuarios_del_sistema WHERE email_user = ?", [email]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = rows[0];

        //$ Verificar si ya existe un token para el usuario
        const [existingToken] = await pool.query("SELECT * FROM password_token WHERE user_id = ?", [user.id_usuario]);

        if (existingToken.length > 0) {
            await pool.query("DELETE FROM password_token WHERE user_id = ?", [user.id_usuario]);
        }

        //$ Generar y guardar un nuevo token
        const rawToken = generateTempToken(6);
        await pool.query("INSERT INTO password_token (token, user_id) VALUES (?, ?)", [rawToken, user.id_usuario]);

        //$ Enviar token por correo
        await sendPasswordToken({ user, token: rawToken });

        res.status(200).json({ message: 'Token created and sent', token: rawToken });
    } catch (error) {
        console.error('Error executing passwordResetToken:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const passwordReset = async (req, res) => {
    const { email, password, token } = req.body;

    try {
        const [rows] = await pool.query("SELECT * FROM Usuarios_del_sistema WHERE email_user = ?", [email]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = rows[0];
        const [activeTokens] = await pool.query("SELECT * FROM password_token WHERE user_id = ?", [user.id_usuario]);

        if (activeTokens.length === 0 || activeTokens[0].token !== token) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query("UPDATE Usuarios_del_sistema SET user_password = ? WHERE id_usuario = ?", [hashedPassword, user.id_usuario]);

        await pool.query("DELETE FROM password_token WHERE user_id = ?", [user.id_usuario]);

        res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

