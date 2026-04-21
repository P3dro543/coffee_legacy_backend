const express = require('express');
const router = express.Router();
const paypalController = require('../controllers/paypalController');
const auditLogger = require('../middlewares/auditLogger');

// Crear orden de PayPal
router.post(
    '/crear-orden',
    paypalController.crearOrdenPayPal
);

// Capturar pago de PayPal
router.post(
    '/capturar-pago/:idUsuario',
    auditLogger('PAGO_PAYPAL', 'Transaccion'),
    paypalController.capturarPagoPayPal
);

// Obtener métodos PayPal del usuario
router.get(
    '/metodos/:idUsuario',
    paypalController.obtenerMetodosPayPal
);

// Obtener detalles de orden
router.get(
    '/orden/:orderId',
    paypalController.obtenerDetallesOrden
);

module.exports = router;