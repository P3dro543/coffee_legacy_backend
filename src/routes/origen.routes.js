const express = require('express');
const router = express.Router();
const origenController = require('../controllers/origen.controller');

router.post('/', origenController.crearOrigen);
router.get('/', origenController.obtenerOrigenes);
router.delete('/:id', origenController.eliminarOrigen);

module.exports = router;
