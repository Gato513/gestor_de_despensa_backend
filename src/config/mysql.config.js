import { createPool } from 'mysql2/promise';
import { DB_PORT, HOST_NAME, USER_NAME, PASSWORD, DATABASE_NAME } from '../config/dotEnv.config.js';

export const pool = createPool({
    host: HOST_NAME,
    port: DB_PORT,
    user: USER_NAME,
    password: PASSWORD,
    database: DATABASE_NAME
});