const express = require('express');
const router = express.Router();
const metodoPagoController = require('../controllers/metodoPagoController');
const auditLogger = require('../middlewares/auditLogger');

// Obtener métodos de pago del usuario
router.get(
    '/usuario/:idUsuario',
    metodoPagoController.obtenerMetodosPago
);

// Registrar nueva tarjeta
router.post(
    '/tarjeta/:idUsuario',
    auditLogger('REGISTRAR_TARJETA', 'TarjetaPago'),
    metodoPagoController.registrarTarjeta
);

// Registrar SINPE
router.post(
    '/sinpe/:idUsuario',
    auditLogger('REGISTRAR_SINPE', 'MetodoSinpe'),
    metodoPagoController.registrarSinpe
);

// Eliminar tarjeta
router.delete(
    '/tarjeta/:idTarjeta',
    auditLogger('ELIMINAR_TARJETA', 'TarjetaPago'),
    metodoPagoController.eliminarTarjeta
);

// Establecer tarjeta principal
router.put(
    '/tarjeta/:idTarjeta/principal',
    metodoPagoController.establecerTarjetaPrincipal
);

module.exports = router;