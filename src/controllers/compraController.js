const db = require('../config/db');

exports.procesarCompra = async (req, res) => {
    try {
        const { idUsuario } = req.body;

         const [carrito] = await db.query(
            "SELECT * FROM Carrito WHERE idUsuario = ?",
            [idUsuario]
        );

        if (carrito.length === 0) {
            return res.status(400).json({ message: "No hay carrito activo" });
        }

        const idCarrito = carrito[0].idCarrito;
        const total = carrito[0].total;

         const [compra] = await db.query(
            "INSERT INTO Compra (idUsuario, total) VALUES (?, ?)",
            [idUsuario, total]
        );

        const idCompra = compra.insertId;

         const [detalles] = await db.query(
            "SELECT * FROM DetalleCarrito WHERE idCarrito = ?",
            [idCarrito]
        );

         for (let item of detalles) {
            await db.query(`
                INSERT INTO DetalleCompra
                (idCompra, idProducto, cantidad, precioUnitario, subtotal)
                VALUES (?, ?, ?, ?, ?)
            `, [
                idCompra,
                item.idProducto,
                item.cantidad,
                item.subtotal / item.cantidad,
                item.subtotal
            ]);
        }

         await db.query("DELETE FROM DetalleCarrito WHERE idCarrito = ?", [idCarrito]);
        await db.query("UPDATE Carrito SET total = 0 WHERE idCarrito = ?", [idCarrito]);

        res.json({ message: "Compra realizada correctamente" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al procesar compra" });
    }
};


 exports.verComprasUsuario = async (req, res) => {
    try {
        const { idUsuario } = req.params;

        const [compras] = await db.query(
            "SELECT * FROM Compra WHERE idUsuario = ?",
            [idUsuario]
        );

        res.json(compras);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener compras" });
    }
};


 
exports.verDetalleCompra = async (req, res) => {
    try {
        const { idCompra } = req.params;

        console.log('📄 Obteniendo detalle de compra:', idCompra);

         const [compra] = await db.query(
            "SELECT * FROM Compra WHERE idCompra = ?",
            [idCompra]
        );

        if (compra.length === 0) {
            return res.status(404).json({ message: "Compra no encontrada" });
        }

         const [detalles] = await db.query(`
            SELECT 
                dc.idDetalleCompra,
                dc.idProducto,
                p.nombre,
                dc.cantidad,
                dc.precioUnitario,
                dc.subtotal
            FROM DetalleCompra dc
            JOIN Producto p ON dc.idProducto = p.idProducto
            WHERE dc.idCompra = ?
        `, [idCompra]);

        console.log(`✅ Detalle obtenido: ${detalles.length} productos`);

        res.json({
            compra: compra[0],
            productos: detalles
        });

    } catch (error) {
        console.error('❌ Error al obtener detalle:', error);
        res.status(500).json({ message: "Error al obtener detalle de compra" });
    }
};
