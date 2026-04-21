const db = require('../config/db');
const {
    detectarMarcaTarjeta,
    validarFormatoTarjeta,
    validarLuhn,
    validarCVV,
    validarFechaVencimiento,
    validarTelefonoSinpe,
    generarTokenTarjeta,
    enmascararTarjeta
} = require('../utils/tarjetaValidator');

// ========================================
// OBTENER MÉTODOS DE PAGO DEL USUARIO
// ========================================
exports.obtenerMetodosPago = async (req, res) => {
    try {
        const { idUsuario } = req.params;

        console.log(`💳 Obteniendo métodos de pago del usuario ${idUsuario}`);

        // Obtener tarjetas guardadas
        const [tarjetas] = await db.query(`
            SELECT 
                t.idTarjeta,
                t.tipoTarjeta,
                t.marcaTarjeta,
                t.ultimos4Digitos,
                t.nombreTitular,
                t.mesVencimiento,
                t.anioVencimiento,
                t.esPrincipal,
                c.numeroCuenta,
                c.saldo,
                c.limiteCredito,
                c.creditoUtilizado
            FROM TarjetaPago t
            JOIN CuentaBanco c ON t.idCuenta = c.idCuenta
            WHERE t.idUsuario = ? AND t.activa = TRUE
            ORDER BY t.esPrincipal DESC, t.fechaRegistro DESC
        `, [idUsuario]);

        // Obtener métodos SINPE
        const [sinpe] = await db.query(`
            SELECT 
                s.idSinpe,
                s.telefono,
                s.nombreCompleto,
                c.numeroCuenta,
                c.saldo
            FROM MetodoSinpe s
            JOIN CuentaBanco c ON s.idCuenta = c.idCuenta
            WHERE s.idUsuario = ? AND s.activo = TRUE
        `, [idUsuario]);

        res.json({
            success: true,
            data: {
                tarjetas: tarjetas,
                sinpe: sinpe
            }
        });

    } catch (error) {
        console.error('❌ Error al obtener métodos de pago:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener métodos de pago'
        });
    }
};

// ========================================
// VALIDAR Y REGISTRAR TARJETA
// ========================================
exports.registrarTarjeta = async (req, res) => {
    try {
        const { idUsuario } = req.params;
        const {
            numeroTarjeta,
            nombreTitular,
            mesVencimiento,
            anioVencimiento,
            cvv,
            tipoTarjeta  // 'Credito' o 'Debito'
        } = req.body;

        console.log(`💳 Registrando nueva tarjeta para usuario ${idUsuario}`);

        // 1. Validar formato
        const validacionFormato = validarFormatoTarjeta(numeroTarjeta);
        if (!validacionFormato.valido) {
            return res.status(400).json({
                success: false,
                message: validacionFormato.error
            });
        }

        // 2. Validar con algoritmo de Luhn
        if (!validarLuhn(numeroTarjeta)) {
            return res.status(400).json({
                success: false,
                message: 'Número de tarjeta inválido'
            });
        }

        // 3. Detectar marca
        const marcaTarjeta = detectarMarcaTarjeta(numeroTarjeta);
        if (marcaTarjeta === 'Desconocida') {
            return res.status(400).json({
                success: false,
                message: 'Marca de tarjeta no soportada'
            });
        }

        // 4. Validar CVV
        const validacionCVV = validarCVV(cvv, marcaTarjeta);
        if (!validacionCVV.valido) {
            return res.status(400).json({
                success: false,
                message: validacionCVV.error
            });
        }

        // 5. Validar fecha de vencimiento
        const validacionFecha = validarFechaVencimiento(mesVencimiento, anioVencimiento);
        if (!validacionFecha.valido) {
            return res.status(400).json({
                success: false,
                message: validacionFecha.error
            });
        }

        // 6. Verificar que la tarjeta existe en TarjetasPrueba (simulación de validación con banco)
        const [tarjetaValida] = await db.query(`
            SELECT * FROM TarjetasPrueba 
            WHERE numeroTarjeta = ? 
            AND cvv = ? 
            AND mesVencimiento = ? 
            AND anioVencimiento = ?
            AND activa = TRUE
        `, [numeroTarjeta, cvv, mesVencimiento, validacionFecha.anioCompleto]);

        if (tarjetaValida.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Tarjeta no válida o datos incorrectos'
            });
        }

        const tarjetaBanco = tarjetaValida[0];

        // 7. Obtener cuenta del usuario
        const [cuentas] = await db.query(
            "SELECT * FROM CuentaBanco WHERE idUsuario = ? AND activa = TRUE LIMIT 1",
            [idUsuario]
        );

        if (cuentas.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no tiene cuenta bancaria'
            });
        }

        const cuenta = cuentas[0];

        // 8. Verificar si la tarjeta ya está registrada
        const ultimos4 = numeroTarjeta.slice(-4);
        const [existe] = await db.query(`
            SELECT * FROM TarjetaPago 
            WHERE idUsuario = ? AND ultimos4Digitos = ? AND activa = TRUE
        `, [idUsuario, ultimos4]);

        if (existe.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Esta tarjeta ya está registrada'
            });
        }

        // 9. Generar token de tarjeta
        const tokenTarjeta = generarTokenTarjeta(numeroTarjeta, idUsuario);

        // 10. Verificar si es la primera tarjeta (será principal)
        const [tarjetasExistentes] = await db.query(
            "SELECT COUNT(*) as total FROM TarjetaPago WHERE idUsuario = ? AND activa = TRUE",
            [idUsuario]
        );
        const esPrimera = tarjetasExistentes[0].total === 0;

        // 11. Registrar tarjeta
        const [result] = await db.query(`
            INSERT INTO TarjetaPago 
            (idCuenta, idUsuario, tipoTarjeta, marcaTarjeta, ultimos4Digitos, 
             tokenTarjeta, nombreTitular, mesVencimiento, anioVencimiento, esPrincipal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            cuenta.idCuenta,
            idUsuario,
            tipoTarjeta,
            marcaTarjeta,
            ultimos4,
            tokenTarjeta,
            nombreTitular,
            mesVencimiento,
            validacionFecha.anioCompleto,
            esPrimera
        ]);

        console.log('✅ Tarjeta registrada con ID:', result.insertId);

        res.status(201).json({
            success: true,
            message: 'Tarjeta registrada exitosamente',
            data: {
                idTarjeta: result.insertId,
                marcaTarjeta: marcaTarjeta,
                ultimos4Digitos: ultimos4,
                tipoTarjeta: tipoTarjeta,
                enmascarado: enmascararTarjeta(numeroTarjeta)
            }
        });

    } catch (error) {
        console.error('❌ Error al registrar tarjeta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar tarjeta'
        });
    }
};

// ========================================
// REGISTRAR MÉTODO SINPE
// ========================================
exports.registrarSinpe = async (req, res) => {
    try {
        const { idUsuario } = req.params;
        const { telefono, nombreCompleto } = req.body;

        console.log(`📱 Registrando SINPE para usuario ${idUsuario}`);

        // 1. Validar teléfono
        const validacion = validarTelefonoSinpe(telefono);
        if (!validacion.valido) {
            return res.status(400).json({
                success: false,
                message: validacion.error
            });
        }

        // 2. Obtener cuenta del usuario
        const [cuentas] = await db.query(
            "SELECT * FROM CuentaBanco WHERE idUsuario = ? AND activa = TRUE LIMIT 1",
            [idUsuario]
        );

        if (cuentas.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no tiene cuenta bancaria'
            });
        }

        const cuenta = cuentas[0];

        // 3. Verificar si ya existe
        const [existe] = await db.query(
            "SELECT * FROM MetodoSinpe WHERE telefono = ? AND activo = TRUE",
            [validacion.numeroFormateado]
        );

        if (existe.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Este número ya está registrado para SINPE'
            });
        }

        // 4. Registrar SINPE
        const [result] = await db.query(`
            INSERT INTO MetodoSinpe (idUsuario, idCuenta, telefono, nombreCompleto)
            VALUES (?, ?, ?, ?)
        `, [idUsuario, cuenta.idCuenta, validacion.numeroFormateado, nombreCompleto]);

        console.log('✅ SINPE registrado con ID:', result.insertId);

        res.status(201).json({
            success: true,
            message: 'SINPE registrado exitosamente',
            data: {
                idSinpe: result.insertId,
                telefono: validacion.numeroFormateado
            }
        });

    } catch (error) {
        console.error('❌ Error al registrar SINPE:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar SINPE'
        });
    }
};

// ========================================
// ELIMINAR TARJETA
// ========================================
exports.eliminarTarjeta = async (req, res) => {
    try {
        const { idTarjeta } = req.params;
        const { idUsuario } = req.body;

        console.log(`🗑️ Eliminando tarjeta ${idTarjeta}`);

        // Verificar que la tarjeta pertenece al usuario
        const [tarjeta] = await db.query(
            "SELECT * FROM TarjetaPago WHERE idTarjeta = ? AND idUsuario = ?",
            [idTarjeta, idUsuario]
        );

        if (tarjeta.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarjeta no encontrada'
            });
        }

        // Marcar como inactiva (no eliminar físicamente)
        await db.query(
            "UPDATE TarjetaPago SET activa = FALSE WHERE idTarjeta = ?",
            [idTarjeta]
        );

        res.json({
            success: true,
            message: 'Tarjeta eliminada exitosamente'
        });

    } catch (error) {
        console.error('❌ Error al eliminar tarjeta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar tarjeta'
        });
    }
};

// ========================================
// ESTABLECER TARJETA PRINCIPAL
// ========================================
exports.establecerTarjetaPrincipal = async (req, res) => {
    try {
        const { idTarjeta } = req.params;
        const { idUsuario } = req.body;

        // Quitar principal de todas las tarjetas del usuario
        await db.query(
            "UPDATE TarjetaPago SET esPrincipal = FALSE WHERE idUsuario = ?",
            [idUsuario]
        );

        // Establecer esta como principal
        await db.query(
            "UPDATE TarjetaPago SET esPrincipal = TRUE WHERE idTarjeta = ? AND idUsuario = ?",
            [idTarjeta, idUsuario]
        );

        res.json({
            success: true,
            message: 'Tarjeta principal actualizada'
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar tarjeta principal'
        });
    }
};