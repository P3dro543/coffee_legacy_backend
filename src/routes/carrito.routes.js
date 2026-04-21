const express = require('express');
const router = express.Router();
const carritoController = require('../controllers/carritoController');
const auditLogger = require('../middlewares/auditLogger');

// Agregar producto al carrito
router.post('/', 
    auditLogger('AGREGAR_AL_CARRITO', 'Carrito'),
    carritoController.agregarAlCarrito
);

// Ver carrito del usuario
router.get('/:idUsuario', carritoController.verCarrito);

// Actualizar cantidad de un producto
router.put('/detalle/:idDetalle', 
    auditLogger('ACTUALIZAR_CANTIDAD_CARRITO', 'DetalleCarrito'),
    carritoController.actualizarCantidad
);

// Eliminar producto del carrito
router.delete('/detalle/:idDetalle', 
    auditLogger('ELIMINAR_DEL_CARRITO', 'DetalleCarrito'),
    carritoController.eliminarDelCarrito
);

module.exports = router;