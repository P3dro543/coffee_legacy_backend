const express = require('express');
const router = express.Router();
const proyectoController = require('../controllers/proyecto.controller');

router.post('/', proyectoController.crearProyecto);
router.get('/', proyectoController.obtenerProyectos);

module.exports = router;