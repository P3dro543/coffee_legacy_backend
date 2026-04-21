const db = require('../config/db');

const auditLogger = (accion, entidad) => {
    return async (req, res, next) => {
        // Guardar el método json original
        const originalJson = res.json;

        // Sobrescribir res.json para interceptar la respuesta
// Cambia la lógica de extracción para que sea más robusta
res.json = function(data) {
    // 1. Validar que data existe antes de leer propiedades
    const isSuccess = data && data.success !== false;

    if (isSuccess && res.statusCode < 400) {
        
        // 2. Extraer información con seguridad (usando Optional Chaining)
        // El error suele dar aquí si req.body o req.params son manipulados
        const idUsuario = req.userId || (req.body && req.body.idUsuario) || (req.params && req.params.idUsuario) || null;
        
        // 3. Extraer idEntidad con seguridad
        const idEntidad = data.idCompra || data.idProducto || data.idCarrito || data.idPromocion || data.idConsulta || null;
        
        const ipAddress = req.ip || (req.headers && req.headers['x-forwarded-for']) || (req.connection && req.connection.remoteAddress) || '127.0.0.1';
        const userAgent = req.get ? req.get('user-agent') : '';

        // Registrar en segundo plano
        db.query(`
            INSERT INTO AuditoriaAcciones 
            (idUsuario, accion, entidad, idEntidad, detalles, ipAddress, userAgent)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            idUsuario,
            accion,
            entidad,
            idEntidad,
            JSON.stringify({
                body: req.body || {},
                params: req.params || {},
                query: req.query || {}
            }),
            ipAddress,
            userAgent
        ]).then(() => {
            console.log(`📝 Auditoría: ${accion} en ${entidad} por usuario ${idUsuario || 'anónimo'}`);
        }).catch(err => {
            console.error('❌ Error en auditoría:', err.message);
        });
    }

    // 4. IMPORTANTE: Llamar al json original con el contexto correcto
    return originalJson.call(this, data);
};

        next();
    };
};

module.exports = auditLogger;