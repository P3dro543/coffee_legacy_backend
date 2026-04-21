const db = require('../config/db');

exports.agregarAlCarrito = async (req, res) => {
    try {
        const { idUsuario, idProducto, cantidad } = req.body;

        let [carrito] = await db.query(
            "SELECT * FROM Carrito WHERE idUsuario = ?",
            [idUsuario]
        );

        let idCarrito;

        if (carrito.length === 0) {
            const [nuevo] = await db.query(
                "INSERT INTO Carrito (idUsuario, total) VALUES (?, 0)",
                [idUsuario]
            );
            idCarrito = nuevo.insertId;
        } else {
            idCarrito = carrito[0].idCarrito;
        }

         const [producto] = await db.query(
            "SELECT precio FROM Producto WHERE idProducto = ?",
            [idProducto]
        );

        if (producto.length === 0) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }

        const precio = producto[0].precio;
        const subtotal = precio * cantidad;

         await db.query(`
            INSERT INTO DetalleCarrito (idCarrito, idProducto, cantidad, subtotal)
            VALUES (?, ?, ?, ?)
        `, [idCarrito, idProducto, cantidad, subtotal]);

         await db.query(`
            UPDATE Carrito
            SET total = total + ?
            WHERE idCarrito = ?
        `, [subtotal, idCarrito]);

        res.json({ message: "Producto agregado al carrito" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al agregar al carrito" });
    }
};

 exports.verCarrito = async (req, res) => {
    try {
        const { idUsuario } = req.params;

        const [carrito] = await db.query(
            "SELECT * FROM Carrito WHERE idUsuario = ?",
            [idUsuario]
        );

        if (carrito.length === 0) {
            return res.json({ message: "Carrito vacío" });
        }

        const idCarrito = carrito[0].idCarrito;

        const [productos] = await db.query(`
            SELECT dc.idDetalle, p.nombre, p.precio, dc.cantidad, dc.subtotal
            FROM DetalleCarrito dc
            JOIN Producto p ON dc.idProducto = p.idProducto
            WHERE dc.idCarrito = ?
        `, [idCarrito]);

        res.json({
            carrito: carrito[0],
            productos
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al obtener carrito" });
    }
};

 exports.actualizarCantidad = async (req, res) => {
    try {
        const { idDetalle } = req.params;
        const { cantidad } = req.body;

        console.log('📝 Actualizando cantidad:', { idDetalle, cantidad });

        if (cantidad <= 0) {
            return res.status(400).json({ message: "La cantidad debe ser mayor a 0" });
        }

        const [detalle] = await db.query(
            "SELECT * FROM DetalleCarrito WHERE idDetalle = ?",
            [idDetalle]
        );

        if (detalle.length === 0) {
            return res.status(404).json({ message: "Producto no encontrado en el carrito" });
        }

        const idCarrito = detalle[0].idCarrito;
        const idProducto = detalle[0].idProducto;
        const subtotalAnterior = detalle[0].subtotal;

         const [producto] = await db.query(
            "SELECT precio FROM Producto WHERE idProducto = ?",
            [idProducto]
        );

        const precio = producto[0].precio;
        const nuevoSubtotal = precio * cantidad;
        const diferencia = nuevoSubtotal - subtotalAnterior;

       
        await db.query(`
            UPDATE DetalleCarrito
            SET cantidad = ?, subtotal = ?
            WHERE idDetalle = ?
        `, [cantidad, nuevoSubtotal, idDetalle]);

        
        await db.query(`
            UPDATE Carrito
            SET total = total + ?
            WHERE idCarrito = ?
        `, [diferencia, idCarrito]);

        console.log('✅ Cantidad actualizada');
        res.json({ message: "Cantidad actualizada correctamente" });

    } catch (error) {
        console.error('❌ Error al actualizar cantidad:', error);
        res.status(500).json({ message: "Error al actualizar cantidad" });
    }
};


exports.eliminarDelCarrito = async (req, res) => {
    try {
        const { idDetalle } = req.params;

        console.log('🗑️ Eliminando producto del carrito:', idDetalle);

 
        const [detalle] = await db.query(
            "SELECT * FROM DetalleCarrito WHERE idDetalle = ?",
            [idDetalle]
        );

        if (detalle.length === 0) {
            return res.status(404).json({ message: "Producto no encontrado en el carrito" });
        }

        const idCarrito = detalle[0].idCarrito;
        const subtotal = detalle[0].subtotal;

       
        await db.query(
            "DELETE FROM DetalleCarrito WHERE idDetalle = ?",
            [idDetalle]
        );

       
        await db.query(`
            UPDATE Carrito
            SET total = total - ?
            WHERE idCarrito = ?
        `, [subtotal, idCarrito]);

        console.log('✅ Producto eliminado del carrito');
        res.json({ message: "Producto eliminado del carrito" });

    } catch (error) {
        console.error('❌ Error al eliminar del carrito:', error);
        res.status(500).json({ message: "Error al eliminar del carrito" });
    }
};
