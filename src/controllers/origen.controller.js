const db = require('../config/db');

exports.crearOrigen = async (req, res) => {
    try {
        const { region, proceso, tipoGrano } = req.body;

        await db.query(`
            INSERT INTO OrigenCafe (region, proceso, tipoGrano)
            VALUES (?, ?, ?)
        `, [region, proceso, tipoGrano]);

        res.status(201).json({ message: "Origen creado" });

    } catch (error) {
        res.status(500).json({ message: "Error al crear origen" });
    }
};

exports.obtenerOrigenes = async (req, res) => {
    const [rows] = await db.query("SELECT * FROM OrigenCafe");
    res.json(rows);
};

exports.eliminarOrigen = async (req, res) => {
    const { id } = req.params;
    await db.query("DELETE FROM OrigenCafe WHERE idOrigen = ?", [id]);
    res.json({ message: "Origen eliminado" });
};
