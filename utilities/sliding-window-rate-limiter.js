/** Simple sliding-window rate limiter */
module.exports = class SlidingWindowRateLimiter{
    constructor(maxRequests=10,timeWindow = 60000){
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.timestamps = {}
    }

    isRateLimited(id){
        const now = Date.now();
        if(!this.timestamps[id]){
            this.timestamps[id] = [];
        }

        const timestamps = this.timestamps[id];
        while(timestamps.length && timestamps[0] <= now - this.timeWindow ){
            timestamps.shift();
        }

        if(timestamps.length >= this.maxRequests){
            return true;
        }
        timestamps.push(now);
        return false;
    }
}