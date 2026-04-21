const db = require('../config/db');
const { generarCodigoAutorizacion } = require('../utils/tarjetaValidator');

// ========================================
// PROCESAR PAGO CON TARJETA
// ========================================
exports.procesarPagoTarjeta = async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        const { idUsuario } = req.params;
        const {
            idCompra,
            idTarjeta,
            monto,
            cvv  // Se requiere CVV para confirmar el pago
        } = req.body;

        console.log(`💳 Procesando pago con tarjeta - Usuario: ${idUsuario}, Monto: ₡${monto}`);

        await connection.beginTransaction();

        // 1. Obtener información de la tarjeta
        const [tarjetas] = await connection.query(`
            SELECT 
                t.*,
                c.saldo,
                c.limiteCredito,
                c.creditoUtilizado,
                c.idCuenta
            FROM TarjetaPago t
            JOIN CuentaBanco c ON t.idCuenta = c.idCuenta
            WHERE t.idTarjeta = ? AND t.idUsuario = ? AND t.activa = TRUE
        `, [idTarjeta, idUsuario]);

        if (tarjetas.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Tarjeta no encontrada o inactiva'
            });
        }

        const tarjeta = tarjetas[0];

        // 2. Validar CVV contra la tarjeta de prueba (CORREGIDO: Usando RIGHT y numeroTarjeta)
        const [tarjetaPrueba] = await connection.query(`
            SELECT * FROM TarjetasPrueba 
            WHERE RIGHT(numeroTarjeta, 4) = ? AND cvv = ? AND activa = TRUE
        `, [tarjeta.ultimos4Digitos, cvv]);

        if (tarjetaPrueba.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'CVV incorrecto'
            });
        }

        // 3. Validar fecha de vencimiento
        const hoy = new Date();
        const anioActual = hoy.getFullYear();
        const mesActual = hoy.getMonth() + 1;

        if (tarjeta.anioVencimiento < anioActual || 
            (tarjeta.anioVencimiento === anioActual && tarjeta.mesVencimiento < mesActual)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Tarjeta vencida'
            });
        }

        // 4. Validar fondos según tipo de tarjeta
        let estado = 'Aprobada';
        let motivoRechazo = null;

        if (tarjeta.tipoTarjeta === 'Debito') {
            // Para débito, verificar saldo
            if (tarjeta.saldo < monto) {
                estado = 'Rechazada';
                motivoRechazo = 'Saldo insuficiente';
                
                await connection.rollback();
                
                return res.status(400).json({
                    success: false,
                    message: 'Saldo insuficiente en tarjeta de débito',
                    saldoDisponible: tarjeta.saldo,
                    montoRequerido: monto
                });
            }

            // Descontar del saldo
            await connection.query(`
                UPDATE CuentaBanco 
                SET saldo = saldo - ?
                WHERE idCuenta = ?
            `, [monto, tarjeta.idCuenta]);

            console.log(`✅ Débito: Descontado ₡${monto} de saldo`);

        } else if (tarjeta.tipoTarjeta === 'Credito') {
            // Para crédito, verificar límite disponible
            const creditoDisponible = tarjeta.limiteCredito - tarjeta.creditoUtilizado;
            
            if (creditoDisponible < monto) {
                estado = 'Rechazada';
                motivoRechazo = 'Límite de crédito insuficiente';
                
                await connection.rollback();
                
                return res.status(400).json({
                    success: false,
                    message: 'Límite de crédito insuficiente',
                    creditoDisponible: creditoDisponible,
                    montoRequerido: monto
                });
            }

            // Incrementar crédito utilizado
            await connection.query(`
                UPDATE CuentaBanco 
                SET creditoUtilizado = creditoUtilizado + ?
                WHERE idCuenta = ?
            `, [monto, tarjeta.idCuenta]);

            console.log(`✅ Crédito: Incrementado crédito utilizado en ₡${monto}`);
        }

        // 5. Generar código de autorización
        const codigoAutorizacion = generarCodigoAutorizacion();

        // 6. Obtener IP del cliente
        const ipAddress = req.headers['x-forwarded-for'] || 
                         req.connection.remoteAddress || 
                         req.socket.remoteAddress;

        // 7. Registrar transacción
        const detalles = {
            marcaTarjeta: tarjeta.marcaTarjeta,
            ultimos4Digitos: tarjeta.ultimos4Digitos,
            tipoTarjeta: tarjeta.tipoTarjeta,
            nombreTitular: tarjeta.nombreTitular
        };

        const [resultTransaccion] = await connection.query(`
            INSERT INTO Transaccion 
            (idUsuario, idCompra, idCuenta, metodoPago, idMetodoPago, tipoMetodoPago,
             monto, estado, codigoAutorizacion, motivoRechazo, detalles, ipAddress)
            VALUES (?, ?, ?, 'Tarjeta', ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            idUsuario,
            idCompra,
            tarjeta.idCuenta,
            idTarjeta,
            'Tarjeta',
            monto,
            estado,
            codigoAutorizacion,
            motivoRechazo,
            JSON.stringify(detalles),
            ipAddress
        ]);

        const idTransaccion = resultTransaccion.insertId;

        // 8. Actualizar la compra con el ID de transacción
        await connection.query(`
            UPDATE Compra 
            SET idTransaccion = ?, estadoPago = 'Pagado'
            WHERE idCompra = ?
        `, [idTransaccion, idCompra]);

        await connection.commit();

        console.log(`✅ Pago procesado exitosamente - Transacción: ${idTransaccion}`);

        res.json({
            success: true,
            message: 'Pago procesado exitosamente',
            data: {
                idTransaccion: idTransaccion,
                codigoAutorizacion: codigoAutorizacion,
                estado: estado,
                monto: monto,
                metodoPago: 'Tarjeta',
                marcaTarjeta: tarjeta.marcaTarjeta,
                ultimos4Digitos: tarjeta.ultimos4Digitos
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error al procesar pago con tarjeta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar el pago'
        });
    } finally {
        connection.release();
    }
};

// ========================================
// PROCESAR PAGO CON SINPE
// ========================================
exports.procesarPagoSinpe = async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        const { idUsuario } = req.params;
        const {
            idCompra,
            telefono,
            monto
        } = req.body;

        console.log(`📱 Procesando pago SINPE - Usuario: ${idUsuario}, Monto: ₡${monto}`);

        await connection.beginTransaction();

        // 1. Buscar método SINPE del usuario
        const [sinpe] = await connection.query(`
            SELECT 
                s.*,
                c.saldo,
                c.idCuenta
            FROM MetodoSinpe s
            JOIN CuentaBanco c ON s.idCuenta = c.idCuenta
            WHERE s.telefono = ? AND s.idUsuario = ? AND s.activo = TRUE
        `, [telefono, idUsuario]);

        if (sinpe.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Método SINPE no encontrado. Por favor regístralo primero.'
            });
        }

        const metodoSinpe = sinpe[0];

        // 2. Verificar saldo (SINPE siempre usa saldo de cuenta)
        if (metodoSinpe.saldo < monto) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Saldo insuficiente para pago SINPE',
                saldoDisponible: metodoSinpe.saldo,
                montoRequerido: monto
            });
        }

        // 3. Descontar del saldo
        await connection.query(`
            UPDATE CuentaBanco 
            SET saldo = saldo - ?
            WHERE idCuenta = ?
        `, [monto, metodoSinpe.idCuenta]);

        console.log(`✅ SINPE: Descontado ₡${monto} de cuenta`);

        // 4. Generar código de autorización
        const codigoAutorizacion = generarCodigoAutorizacion();

        // 5. Obtener IP del cliente
        const ipAddress = req.headers['x-forwarded-for'] || 
                         req.connection.remoteAddress || 
                         req.socket.remoteAddress;

        // 6. Registrar transacción
        const detalles = {
            telefono: metodoSinpe.telefono,
            nombreCompleto: metodoSinpe.nombreCompleto
        };

        const [resultTransaccion] = await connection.query(`
            INSERT INTO Transaccion 
            (idUsuario, idCompra, idCuenta, metodoPago, idMetodoPago, tipoMetodoPago,
             monto, estado, codigoAutorizacion, detalles, ipAddress)
            VALUES (?, ?, ?, 'SINPE', ?, ?, ?, 'Aprobada', ?, ?, ?)
        `, [
            idUsuario,
            idCompra,
            metodoSinpe.idCuenta,
            metodoSinpe.idSinpe,
            'SINPE',
            monto,
            codigoAutorizacion,
            JSON.stringify(detalles),
            ipAddress
        ]);

        const idTransaccion = resultTransaccion.insertId;

        // 7. Actualizar la compra
        await connection.query(`
            UPDATE Compra 
            SET idTransaccion = ?, estadoPago = 'Pagado'
            WHERE idCompra = ?
        `, [idTransaccion, idCompra]);

        await connection.commit();

        console.log(`✅ Pago SINPE procesado exitosamente - Transacción: ${idTransaccion}`);

        res.json({
            success: true,
            message: 'Pago SINPE procesado exitosamente',
            data: {
                idTransaccion: idTransaccion,
                codigoAutorizacion: codigoAutorizacion,
                estado: 'Aprobada',
                monto: monto,
                metodoPago: 'SINPE',
                telefono: metodoSinpe.telefono
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error al procesar pago SINPE:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar el pago'
        });
    } finally {
        connection.release();
    }
};

// ========================================
// OBTENER HISTORIAL DE TRANSACCIONES
// ========================================
exports.obtenerHistorialTransacciones = async (req, res) => {
    try {
        const { idUsuario } = req.params;
        const { limit = 50, estado } = req.query;

        console.log(`📜 Obteniendo historial de transacciones - Usuario: ${idUsuario}`);

        let query = `
            SELECT 
                t.idTransaccion,
                t.metodoPago,
                t.monto,
                t.estado,
                t.codigoAutorizacion,
                t.motivoRechazo,
                t.detalles,
                t.fechaTransaccion,
                c.idCompra,
                c.total as totalCompra
            FROM Transaccion t
            LEFT JOIN Compra c ON t.idCompra = c.idCompra
            WHERE t.idUsuario = ?
        `;

        const params = [idUsuario];

        if (estado) {
            query += ' AND t.estado = ?';
            params.push(estado);
        }

        query += ' ORDER BY t.fechaTransaccion DESC LIMIT ?';
        params.push(parseInt(limit));

        const [transacciones] = await db.query(query, params);

        // Parsear detalles JSON
        transacciones.forEach(t => {
            if (t.detalles) {
                try {
                    t.detalles = JSON.parse(t.detalles);
                } catch (e) {
                    t.detalles = null;
                }
            }
        });

        res.json({
            success: true,
            data: transacciones
        });

    } catch (error) {
        console.error('❌ Error al obtener historial:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener historial de transacciones'
        });
    }
};

// ========================================
// OBTENER DETALLE DE TRANSACCIÓN
// ========================================
exports.obtenerDetalleTransaccion = async (req, res) => {
    try {
        const { idTransaccion } = req.params;

        const [transacciones] = await db.query(`
            SELECT 
                t.*,
                u.nombre as nombreUsuario,
                u.correo as correoUsuario,
                c.idCompra,
                c.total as totalCompra,
                c.fechaCompra,
                cb.numeroCuenta
            FROM Transaccion t
            JOIN Usuario u ON t.idUsuario = u.idUsuario
            LEFT JOIN Compra c ON t.idCompra = c.idCompra
            LEFT JOIN CuentaBanco cb ON t.idCuenta = cb.idCuenta
            WHERE t.idTransaccion = ?
        `, [idTransaccion]);

        if (transacciones.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Transacción no encontrada'
            });
        }

        const transaccion = transacciones[0];

        // Parsear detalles JSON
        if (transaccion.detalles) {
            try {
                transaccion.detalles = JSON.parse(transaccion.detalles);
            } catch (e) {
                transaccion.detalles = null;
            }
        }

        res.json({
            success: true,
            data: transaccion
        });

    } catch (error) {
        console.error('❌ Error al obtener detalle:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener detalle de transacción'
        });
    }
};

// ========================================
// OBTENER ESTADÍSTICAS DE TRANSACCIONES
// ========================================
exports.obtenerEstadisticas = async (req, res) => {
    try {
        const { idUsuario } = req.params;

        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as totalTransacciones,
                SUM(CASE WHEN estado = 'Aprobada' THEN 1 ELSE 0 END) as aprobadas,
                SUM(CASE WHEN estado = 'Rechazada' THEN 1 ELSE 0 END) as rechazadas,
                SUM(CASE WHEN estado = 'Aprobada' THEN monto ELSE 0 END) as totalGastado,
                SUM(CASE WHEN metodoPago = 'Tarjeta' THEN 1 ELSE 0 END) as pagosTarjeta,
                SUM(CASE WHEN metodoPago = 'SINPE' THEN 1 ELSE 0 END) as pagosSinpe,
                AVG(CASE WHEN estado = 'Aprobada' THEN monto ELSE NULL END) as montoPromedio
            FROM Transaccion
            WHERE idUsuario = ?
        `, [idUsuario]);

        res.json({
            success: true,
            data: stats[0]
        });

    } catch (error) {
        console.error('❌ Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas'
        });
    }
};

// ========================================
// REEMBOLSAR TRANSACCIÓN (Opcional)
// ========================================
exports.reembolsarTransaccion = async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        const { idTransaccion } = req.params;

        await connection.beginTransaction();

        // 1. Obtener transacción
        const [transacciones] = await connection.query(
            "SELECT * FROM Transaccion WHERE idTransaccion = ? AND estado = 'Aprobada'",
            [idTransaccion]
        );

        if (transacciones.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Transacción no encontrada o no puede ser reembolsada'
            });
        }

        const transaccion = transacciones[0];

        // 2. Devolver fondos a la cuenta
        await connection.query(`
            UPDATE CuentaBanco 
            SET saldo = saldo + ?,
                creditoUtilizado = GREATEST(0, creditoUtilizado - ?)
            WHERE idCuenta = ?
        `, [transaccion.monto, transaccion.monto, transaccion.idCuenta]);

        // 3. Actualizar estado de transacción
        await connection.query(
            "UPDATE Transaccion SET estado = 'Reembolsada' WHERE idTransaccion = ?",
            [idTransaccion]
        );

        // 4. Actualizar compra
        if (transaccion.idCompra) {
            await connection.query(
                "UPDATE Compra SET estadoPago = 'Reembolsado' WHERE idCompra = ?",
                [transaccion.idCompra]
            );
        }

        await connection.commit();

        console.log(`✅ Transacción ${idTransaccion} reembolsada exitosamente`);

        res.json({
            success: true,
            message: 'Transacción reembolsada exitosamente',
            data: {
                idTransaccion: idTransaccion,
                montoReembolsado: transaccion.monto
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error al reembolsar:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar reembolso'
        });
    } finally {
        connection.release();
    }
};