module.exports = (socket, next) => {
    socket.use((packet, next) => {
        if (packet && Array.isArray(packet)) {
            const payload = packet[1];
            console.log(payload);
        }
        next();
    })
    next();
}