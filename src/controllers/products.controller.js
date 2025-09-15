import { pool } from '../config/mysql.config.js'
import { registerAudit } from './auditoria.controller.js';

//$ CRUD Basico:
export const createProduct = async (req, res) => {
    const { codigoBarras, nombreProducto, precioVenta, precioCompra, stockMinimo } = req.body;
    const fechaCreacio = new Date().toISOString().split('T')[0];

    try {
        // Insertar nuevo cliente
        await pool.query(
            `  
                INSERT INTO 
                        Productos (codigo_barras, nombre_producto, precio_venta, precio_compra, stock_disponible, stock_minimo, ultima_actualizacion) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [codigoBarras, nombreProducto, precioVenta, precioCompra, 0, stockMinimo, fechaCreacio]
        );

        const [[{ productId }]] = await pool.query("SELECT MAX(id_producto) AS productId FROM Productos");

        res.status(201).json(
            {
                id_producto: productId,
                nombre_producto: nombreProducto,
                precio_compra: parseInt(precioCompra),
                precio_venta: parseInt(precioVenta),
                stock_disponible: 0
            });

    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getAllProducts = async (req, res) => {
    try {
        const { estado } = req.query; // Obtener el parámetro 'estado' desde la consulta

        let query = `
        SELECT
            p.id_producto,
            p.nombre_producto,
            p.precio_compra,
            p.precio_venta,
            p.stock_disponible,
            p.stock_minimo,
            DATE_FORMAT(p.ultima_actualizacion, '%Y/%m/%d') AS ultima_actualizacion,
            CASE
                WHEN p.stock_disponible IS NULL OR p.stock_minimo IS NULL THEN 'sin datos'
                WHEN p.stock_disponible > p.stock_minimo THEN 'normal'
                ELSE 'bajo'
            END AS have_stock
        FROM
            Productos AS p
        WHERE
            p.is_hidden = false`;

        // Agregar filtros según el parámetro 'estado'
        if (estado === "readyProducts") {
            query += " AND precio_venta > 0 AND stock_disponible > 0";
        }

        query += " ORDER BY p.ultima_actualizacion DESC; "

        const [rows] = await pool.query(query);

        if (rows.length === 0) {
            return res.status(200).json([]);
        }

        const productData = rows.map((
            {
                id_producto,
                nombre_producto,
                precio_compra,
                precio_venta,
                stock_disponible,
                stock_minimo,
                ultima_actualizacion,
                have_stock }
        ) => {

            return {
                id_producto,
                nombre_producto,
                precio_compra: parseInt(precio_compra),
                precio_venta: parseFloat(precio_venta),
                stock_disponible: parseInt(stock_disponible),
                stock_minimo: parseInt(stock_minimo),
                ultima_actualizacion: ultima_actualizacion,
                have_stock
            }
        })

        res.status(200).json(productData);
    } catch (error) {
        console.error("Error executing query:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const checkMinimumStock = async (req, res) => {
    try {

        const [rows] = await pool.query(`
            SELECT
                CASE
                    WHEN COUNT(*) > 0 THEN TRUE
                    ELSE FALSE
                END AS lowStockDanger,
                COUNT(*) AS productQuantityReplenish
            FROM Productos
            WHERE stock_disponible <= stock_minimo;
        `);

        const { lowStockDanger, productQuantityReplenish } = rows[0];

        res.status(200).json({ lowStockDanger, productQuantityReplenish });
    } catch (error) {
        console.error("Error executing query:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const checkMinimumStocks = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                CASE
                    WHEN COUNT(*) > 0 THEN TRUE
                    ELSE FALSE
                END AS lowStockDanger,
                COUNT(*) AS productQuantityReplenish
            FROM Productos
            WHERE stock_disponible <= stock_minimo;
        `);

        const { lowStockDanger, productQuantityReplenish } = rows[0];

        res.status(200).json({ lowStockDanger, productQuantityReplenish });
    } catch (error) {
        console.error("Error executing query:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const getProductById = async (req, res) => {
    const { id } = req.params;

    try {
        const [rows] = await pool.query("SELECT * FROM customers WHERE id_customer = ?", [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const updateProduct = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.session.user;
    const { nombre_producto, precio_compra, precio_venta, stock_minimo, } = req.body;

    try {
        const [rows] = await pool.query(`SELECT nombre_producto, precio_compra, precio_venta, stock_minimo FROM Productos WHERE id_producto = ?`, [id]);
        const previousValues = JSON.stringify(rows[0]);

        const [result] = await pool.query(
            "UPDATE Productos SET nombre_producto = ?, precio_compra = ?, precio_venta = ?, stock_minimo = ? WHERE id_producto = ?",
            [nombre_producto, precio_compra, precio_venta, stock_minimo, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Remito not found' });
        }

        const auditData = {
            userId: userId,
            tableName: 'Productos',
            recordId: id,
            previousValues,
            modifiedValues: JSON.stringify({ nombre_producto, precio_compra, precio_venta, stock_minimo }),
            modificationType: 2
        }

        // Registrar auditoría
        await registerAudit(auditData);

        res.json({ message: 'Remito updated' });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const hideProduct = async (req, res) => {
    const { id } = req.params;
    const { userId } = req.session.user;

    try {
        const [result] = await pool.query(
            "UPDATE Productos SET is_hidden = TRUE WHERE id_producto = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const auditData = {
            userId: userId,
            tableName: 'Productos',
            accessId: 'id_producto',
            recordId: id,
            previousValues: JSON.stringify({ is_hidden: 'is_hidden: FALSE' }),
            modifiedValues: JSON.stringify({ is_hidden: 'is_hidden: TRUE' }),
            modificationType: 3
        }

        await registerAudit(auditData);

        res.json({ message: 'Product hidden successfully' });
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


