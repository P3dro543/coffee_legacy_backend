const db = require('../config/db');

 exports.crearProducto = async (req, res) => {
    try {
        const { nombre, precio, disponibilidad, imagen, idOrigen } = req.body;

        await db.query(`
            INSERT INTO Producto (nombre, precio, disponibilidad, imagen, idOrigen)
            VALUES (?, ?, ?, ?, ?)
        `, [nombre, precio, disponibilidad, imagen, idOrigen]);

        res.status(201).json({ message: "Producto creado correctamente" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al crear producto" });
    }
};

 exports.obtenerProductos = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, o.region, o.proceso, o.tipoGrano
            FROM Producto p
            JOIN OrigenCafe o ON p.idOrigen = o.idOrigen
        `);

        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener productos" });
    }
};
