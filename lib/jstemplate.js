'use strict';

const FILE_EXTENSION = '.jst';

var module = require('module');
var compiler = require('./compiler');
var fs = require('fs');
var path = require('path');
const ContextifyScript = process.binding('contextify').ContextifyScript;
var entities = new (require('html-entities').AllHtmlEntities)();
var objExtend = require('util')._extend;

var identifierRegEx = /^[_a-zA-Z][_a-zA-Z0-9]{0,30}$/;

//------------------------------------------------------------------------------

function InternalError(message)
{
	const instance = new Error(message);
	Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
	return instance;
}

InternalError.prototype = Object.create(Error.prototype, {
	constructor: {
		value: Error,
		enumerable: false,
		writable: true,
		configurable: true
	}
});
if (Object.setPrototypeOf) {
	Object.setPrototypeOf(InternalError, Error);
}
else {
	InternalError.__proto__ = Error;
}

//------------------------------------------------------------------------------

exports.__express = function (filePath, options, callback)
{
	var _module = module;
	var _exports = exports;

	if (typeof options == 'function') {
		callback = options;
		options = {};
	}

	options = objExtend(options || {}, {
		req: null,
		res: null,
		functions: []
	});

	if (typeof callback == 'undefined')
		callback = null;

	try {
		var codePrefix;
		var output = [];
		var code = fs.readFileSync(filePath, 'utf8');

		code = compiler.compile(code, filePath);

		codePrefix = '(function (exports, require, module, __filename, __dirname, res, req, done, echo, htmlentities, redirect, download';
		options.functions.forEach(function(func) {
			if (!identifierRegEx.test(func.name))
				throw Error("Invalid custom function identifier");
			codePrefix += ', ' + func.name;
		});
		code = codePrefix + ') {\n' + code + '\n});\n';

		var script = new ContextifyScript(code, {
			filename: filePath,
			lineOffset: 0,
			displayErrors: true
		});
		var fn = script.runInThisContext();

		var args = [];
		args.push(_exports);
		args.push(function (filename) {
				filename = filename.replace(new RegExp('/', 'g'), path.sep);

				if (filename.substr(-FILE_EXTENSION.length) != FILE_EXTENSION) {
					if (filename.indexOf(path.sep) >= 0)
						filename = path.resolve(path.dirname(filePath), filename);
					return require(filename);
				}
				filename = path.resolve(path.dirname(filePath), filename);

				try {
					var s = _exports.__express(filename, options);
					output.push(s);
				}
				catch (err) {
					if (callback)
						callback(err);
					else
						throw err;
				}
			});
		args.push(_module);
		args.push(filePath);
		args.push(path.dirname(filePath));
		args.push(options.res);
		args.push(options.req);
		args.push(function (err) { //done
				if (!err) {
					if (callback)
						callback(null, output.join(""));
					//else output will go after fn' returns
				}
				else {
					if (callback)
						callback(err);
					else
						throw err;
				}
			});
		args.push(function (str) { //echo
				output.push(str);
			});
		args.push(function (str) { //htmlentities
				return entities.encode(str);
			});
			
		args.push(function (target) { //redirect
				var e = new InternalError("redirect");
				e.target = target;
			});
		args.push(function (filename) { //download
				var e = new InternalError("download");
				e.filename = filename;
			});
		options.functions.forEach(function(func) {
			if (typeof func.func != 'undefined')
				throw Error("Invalid custom function");
			args.push(func.func);
		});
		fn.apply(null, args);

		if (!callback)
			return output.join("");
	}
	catch (err) {
		if (callback)
			callback(err);
		else
			throw err;
	}
}

exports.render = function(req, res, next, options)
{
	var errorSent = false;

	options = objExtend(options || {}, {
		showErrorDetails: true,
		functions: []
	});

	var reqPath = req.path;
	if (reqPath.substr(-1) == '/')
		reqPath += 'index' + FILE_EXTENSION;
	reqPath = reqPath.substr(1);
	if (reqPath.substr(-4) == FILE_EXTENSION) {
		res.render(reqPath, {
				req: req, res: res, functions : options.functions
			},
			function(err, html) {
				if (err) {
					if (errorSent != false)
						return;
					errorSent = true;

					if (err instanceof InternalError) {
						/*
						if (err.message === "redirect") {
							res.redirect(err.target);
						}
						else if (err.message === "download") {
							res.sendFile(err.filename);
						}
						*/
					}
					if (typeof err.view == "object") {
						if (typeof err.view.ext == "string" && err.view.ext == FILE_EXTENSION && typeof err.view.path == "undefined") {
							res.sendStatus(404);
							return;
						}
					}
					if (typeof err.code == "string" && err.code == "ENOENT") {
						res.sendStatus(404);
						return;
					}

					if (options.showErrorDetails) {
						var output = err.toString();
						output = entities.encode(err.toString());

						if (typeof err.fileName != "undefined") {
							output += " @ " + entities.encode(err.fileName.toString());
							if (typeof err.lineNumber != "undefined") {
								output += "(" + entities.encode(err.lineNumber.toString()) + ")";
							}
						}

						if (typeof err.stack != "undefined") {
							output += "\r\n\r\nStack trace: " + entities.encode(err.stack.toString());
						}
						output = output.replace(/(?:\r\n|\r|\n)/g, '<br />');

						output = "<html><head><title>Server Error: 500 Internal Server Error</title></head>" +
									"<body style='text-align:left; font-family:Arial,Helvetica; font-size:10pt; padding:5px;'>" +
									"Server error: <b>500 Internal Server Error</b><hr />" + output + "</body></html>";

						res.status(500).send(output);
					}
					else {
						res.sendStatus(500);
					}
					return;
				}
				res.send(html);
			}
		);
	}
	else {
		if (typeof next == "undefined")
			return false;
		next();
	}
	return true;
}
