const path = require('path');
const express = require('express');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const sanitize = require('express-mongo-sanitize');

require('dotenv').config();

const DEBUG = process.env.NODE_ENV && (['prod', 'production'].includes(process.env.NODE_ENV.toLowerCase()));
const PORT = process.env.PORT || 3001;

const app = express();

app.use(logger(DEBUG ? 'dev' : 'short'));
app.use(express.json());
app.use(favicon(path.join(__dirname, 'build', 'favicon.ico')));
app.use(sanitize());
app.use(cookieParser());

app.listen(PORT, () => {
    console.log(`Express app running on port ${port}`);
});