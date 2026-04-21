const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const auditLogger = require('../middlewares/auditLogger');

router.post(
    '/register',
    auditLogger('REGISTRO_USUARIO', 'Usuario'),
    authController.register
);

router.post(
    '/login',
    auditLogger('LOGIN', 'Usuario'),
    authController.login
);

router.put(
    '/profile/:idUsuario',
    auditLogger('ACTUALIZAR_PERFIL', 'Usuario'),
    authController.updateProfile
);

router.post(
    '/forgot-password',
    auditLogger('SOLICITAR_RECUPERACION', 'Usuario'),
    authController.solicitarRecuperacion
);

router.get(
    '/reset-password/:token',
    authController.verificarTokenRecuperacion
);

router.post(
    '/reset-password',
    auditLogger('RESETEAR_CONTRASENA', 'Usuario'),
    authController.resetearContrasena
);

router.get(
    '/verificar-email/:token',
    authController.verificarEmail
);

module.exports = router;