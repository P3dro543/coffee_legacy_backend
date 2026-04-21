const db = require('../config/db');
const paypalClient = require('../config/paypalConfig').client;
const paypal = require('@paypal/checkout-server-sdk');

// ========================================
// CREAR ORDEN DE PAYPAL
// ========================================
exports.crearOrdenPayPal = async (req, res) => {
    try {
        const { monto, idCompra } = req.body;

        console.log(`💰 Creando orden PayPal - Monto: ₡${monto}`);

        const tipoCambio = 520; 
        const montoUSD = (monto / tipoCambio).toFixed(2);

        console.log(`💵 Monto en USD: $${montoUSD}`);

        // Crear request de orden
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                reference_id: `COMPRA_${idCompra}`,
                description: `Compra #${idCompra} - Romero Café`,
                amount: {
                    currency_code: 'USD',
                    value: montoUSD,
                    breakdown: {
                        item_total: {
                            currency_code: 'USD',
                            value: montoUSD
                        }
                    }
                }
            }],
            // SECCIÓN ACTUALIZADA PARA FLUTTER
            application_context: {
                brand_name: 'Romero Café Legacy',
                landing_page: 'BILLING',
                user_action: 'PAY_NOW',
                // URLs de retorno - Flutter detectará estos patrones
                return_url: 'https://example.com/paypal/success',
                cancel_url: 'https://example.com/paypal/cancel'
            }
        });

        // Ejecutar request
        const order = await paypalClient().execute(request);

        console.log('✅ Orden PayPal creada:', order.result.id);

        // Obtener enlace de aprobación
        const approvalUrl = order.result.links.find(link => link.rel === 'approve').href;

        res.json({
            success: true,
            orderId: order.result.id,
            approvalUrl: approvalUrl,
            montoUSD: montoUSD
        });

    } catch (error) {
        console.error('❌ Error al crear orden PayPal:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear orden de PayPal',
            error: error.message
        });
    }
};

// ========================================
// CAPTURAR PAGO DE PAYPAL
// ========================================
exports.capturarPagoPayPal = async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        const { idUsuario } = req.params;
        const { orderId, idCompra, paypalEmail } = req.body;

        console.log(`💳 Capturando pago PayPal - Orden: ${orderId}`);

        await connection.beginTransaction();

        // 1. Capturar el pago en PayPal
        const request = new paypal.orders.OrdersCaptureRequest(orderId);
        request.requestBody({});

        const capture = await paypalClient().execute(request);

        console.log('📊 Respuesta de PayPal:', JSON.stringify(capture.result, null, 2));

        // Verificar estado
        if (capture.result.status !== 'COMPLETED') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Pago no completado. Estado: ${capture.result.status}`
            });
        }

        // 2. Obtener datos de la captura
        const captureDetails = capture.result.purchase_units[0].payments.captures[0];
        const montoUSD = parseFloat(captureDetails.amount.value);
        const tipoCambio = 520;
        const montoCRC = montoUSD * tipoCambio;

        const payerId = capture.result.payer.payer_id;
        const payerEmail = capture.result.payer.email_address;
        const captureId = captureDetails.id;

        console.log(`✅ Pago capturado: $${montoUSD} USD (₡${montoCRC} CRC)`);

        // 3. Obtener o crear método PayPal del usuario
        let [metodoPayPal] = await connection.query(
            "SELECT * FROM MetodoPayPal WHERE idUsuario = ? AND paypalEmail = ? LIMIT 1",
            [idUsuario, paypalEmail]
        );

        let idMetodoPayPal;

        if (metodoPayPal.length === 0) {
            // Crear nuevo método PayPal
            const [resultPayPal] = await connection.query(`
                INSERT INTO MetodoPayPal (idUsuario, paypalEmail, nombreCompleto)
                VALUES (?, ?, ?)
            `, [idUsuario, paypalEmail, capture.result.payer.name.given_name + ' ' + capture.result.payer.name.surname]);

            idMetodoPayPal = resultPayPal.insertId;
        } else {
            idMetodoPayPal = metodoPayPal[0].idPayPal;
        }

        // 4. Obtener IP del cliente
        const ipAddress = req.headers['x-forwarded-for'] || 
                         req.connection.remoteAddress || 
                         req.socket.remoteAddress;

        // 5. Registrar transacción
        const detalles = {
            paypalOrderId: orderId,
            paypalCaptureId: captureId,
            paypalPayerId: payerId,
            paypalEmail: payerEmail,
            montoUSD: montoUSD,
            montoCRC: montoCRC,
            tipoCambio: tipoCambio
        };

        const [resultTransaccion] = await connection.query(`
            INSERT INTO Transaccion 
            (idUsuario, idCompra, metodoPago, idMetodoPago, tipoMetodoPago,
             monto, estado, codigoAutorizacion, detalles, ipAddress,
             paypalOrderId, paypalCaptureId, paypalPayerId)
            VALUES (?, ?, 'PayPal', ?, 'PayPal', ?, 'Aprobada', ?, ?, ?, ?, ?, ?)
        `, [
            idUsuario,
            idCompra,
            idMetodoPayPal,
            montoCRC,
            captureId,
            JSON.stringify(detalles),
            ipAddress,
            orderId,
            captureId,
            payerId
        ]);

        const idTransaccion = resultTransaccion.insertId;

        // 6. Actualizar la compra
        await connection.query(`
            UPDATE Compra 
            SET idTransaccion = ?, estadoPago = 'Pagado'
            WHERE idCompra = ?
        `, [idTransaccion, idCompra]);

        await connection.commit();

        console.log(`✅ Transacción registrada: ${idTransaccion}`);

        res.json({
            success: true,
            message: 'Pago procesado exitosamente',
            data: {
                idTransaccion: idTransaccion,
                codigoAutorizacion: captureId,
                estado: 'Aprobada',
                monto: montoCRC,
                montoUSD: montoUSD,
                metodoPago: 'PayPal',
                paypalOrderId: orderId
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('❌ Error al capturar pago PayPal:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar el pago de PayPal',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

// ========================================
// OBTENER MÉTODOS PAYPAL DEL USUARIO
// ========================================
exports.obtenerMetodosPayPal = async (req, res) => {
    try {
        const { idUsuario } = req.params;

        const [metodos] = await db.query(`
            SELECT * FROM MetodoPayPal 
            WHERE idUsuario = ? AND activo = TRUE
        `, [idUsuario]);

        res.json({
            success: true,
            data: metodos
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener métodos PayPal'
        });
    }
};

// ========================================
// OBTENER DETALLES DE ORDEN PAYPAL
// ========================================
exports.obtenerDetallesOrden = async (req, res) => {
    try {
        const { orderId } = req.params;

        const request = new paypal.orders.OrdersGetRequest(orderId);
        const order = await paypalClient().execute(request);

        res.json({
            success: true,
            data: order.result
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener detalles de orden'
        });
    }
};