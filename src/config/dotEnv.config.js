// src/config/dotEnv.config.js
import dotenv from 'dotenv';

dotenv.config();

export const { SERVER_PORT, HOST_NAME, DB_PORT, USER_NAME, PASSWORD, DATABASE_NAME, SALT_ROUNDS, JWT_SECRET_KEY } = process.env;
