const db = require('../config/db');

 exports.crearPromocion = async (req, res) => {
    const { nombre, descripcion, descuento, codigo, fechaInicio, fechaFin } = req.body;

    try {
        await db.query(`
            INSERT INTO Promocion (nombre, descripcion, descuento, codigo, fechaInicio, fechaFin)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [nombre, descripcion, descuento, codigo, fechaInicio, fechaFin]);

        res.status(201).json({ message: "Promoción creada" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

 exports.obtenerPromocionesActivas = async (req, res) => {
    try {
        console.log('📢 Obteniendo promociones activas...');
        
        const [rows] = await db.query(`
            SELECT * FROM Promocion 
            WHERE fechaFin >= CURDATE() OR fechaFin IS NULL
            ORDER BY fechaInicio DESC
        `);

        console.log(`✅ ${rows.length} promociones encontradas`);
        res.json(rows);
    } catch (error) {
        console.error('❌ Error al obtener promociones:', error);
        res.status(500).json({ message: 'Error al obtener promociones' });
    }
};

 exports.validarCodigo = async (req, res) => {
    try {
        const { codigo } = req.params;

        console.log('🎫 Validando código de promoción:', codigo);

        const [promociones] = await db.query(`
            SELECT * FROM Promocion 
            WHERE codigo = ? 
            AND (fechaFin IS NULL OR fechaFin >= CURDATE())
        `, [codigo]);

        if (promociones.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: 'Código de promoción no válido o expirado' 
            });
        }

        const promocion = promociones[0];

        console.log('✅ Código válido:', promocion.nombre);

        res.json({
            success: true,
            message: 'Código aplicado correctamente',
            promocion: {
                idPromocion: promocion.idPromocion,
                nombre: promocion.nombre,
                descripcion: promocion.descripcion,
                descuento: promocion.descuento,
                codigo: promocion.codigo,
            }
        });

    } catch (error) {
        console.error('❌ Error al validar código:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error al validar código de promoción' 
        });
    }
};