/*!
 * JsTemplate
 *
 * Copyright(c) 2017 Mauro H. Leggieri <mxmauro [at] mauroleggieri.com>
 * MIT Licensed
 */
'use strict';

const FILE_EXTENSION = '.jst';

var module = require('module');
var compiler = require('./compiler');
var fs = require('fs');
var path = require('path');
const ContextifyScript = process.binding('contextify').ContextifyScript;
var entities = new (require('html-entities').AllHtmlEntities)();

//------------------------------------------------------------------------------

exports.defaultExtension = FILE_EXTENSION;

exports.createRenderer = function (options) {
	options = Object.assign({}, options);
	if (typeof options.showErrorDetails == 'undefined') {
		options.showErrorDetails = (process.env.NODE_ENV && (process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'development')) ?  true : false;
	}
	if (typeof options.fileExt !== 'string') {
		options.fileExt = FILE_EXTENSION;
	}

	options.userData = Object.assign({}, options.userData);

	if (typeof options.userData != 'object' || Object.prototype.toString.call(options.functions) === '[object Array]')
		throw Error("Custom function(s) is not an object");

	return function(req, res, next)
	{
		var errorSent = false;

		var reqPath = req.path;
		if (reqPath.substr(-1) == '/')
			reqPath += 'index' + options.fileExt;
		if (reqPath.substr(-4) == options.fileExt) {
			reqPath = lookupFile(reqPath, options.root, req.app);
			if (reqPath)

			doRender(reqPath, {
					req: req,
					res: res,
					fileExt: options.fileExt,
					userData : options.userData
				},
				function(err, html) {
					if (err) {
						if (errorSent != false)
							return;
						errorSent = true;

						if (typeof err.view == "object") {
							if (typeof err.view.ext == "string" && err.view.ext == options.fileExt && typeof err.view.path == "undefined") {
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
					if (!res.finished)
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
	};
}

//------------------------------------------------------------------------------

function doRender(filePath, options, callback)
{
	var _module = module;
	var _exports = exports;

	if (typeof callback == 'undefined')
		callback = null;

	if (typeof options.root == 'string')
		filePath = path.resolve(options.root, filePath);

	try {
		var codePrefix;
		var output = [];
		var code = fs.readFileSync(filePath, 'utf8');

		code = compiler.compile(code, filePath);

		var userDataKeys = Object.keys(options.userData);

		codePrefix = '(function (exports, require, module, __filename, __dirname, done, echo, htmlentities';

		userDataKeys.forEach(function (key) {
			codePrefix += ', ' + key;
		});
		if (typeof options.req == "object")
			codePrefix += ', req';
		if (typeof options.res == "object")
			codePrefix += ', res';
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

				if (filename.substr(-options.fileExt.length) != options.fileExt) {
					if (filename.indexOf(path.sep) >= 0)
						filename = path.resolve(path.dirname(filePath), filename);
					return require(filename);
				}
				filename = path.resolve(path.dirname(filePath), filename);

				try {
					var s = doRender(filename, options);
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
		args.push(filePath.replace(new RegExp("\\" + path.sep, 'g'), '/'));
		args.push(path.dirname(filePath).replace(new RegExp("\\" + path.sep, 'g'), '/'));
		args.push(function (err) { //done
				if (!err) {
					if (callback)
						callback(null, buildOutput(output));
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
		userDataKeys.forEach(function (key) {
			args.push(options.userData[key]);
		});
		if (typeof options.req == "object")
			args.push(options.req);
		if (typeof options.res == "object")
			args.push(options.res);
		fn.apply(null, args);

		if (!callback)
			return buildOutput(output);
	}
	catch (err) {
		if (callback)
			callback(err);
		else
			throw err;
	}
};

function buildOutput(output)
{
	output = output.join("");
	return output.replace(/^\s+|\s+$/g, '');
}

function lookupFile(filename, root, app)
{
	var dirs = (app) ? app.get('views') : [ ];

	if (typeof dirs === 'string')
		dirs = [ dirs ];
	else if (typeof dirs === 'undefined')
		dirs = [ ];
	else if (Object.prototype.toString.call(dirs) !== '[object Array]')
		throw Error("App Views is not defined");

	if (typeof root === 'string')
		dirs = [ root ].concat(dirs);
	else if (Object.prototype.toString.call(root) === '[object Array]')
		dirs = root.concat(dirs);
	else if (typeof root !== 'undefined')
		throw Error("Invalid root folder");

	if (dirs.length == 0)
		throw Error("No view folders defined");

	if (filename.length > 0 && filename.charAt(0) == '/') {
		filename = filename.substr(1);
	}

	var finalFilename = null;
	for (var i = 0; i < dirs.length && !finalFilename; i++)
		finalFilename = resolve(dirs[i], filename);
	return finalFilename;
}

function resolve(dir, file)
{
	var finalPath = path.join(dir, file);
	var stat;

	try {
		stat = fs.statSync(finalPath);
	}
	catch (e) {
		stat = undefined;
	}
	if (stat && stat.isFile())
		return finalPath;
	return null;
}
