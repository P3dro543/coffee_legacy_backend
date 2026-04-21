const express = require('express');
const router = express.Router();
const ubicacionController = require('../controllers/ubicacionController');

// Obtener todos los países
router.get('/paises', ubicacionController.obtenerPaises);

// Obtener provincias de un país
router.get('/provincias/:idPais', ubicacionController.obtenerProvincias);

// Obtener cantones de una provincia
router.get('/cantones/:idProvincia', ubicacionController.obtenerCantones);

// Obtener distritos de un cantón
router.get('/distritos/:idCanton', ubicacionController.obtenerDistritos);

// Obtener ubicación completa de un distrito
router.get('/completa/:idDistrito', ubicacionController.obtenerUbicacionCompleta);

module.exports = router;