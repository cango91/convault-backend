const validator = require('validator');
module.exports = (socket, next) => {
    socket.use((packet, next) => {
        if (packet && Array.isArray(packet)) {
            // Assuming the data payload is in the second element of the packet array
            const payload = packet[1];

            if (payload && typeof payload === 'object') {
                for (const key in payload) {
                    if (typeof payload[key] === 'string') {
                        // Sanitize each string field in the payload
                        payload[key] = validator.escape(payload[key]);
                    }
                }
            }
        }
        next();
    });
    next();
}