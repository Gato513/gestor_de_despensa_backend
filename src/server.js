import { SERVER_PORT } from './config/dotEnv.config.js';
import { serverOfConfig } from "./config/server.config.js";
import usersSession from './routes/session.routes.js';
import customerRoutes from "./routes/customer.routes.js";
import systemUserRoutes from "./routes/systemUsers.routes.js";
import productRoutes from "./routes/products.routes.js";
import remitoRoutes from "./routes/remitos.routes.js";
import proveedorRoutes from "./routes/proveedor.routes.js";
import transactions from "./routes/transactions.routes.js";
import reportingRoute from "./routes/informes.routes.js";
import registros from "./routes/registros.routes.js";

//! Configuraciones del servidor:
const app = serverOfConfig();

//! Configuraciones de Endpoint:
//? Session Routs:
app.use('/api/session', usersSession);

//? User of System Routs:
app.use('/api/user', systemUserRoutes);

//? Customer Routs:
app.use('/api/customer', customerRoutes);

//? Proveedor Routs:
app.use('/api/proveedor', proveedorRoutes);

//? Products Routs:
app.use('/api/products', productRoutes);

//? Remitos Routs:
app.use('/api/remitos', remitoRoutes);

//? Facturaciones Routs:
app.use('/api/transactions', transactions);

//? Movimiento de caja Routs:
app.use('/api/registros', registros);

//? Informe Routs:
app.use('/api/report', reportingRoute);


//! Connection to the DATABASE and listening PORT:
app.listen(SERVER_PORT, () => {
    console.info(`Escuchando en el puerto: ${SERVER_PORT}`);
});


