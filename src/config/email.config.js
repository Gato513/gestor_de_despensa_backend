import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_SMTP_USER, // Usar variables de entorno
        pass: process.env.EMAIL_SMTP_TOKEN,
    },
});

export const sendPasswordToken = async ({ user, token }) => {
    try {
        //$ Preparar datos para la plantilla
        const options = { ...user, token };

        //$ Ruta robusta para la plantilla
        const templatePath = path.join(__dirname, '../templates/forgot.hbs');
        const templateFile = await fs.readFile(templatePath, 'utf-8');
        const template = handlebars.compile(templateFile);
        const html = template(options);

        //$ Enviar correo
        const info = await transporter.sendMail({
            from: `"Not Reply Proyecto Uno" <${process.env.EMAIL_SMTP_USER}>`, // Usar remitente dinámico
            to: user.email_user,        //% Correo del destinatario
            subject: "Password Reset",  //% Asunto
            text: "Password Reset",     //% Cuerpo de texto simple
            html,                       //% Cuerpo HTML
        });

        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Failed to send email');
    }
};
