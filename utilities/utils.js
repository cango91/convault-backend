/** Converts a string representation of time, ie. '30m' for 30 minutes, to seconds 
 * 
 *  Minimum unit is seconds, maximum unit is weeks 
*/
const toSeconds = (timeString) => {
    if (typeof timeString !== 'string') {
        throw new Error('Argument must be a string');
    }

    const validUnits = ['s', 'm', 'h', 'd', 'w'];
    const unit = timeString.substring(timeString.length - 1);

    if (!validUnits.includes(unit)) throw new Error('Invalid time unit');

    const num = Number(timeString.substring(0, timeString.length - 1));

    if (isNaN(num)) {
        throw new Error('Invalid number in time string');
    }

    // convert time unit to seconds
    switch (unit) {
        case 's':
            return num;
        case 'm':
            return num * 60;
        case 'h':
            return num * 3600;
        case 'd':
            return num * 86400;
        case 'w':
            return num * 604800;
    }
}

const respondWithStatus = (response, status = 400, message = 'Bad Request') =>
    response.status(status).json({ message });


module.exports = {
    toSeconds,
    respondWithStatus,
}