require('dotenv').config();
const express = require('express');
const cors = require('cors');
const os = require('os'); // Para obtener IP automáticamente

const authRoutes = require('./src/routes/auth.routes');
const carritoRoutes = require('./src/routes/carrito.routes');
const compraRoutes = require('./src/routes/compra.routes');
const productoRoutes = require('./src/routes/producto.routes');
const origenRoutes = require('./src/routes/origen.routes');
const proyectoRoutes = require('./src/routes/proyecto.routes');
const promocionesRoutes = require('./src/routes/promocion.routes');
const auditoriaRoutes = require('./src/routes/auditoria.routes');
const twoFactorRoutes = require('./src/routes/twoFactor.routes');
const ubicacionRoutes = require('./src/routes/ubicacion.routes');
const identidadRoutes = require('./src/routes/identidad.routes');
const metodoPagoRoutes = require('./src/routes/metodoPago.routes');
const transaccionRoutes = require('./src/routes/transaccion.routes');
const paypalRoutes = require('./src/routes/paypal.routes');
const tipoCambioRoutes = require("./src/routes/tipoCambio.routes");

const app = express();

// ========================================
// CONFIGURACIÓN CORS (PERMITE ACCESO DESDE CELULAR)
// ========================================
app.use(cors({
    origin: '*', // Permite todos los orígenes (desarrollo)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Logger de requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// ========================================
// RUTAS
// ========================================
app.use("/api/tipo-cambio", tipoCambioRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/carrito', carritoRoutes);
app.use('/api/compra', compraRoutes);
app.use('/api/producto', productoRoutes);
app.use('/api/origen', origenRoutes);
app.use('/api/proyectos', proyectoRoutes);
app.use('/api/promociones', promocionesRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/ubicacion', ubicacionRoutes);
app.use('/api/identidad', identidadRoutes);
app.use('/api/metodo-pago', metodoPagoRoutes);
app.use('/api/transaccion', transaccionRoutes);
app.use('/api/paypal', paypalRoutes);

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        message: 'API Romero Café funcionando',
        rutas: [
            '/api/auth/register',
            '/api/auth/login',
            '/api/producto',
            '/api/carrito',
            '/api/compra',
            '/api/proyectos',
            '/api/ubicacion',
            '/api/identidad',
            '/api/metodo-pago',
            '/api/transaccion',
            '/api/paypal'
        ]
    });
});

// ========================================
// FUNCIÓN PARA OBTENER IP LOCAL
// ========================================
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Buscar IPv4 que no sea localhost
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// ========================================
// INICIAR SERVIDOR
// ========================================
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Escuchar en todas las interfaces de red

const server = app.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   🎉  SERVIDOR ROMERO CAFÉ INICIADO EXITOSAMENTE  🎉   ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║  Puerto:             ${PORT}                                 ║`);
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║  📍 ACCEDE DESDE:                                      ║');
    console.log('║                                                        ║');
    console.log(`║  💻 PC (Localhost):   http://localhost:${PORT}              ║`);
    console.log(`║  📱 Celular/Red:      http://${localIP}:${PORT}       ║`);
    console.log(`║  🌐 Emulador Android: http://10.0.2.2:${PORT}               ║`);
    console.log('║                                                        ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║  📝 ACTUALIZA Flutter config/api_config.dart:          ║');
    console.log(`║     baseUrl = "http://${localIP}:${PORT}"          ║`);
    console.log('╚════════════════════════════════════════════════════════╝\n');
});

module.exports = app;