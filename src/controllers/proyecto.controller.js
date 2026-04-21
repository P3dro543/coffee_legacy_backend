const db = require('../config/db');

exports.crearProyecto = async (req, res) => {
    const { nombre, descripcion, fechaInicio, fechaFin } = req.body;

    await db.query(`
        INSERT INTO ProyectoMarca (nombre, descripcion, fechaInicio, fechaFin)
        VALUES (?, ?, ?, ?)
    `, [nombre, descripcion, fechaInicio, fechaFin]);

    res.status(201).json({ message: "Proyecto creado" });
};

exports.obtenerProyectos = async (req, res) => {
    const [rows] = await db.query("SELECT * FROM ProyectoMarca");
    res.json(rows);
};
