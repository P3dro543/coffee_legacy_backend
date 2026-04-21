const db = require('../config/db');

exports.obtenerAuditoria = async (req, res) => {
    try {
        const { idUsuario, accion, limit = 100 } = req.query;

        let sql = `
            SELECT 
                a.idAuditoria,
                a.idUsuario,
                u.nombre as nombreUsuario,
                u.correo,
                a.accion,
                a.entidad,
                a.idEntidad,
                a.ipAddress,
                a.fechaHora
            FROM AuditoriaAcciones a
            LEFT JOIN Usuario u ON a.idUsuario = u.idUsuario
            WHERE 1=1
        `;
        const params = [];

        if (idUsuario) {
            sql += ' AND a.idUsuario = ?';
            params.push(idUsuario);
        }

        if (accion) {
            sql += ' AND a.accion = ?';
            params.push(accion);
        }

        sql += ' ORDER BY a.fechaHora DESC LIMIT ?';
        params.push(parseInt(limit));

        const [registros] = await db.query(sql, params);

        res.json({
            success: true,
            total: registros.length,
            registros: registros
        });

    } catch (error) {
        console.error('Error al obtener auditoría:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al obtener auditoría' 
        });
    }
};