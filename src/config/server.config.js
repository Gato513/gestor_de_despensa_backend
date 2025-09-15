//! Import Dependencies
import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";

export const serverOfConfig = () => {
    const app = express();

    //? Data transfer on (URL Encoded and JSON)
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(cookieParser());
    app.use(express.static("public"));

    app.use(morgan("dev"));

    //? Configuración de políticas de CORS
    app.use(
        cors({
            origin: "http://localhost:3000",
            methods: "GET,POST,DELETE,PUT, PATCH",
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true,
        })
    );

    // Manejo de solicitudes OPTIONS (preflight)
    app.options("*", (req, res) => {
        res.sendStatus(204);
    });

    return app;
};
