const sanitize = require('express-mongo-sanitize');

module.exports = (socket, next) => {
    socket.use((packet, next) => {
        if (packet && Array.isArray(packet)) {
            const payload = packet[1];
            if (payload && typeof payload === 'object') {
                // Create a mock request object to pass to express-mongo-sanitize
                const mockReq = { body: payload };

                // Apply sanitization
                sanitize()(mockReq, {}, () => {
                    // Overwrite the original payload with sanitized data
                    packet[1] = mockReq.body;
                    console.log(packet[1]);
                });
            }
        }
        next();
    });
    next();
};
