const db = require('../config/db');

// Consultar identidad en el TSE simulado
exports.consultarIdentidad = async (req, res) => {
    try {
        const { numeroIdentificacion } = req.params;

        console.log(`🔍 Consultando identidad: ${numeroIdentificacion}`);

        // Validar formato básico
        if (!numeroIdentificacion || numeroIdentificacion.trim().length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Número de identificación inválido'
            });
        }

        // Simular latencia de un web service real (200-500ms)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 200));

        // Consultar en la base de datos simulada del TSE
        const [personas] = await db.query(`
            SELECT 
                numeroIdentificacion,
                CONCAT(nombre, ' ', apellido1, ' ', IFNULL(apellido2, '')) AS nombreCompleto,
                nombre,
                apellido1,
                apellido2,
                tipoIdentificacion,
                nacionalidad,
                fechaNacimiento
            FROM TSE_Simulado
            WHERE numeroIdentificacion = ?
        `, [numeroIdentificacion.trim()]);

        // Registrar la consulta en auditoría
        const ipAddress = req.headers['x-forwarded-for'] || 
                         req.connection.remoteAddress || 
                         req.socket.remoteAddress;
        
        await db.query(`
            INSERT INTO ConsultasIdentidad 
            (numeroIdentificacion, encontrado, datosRetornados, ipConsulta)
            VALUES (?, ?, ?, ?)
        `, [
            numeroIdentificacion.trim(),
            personas.length > 0,
            personas.length > 0 ? JSON.stringify(personas[0]) : null,
            ipAddress
        ]);

        if (personas.length === 0) {
            console.log('⚠️ Persona NO encontrada en TSE');
            return res.json({
                success: true,
                encontrado: false,
                message: 'Número de identificación no encontrado. Por favor ingrese los datos manualmente.'
            });
        }

        console.log('✅ Persona encontrada:', personas[0].nombreCompleto);

        res.json({
            success: true,
            encontrado: true,
            data: {
                numeroIdentificacion: personas[0].numeroIdentificacion,
                nombreCompleto: personas[0].nombreCompleto,
                nombre: personas[0].nombre,
                apellido1: personas[0].apellido1,
                apellido2: personas[0].apellido2,
                tipoIdentificacion: personas[0].tipoIdentificacion,
                nacionalidad: personas[0].nacionalidad,
                fechaNacimiento: personas[0].fechaNacimiento
            },
            message: 'Datos obtenidos exitosamente del TSE'
        });

    } catch (error) {
        console.error('❌ Error al consultar identidad:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error al consultar el servicio de identidad',
            error: error.message  // ← Temporal para debugging
        });
    }
};

// Obtener estadísticas de consultas
exports.obtenerEstadisticas = async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as totalConsultas,
                SUM(CASE WHEN encontrado = TRUE THEN 1 ELSE 0 END) as consultasExitosas,
                SUM(CASE WHEN encontrado = FALSE THEN 1 ELSE 0 END) as consultasFallidas,
                DATE(fechaConsulta) as fecha
            FROM ConsultasIdentidad
            WHERE fechaConsulta >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(fechaConsulta)
            ORDER BY fecha DESC
        `);

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas'
        });
    }
};

// Listar consultas recientes
exports.listarConsultas = async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const [consultas] = await db.query(`
            SELECT 
                idConsulta,
                numeroIdentificacion,
                encontrado,
                datosRetornados,
                ipConsulta,
                fechaConsulta
            FROM ConsultasIdentidad
            ORDER BY fechaConsulta DESC
            LIMIT ?
        `, [parseInt(limit)]);

        res.json({
            success: true,
            data: consultas
        });

    } catch (error) {
        console.error('❌ Error al listar consultas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al listar consultas'
        });
    }
};