const express = require('express');
const router = express.Router();
const twoFactorController = require('../controllers/twoFactorController');
const auditLogger = require('../middlewares/auditLogger');

// Generar QR para activar 2FA
router.get('/generate-qr/:idUsuario', 
    auditLogger('GENERAR_QR_2FA', 'Usuario'),
    twoFactorController.generarQR
);

// Activar 2FA (verificar código y guardar)
router.post('/activate/:idUsuario', 
    auditLogger('ACTIVAR_2FA', 'Usuario'),
    twoFactorController.activar2FA
);

// Desactivar 2FA
router.post('/deactivate/:idUsuario', 
    auditLogger('DESACTIVAR_2FA', 'Usuario'),
    twoFactorController.desactivar2FA
);

// Verificar código 2FA en login
router.post('/verify', 
    auditLogger('VERIFICAR_2FA', 'Usuario'),
    twoFactorController.verificarCodigo2FA
);

// Obtener estado de 2FA
router.get('/status/:idUsuario', 
    twoFactorController.obtenerEstado2FA
);

module.exports = router;