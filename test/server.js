/*!
 * JsStencil - https://github.com/mxmauro/jsstencil
 *
 * Copyright(c) 2017 Mauro H. Leggieri <mxmauro [at] mauroleggieri [dot] com>
 * MIT Licensed
 */
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

//------------------------------------------------------------------------------

EnsureFolderExists(__dirname + path.sep + 'sessions');

var app = express();
var jsRenderer = require('../lib/jsstencil').createRenderer({
	root: __dirname + path.sep + 'website',
	showErrorDetails: true,
	userData: {
		randomInt: function (min, max) {
			return Math.floor(Math.random() * (max - min) + min);
		}
	}
});
var staticFiles = express.static(__dirname + path.sep + 'website');

app.use(bodyParser.json({ limit: '5mb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '5mb' }));
app.use(methodOverride());
app.use(helmet());
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(session({
	secret: 'jsstencil session magic',
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
		jsRenderer(req, res, next); //pass the request to 'next' if not a .jss file
	},
	function(req, res, next) {
		staticFiles(req, res, next);
	}
);

// Start server
app.listen(config.server.port, function() {
    console.log("JsStencil Demo running on http://localhost:" + config.server.port.toString());
});

//------------------------------------------------------------------------------

function EnsureFolderExists(dir)
{
	if (!fs.existsSync(dir))
		fs.mkdirSync(dir);
}
