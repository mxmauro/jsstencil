'use strict';

var fs = require('fs');
var path = require('path');
var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require("method-override");
var helmet = require('helmet');
var session = require('express-session');
var FileStore = require('session-file-store')(session);

global.config = JSON.parse(fs.readFileSync(__dirname + path.sep + 'config.json', 'utf8'));

/*
global.async = require('async');
global.entities = new (require('html-entities').AllHtmlEntities)();
global.fs = require("fs");
global.path = require('path');
global.config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
global.Web3 = require('./helpers/web3_connector');
global.mysql = require('./helpers/mysql_connector');
*/
//------------------------------------------------------------------------------

EnsureFolderExists(__dirname + path.sep + 'sessions');
/*
EnsureFolderExists(__dirname + path.sep + 'temp');
*/

var app = express();
var jstemplate = require('../lib/jstemplate');

app.engine('jst', jstemplate.__express);
app.set('views', __dirname + path.sep + 'website');

var staticFiles = express.static(__dirname + path.sep + 'website');

/*
// Router
var router = express.Router();

router.all('*', function (req, res, next) {
    res.sendStatus(403);
});

// Middlewares
/*
app.use(multipart({
    encoding: 'utf-8',
    uploadDir: __dirname + path.sep + 'temp',
    maxFieldsSize: 5 * 1024 * 1024
}));
*/
app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '5mb' }));
/*
app.use(expressValidator({})); // this line must be immediately after any of the bodyParser middlewares!
*/
app.use(methodOverride());
app.use(helmet());
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(session({
	secret: 'jstemplate session magic',
	name: 'jstsessionid',
	resave: false,
	saveUninitialized: true,
	cookie: {
		secure: false, //we are not using https
		maxAge: 30*60*1000 //30 minutes
	},
	store: new FileStore({
		path: __dirname + path.sep + 'sessions',
		ttl: 60*60 //1 hour
	})
}));

app.get('*', function(req, res, next) {
		jstemplate.render(req, res, next);
	},function(req, res, next) {
		staticFiles(req, res, next);
	}
);

// Start server
app.listen(config.server.port, function() {
    console.log("JsTemplate Demo running on http://localhost:" + config.server.port.toString());
});

//------------------------------------------------------------------------------

function EnsureFolderExists(dir)
{
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir);
}
