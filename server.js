require('dotenv').config();
const path = require('path');
const express = require('express');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const sanitize = require('express-mongo-sanitize');
const socketServer = require('./socket-server');



const bearer = require('./middleware/bearer');
const auth = require('./middleware/authenticate');
const authRoutes = require('./modules/users/routes');

require('./utilities/db');

const DEBUG = process.env.NODE_ENV ? (['prod', 'production'].includes(process.env.NODE_ENV.toLowerCase())) : true;
const PORT = process.env.PORT || 3001;

const app = express();


app.use(logger(DEBUG ? 'dev' : 'short'));
app.use(express.json());
// build folder is symlinked for conveneince during development
app.use(favicon(path.join(__dirname, 'build', 'favicon.ico')));
app.use(express.static(path.join(__dirname, 'build')));
app.use(sanitize());
app.use(cookieParser());

app.post('/api/users/refresh',require('./modules/users/controller').manualRefreshToken);

app.use(bearer);

// API ROUTES
app.use('/api/users',authRoutes);
app.get('/api/extension', (req,res,next) => {
    res.json(['hfoafkeghgdpiigjjgpdgjhikhdoppli']);
});

// "CATCH-ALL" ROUTE TO SERVE REACT-APP, MIGHT BE MIGRATED TO ANOTHER SERVER AND USE CORS
app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const server = socketServer(app);

server.listen(PORT, ()=>{
    console.log(`Server listening on port ${PORT}`);
});

// app.listen(PORT, () => {
//     console.log(`Express app running on port ${PORT}`);
// });