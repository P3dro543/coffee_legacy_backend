require('dotenv').config();
const app = require('./app');
const pool = require('./src/config/db');
const cors = require('cors');

app.use(cors());

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Conectado a la base de datos');
        connection.release();
    } catch (error) {
        console.error('Error conectando a la base de datos:', error.message);
    }

    console.log(`Servidor corriendo en el puerto ${PORT}`);
});