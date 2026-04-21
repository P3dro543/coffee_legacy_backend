const db = require('../config/db');

// Obtener todos los países
exports.obtenerPaises = async (req, res) => {
    try {
        console.log('🌍 Obteniendo países...');

        const [paises] = await db.query(`
            SELECT idPais, nombre, codigo 
            FROM Pais 
            ORDER BY nombre
        `);

        console.log(`✅ ${paises.length} países encontrados`);

        res.json({
            success: true,
            data: paises
        });

    } catch (error) {
        console.error('❌ Error al obtener países:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener países'
        });
    }
};

// Obtener provincias de un país
exports.obtenerProvincias = async (req, res) => {
    try {
        const { idPais } = req.params;

        console.log(`📍 Obteniendo provincias del país ${idPais}...`);

        const [provincias] = await db.query(`
            SELECT idProvincia, nombre 
            FROM Provincia 
            WHERE idPais = ? 
            ORDER BY nombre
        `, [idPais]);

        console.log(`✅ ${provincias.length} provincias encontradas`);

        res.json({
            success: true,
            data: provincias
        });

    } catch (error) {
        console.error('❌ Error al obtener provincias:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener provincias'
        });
    }
};

// Obtener cantones de una provincia
exports.obtenerCantones = async (req, res) => {
    try {
        const { idProvincia } = req.params;

        console.log(` Obteniendo cantones de la provincia ${idProvincia}...`);

        const [cantones] = await db.query(`
            SELECT idCanton, nombre 
            FROM Canton 
            WHERE idProvincia = ? 
            ORDER BY nombre
        `, [idProvincia]);

        console.log(`✅ ${cantones.length} cantones encontrados`);

        res.json({
            success: true,
            data: cantones
        });

    } catch (error) {
        console.error('❌ Error al obtener cantones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener cantones'
        });
    }
};

// Obtener distritos de un cantón
exports.obtenerDistritos = async (req, res) => {
    try {
        const { idCanton } = req.params;

        console.log(` Obteniendo distritos del cantón ${idCanton}...`);

        const [distritos] = await db.query(`
            SELECT idDistrito, nombre 
            FROM Distrito 
            WHERE idCanton = ? 
            ORDER BY nombre
        `, [idCanton]);

        console.log(`✅ ${distritos.length} distritos encontrados`);

        res.json({
            success: true,
            data: distritos
        });

    } catch (error) {
        console.error('❌ Error al obtener distritos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener distritos'
        });
    }
};

// Obtener ubicación completa de un distrito
exports.obtenerUbicacionCompleta = async (req, res) => {
    try {
        const { idDistrito } = req.params;

        console.log(`📍 Obteniendo ubicación completa del distrito ${idDistrito}...`);

        const [ubicacion] = await db.query(`
            SELECT 
                p.idPais,
                p.nombre AS pais,
                pr.idProvincia,
                pr.nombre AS provincia,
                c.idCanton,
                c.nombre AS canton,
                d.idDistrito,
                d.nombre AS distrito
            FROM Distrito d
            JOIN Canton c ON d.idCanton = c.idCanton
            JOIN Provincia pr ON c.idProvincia = pr.idProvincia
            JOIN Pais p ON pr.idPais = p.idPais
            WHERE d.idDistrito = ?
        `, [idDistrito]);

        if (ubicacion.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Distrito no encontrado'
            });
        }

        console.log('✅ Ubicación encontrada:', ubicacion[0]);

        res.json({
            success: true,
            data: ubicacion[0]
        });

    } catch (error) {
        console.error('❌ Error al obtener ubicación completa:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener ubicación completa'
        });
    }
};