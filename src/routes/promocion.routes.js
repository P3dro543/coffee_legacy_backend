const express = require('express');
const router = express.Router();
const promocionController = require('../controllers/promocionController');
const auditLogger = require('../middlewares/auditLogger');

router.post('/', promocionController.crearPromocion);
router.get('/activas', promocionController.obtenerPromocionesActivas);
router.get('/validar/:codigo', 
    auditLogger('VALIDAR_PROMOCION', 'Promocion'),
    promocionController.validarCodigo
);

module.exports = router;