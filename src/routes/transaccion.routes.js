const express = require('express');
const router = express.Router();
const transaccionController = require('../controllers/transaccionController');
const auditLogger = require('../middlewares/auditLogger');

// Procesar pago con tarjeta
router.post(
    '/pagar/tarjeta/:idUsuario',
    auditLogger('PAGO_TARJETA', 'Transaccion'),
    transaccionController.procesarPagoTarjeta
);

// Procesar pago con SINPE
router.post(
    '/pagar/sinpe/:idUsuario',
    auditLogger('PAGO_SINPE', 'Transaccion'),
    transaccionController.procesarPagoSinpe
);

// Obtener historial de transacciones
router.get(
    '/historial/:idUsuario',
    transaccionController.obtenerHistorialTransacciones
);

// Obtener detalle de transacción
router.get(
    '/detalle/:idTransaccion',
    transaccionController.obtenerDetalleTransaccion
);

// Obtener estadísticas
router.get(
    '/estadisticas/:idUsuario',
    transaccionController.obtenerEstadisticas
);

// Reembolsar transacción
router.post(
    '/reembolsar/:idTransaccion',
    auditLogger('REEMBOLSO', 'Transaccion'),
    transaccionController.reembolsarTransaccion
);

module.exports = router;