const express = require('express');
const router = express.Router();
const compraController = require('../controllers/compraController');
const auditLogger = require('../middlewares/auditLogger');  

router.post('/', 
    auditLogger('PROCESAR_COMPRA', 'Compra'),
    compraController.procesarCompra
);


router.get('/usuario/:idUsuario', compraController.verComprasUsuario);


router.get('/:idCompra', compraController.verDetalleCompra);   

module.exports = router;