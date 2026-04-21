const express = require('express');
const router = express.Router();
const identidadController = require('../controllers/identidadController');
const auditLogger = require('../middlewares/auditLogger');

// Consultar identidad por número
router.get(
    '/consultar/:numeroIdentificacion',
    auditLogger('CONSULTAR_IDENTIDAD', 'TSE'),
    identidadController.consultarIdentidad
);

// Obtener estadísticas de consultas
router.get('/estadisticas', identidadController.obtenerEstadisticas);

// Listar consultas recientes
router.get('/consultas', identidadController.listarConsultas);

module.exports = router;