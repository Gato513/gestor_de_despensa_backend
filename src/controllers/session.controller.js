import { pool } from '../config/mysql.config.js'
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET_KEY } from '../config/dotEnv.config.js';
import { Validations } from '../validation/session.validation.js';

export const sessionLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        //! Validaciones:
        Validations.email(email);
        Validations.password(password);

        //! Verificamos existencia del usuario:
        const [rows] = await pool.query(
            `
            SELECT
                us.id_usuario AS userId,
                us.nombre_usuario AS userName,
                usr.roles AS userRole,
                us.user_password AS userPassword
            FROM
                Usuarios_del_sistema us
            JOIN
                Roles_de_Usuario usr ON us.id_role = usr.id_role
            WHERE
                email_user = ?
            `,
            [email]
        );

        if (!rows || rows.length === 0) {
            throw new Error('user_not_found');
        }

        //! Validación del password:
        const user = rows[0];
        const isValid = await bcrypt.compare(password, user.userPassword);

        if (!isValid) {
            throw new Error('invalid_password');
        }

        //! Creación del objeto público del usuario:
        const publicUser = {
            userId: user.userId,
            userName: user.userName,
            userRole: user.userRole,
        };

        //! Creación del token JWT:
        const token = jwt.sign(publicUser, JWT_SECRET_KEY, {
            expiresIn: '1h',
        });

        //! Configuración de la cookie con el token:
        res.cookie('access_token', token, {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 1000 * 60 * 60, // 1 hora
        });

        res.status(200).json({ ok: 'login done' });

    } catch (error) {
        console.error(error);

        if (error.message === 'user_not_found' || error.message === 'invalid_password') {
            return res.status(401).json({ error: 'Nombre o Contraseña incorrecta' });
        }

        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const sessionLogout = (req, res) => {
    try {
        res.clearCookie('userToken');
        res.status(200).json({ msg: 'Logout successful.' });
    } catch (error) {
        res.status(500).json({ errors: { server: { message: error } } });
    }
}

export const getLoginUser = (req, res) => {
    try {
        const { userName, userRole } = req.session.user;
        res.status(200).json({ nombre_usuario: userName, role: userRole });
    } catch (error) {
        res.status(500).json({ errors: { server: { message: error } } });
    }
}
