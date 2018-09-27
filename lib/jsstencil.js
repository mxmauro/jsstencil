/*!
 * JsStencil - https://github.com/mxmauro/jsstencil
 *
 * Copyright(c) 2017 Mauro H. Leggieri <mxmauro [at] mauroleggieri [dot] com>
 * MIT Licensed
 */
'use strict';

const FILE_EXTENSION = '.jss';

var module = require('module');
const compiler = require('./compiler');
const fs = require('fs');
const path = require('path');
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

	return function(req, res, next) {
		var errorSent = false;

		var reqPath = req.path;
		if (reqPath.substr(-1) == '/') {
			reqPath += 'index' + options.fileExt;
		}

		if (reqPath.substr(-4) == options.fileExt) {
			reqPath = lookupFile(reqPath, options.root, req.app);
			if (reqPath) {
				doRender(reqPath, {
							req: req,
							res: res,
							fileExt: options.fileExt,
							userData : options.userData
				}).then((html) => {
					if (!(res.finished || res.headersSent)) {
						res.send(html);
					}
				}).catch((err) => {
					if (!(res.finished || res.headersSent)) {
					//if (!(res.finished || errorSent)) {
						errorSent = true;
						
						if (typeof err.view == "object") {
							if (typeof err.view.ext == "string" && err.view.ext == options.fileExt && typeof err.view.path == "undefined") {
								res.sendStatus(404);
								return;
							}
						}
						if (typeof err.code == "string") {
							if (err.code == "ENOENT") {
								res.sendStatus(404);
								return;
							}
							if (err.code == "EPERM") {
								res.sendStatus(403);
								return;
							}
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
					}
				});
			}
			else {
				res.sendStatus(404);
			}
		}
		else {
			if (typeof next == "undefined") {
				return false;
			}
			next();
		}
		return true;
	};
}

//------------------------------------------------------------------------------

function doRender(filePath, options)
{
	return new Promise((resolve, reject) => {
		var _module = module;
		var _exports = exports;

		if (typeof options.root == 'string') {
			filePath = path.resolve(options.root, filePath);
		}

		try {
			var output = [];
			var code = fs.readFileSync(filePath, 'utf8');

			code = compiler.compile(code, filePath);

			var userDataKeys = Object.keys(options.userData);

			let params = 'exports, require, module, __filename, __dirname, echo, htmlentities';
			userDataKeys.forEach(function (key) {
				params += ', ' + key;
			});
			if (typeof options.req == "object") {
				params += ', req';
			}
			if (typeof options.res == "object") {
				params += ', res';
			}

			code = '(function (' + params + ') {\n' +
						'function exit() {\n' +
							'let e = new Error(\'Exiting\');\n' +
							'e.systemExit = true;\n' +
							'throw e;\n' +
						'}\n' +
						'return new Promise(async (resolve, reject) => {\n' +
							'try {\n' +
								code + '\n' +
							'}\n' +
							'catch (err) {\n' +
								'reject(err);\n' +
								'return;\n' +
							'}\n' +
							'resolve();\n' +
						'});\n' +
					'});';

			let script = new ContextifyScript(code, {
				filename: filePath,
				lineOffset: 0,
				displayErrors: true
			});
			let fn = script.runInThisContext();

			let args = [];
			args.push(_exports);
			args.push(async function (filename) {
				filename = filename.replace(new RegExp('/', 'g'), path.sep);

				if (filename.substr(-options.fileExt.length) != options.fileExt) {
					if (filename.indexOf(path.sep) >= 0)
						filename = path.resolve(path.dirname(filePath), filename);

					try {
						let exports = require(filename);
						return Promise.resolve(exports);
					}
					catch (err) {
						return Promise.reject(err);
					}
				}
				filename = path.resolve(path.dirname(filePath), filename);

				let html = await doRender(filename, options);
				output.push(html);
			});
			args.push(_module);
			args.push(filePath.replace(new RegExp("\\" + path.sep, 'g'), '/'));
			args.push(path.dirname(filePath).replace(new RegExp("\\" + path.sep, 'g'), '/'));
			args.push(function (str) { //echo
				output.push(str);
			});
			args.push(function (str) { //htmlentities
				return entities.encode(str);
			});
			userDataKeys.forEach(function (key) {
				args.push(options.userData[key]);
			});
			if (typeof options.req == "object") {
				args.push(options.req);
			}
			if (typeof options.res == "object") {
				args.push(options.res);
			}

			fn.apply(null, args).then(() => {
				resolve(buildOutput(output));
			}).catch((err) => {
				if (err.systemExit) {
					resolve(buildOutput(output));
				}
				else {
					reject(err);
				}
			});
		}
		catch (err) {
			if (err.systemExit) {
				resolve(buildOutput(output));
			}
			else {
				reject(err);
			}
		}
	});
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
