# JsStencil
ExpressJS Javascript Template for Dynamic Webpage generation


## Installation

```bash
$ npm install jsstencil
```

## Features

  * Control flow with `<% %>`.
  * Html output with `<%= %>` or `echo`.
  * Html-safe output with `<%= htmlentities(...) %>`.
  * Complete access to request (`req`) and response (`res`) objects.
  * Supports `require` to include NodeJS modules or nested templates.
  * Supports user-defined functions and values.


## Examples

```html
...
<% if (user) { %>
  <span><%= user.name %></span>
<% } %>
...
```

A more complex sample that uses [`express-session`](https://www.npmjs.com/package/express-session):

```html
<!DOCTYPE html>
<html>
<head>
	<% require('./header.jss'); %>
	<title>Sample</title>
</head>
<body>
<%
var fs = require('fs');
var fileName = fs.statSync('/tmp/sample-file.txt')
try {
	stat = fs.statSync(fileName);
}
catch (e) {
	stat = undefined;
}
%>
	<div>
		<%
		if (!req.session.value)
			req.session.value = 1;
		else
			req.session.value++;
		%>
		<p>Session value: <% echo(req.session.value.toString()); %></p>
		<%
		if (stat && stat.isFile()) {
		%>
		<p>sample-file.txt does exist!!</p>
		<%
		}
		%>
	</div>
</body>
</html>
<%
done();
%>
```
> **IMPORTANT**: Because the templates are parsed as javascript files, ensure your code is safe to avoid introducing  security issues.


## Usage

```javascript
var jstRenderer = require('jsstencil').createRenderer(options);
//...
app.get('*', function(req, res, next) {
		jstRenderer(req, res, next); 
	},
	//renderer will pass the request to 'next' if not a .jss file
	function(req, res, next) {
		//...
	}
);
```

> Although `jstRenderer` value can be used as a template view engine, its functionallity will be limited.


## The special function `done()`

All scripts (`.jss`) must call `done();` or `done(err);` when they finish to execute the code.

Given the __asynchronous nature__ of NodeJS, part of the user script may need to wait an asyncronous response, for e.g.: from a database, to render some data so the script must advise the engine when it finishes to do its tasks.

The `done` function tells JsStencil that rendering is complete so it can continue executing.

If your code has no asynchronous tasks, simply add the call to `done();` at the end. Else call it when your asynchronous callback is called.

If you specify the optional error paremeter, a http status 500 Internal Server Error will be sent to the browser including the details of the error.


## Options

- `root` (string)
    Project root for includes with an absolute path (/index.jss).
- `showErrorDetails` (boolean)
    Send details with the 500 Internal Server Error status on JS errors.
- `fileExt` (string)
    File extension to use (default: `.jss`)
- `userData` (object)
    A set of values and/or functions to pass to the template. Object keys will appear as global objects in the template.

    For example, if you use:
    ```javascript
    userData: {
        mysql: require('mysql'),
        intValue: 5
        sum: function (a, b) {
            return a + b;
        }
    }
    ```

    Then you can do something like this:

    ```javascript
    <%
    var a = sum(5, intValue);
    %>
    ```


## Require/includes

When you use `require` using a relative path and the file extension matches `options.fileExt` (which defaults to `.jss`), `require` will act as an include command and the content of the file will be inserted at the current script position.

Otherwise `require` will have its default `NodeJS` behavior.


## Limitations

- Currently, there is no caching scheme.
- Although JsStencil can be used as a view engine, it is not fully tested and have limitations, like `req` and `res` to be unavailable.
- No client-side support.


## License

Licensed under the MIT License
(<https://opensource.org/licenses/MIT>)

- - -
JsStencil - Javascript Template for Dynamic Webpage generation
Copyright (C) 2017
mxmauro [at] mauroleggieri [dot] com
