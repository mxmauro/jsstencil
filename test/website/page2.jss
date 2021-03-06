<%
var async = require('async');

async.waterfall([
		function (callback) {
			//dummy function to show we can use any module with JsStencil
			//we render a header here
			%>
<!DOCTYPE html>
<html>
<head>
	<% require('./header.jss'); %>
	<title>JsStencil - Page 2</title>
</head>
			<%
			callback(null);
		},
		function (callback) {
			//another dummy function to show we can use any module with JsStencil
			//we render the a body here
			%>
<body>
	<% require('./toptoolbar.jss'); %>
	<div class="container">
		<%
		for (var i = 0; i < 10; i++)
		{
		%>
			<p>Value of I = <%= htmlentities(i.toString()) %> - RandomInt(100,200) = <%= htmlentities(randomInt(100, 200).toString()) %></p>
		<%
		}
		%>
	</div>
	<% require('./footer.jss'); %>
</body>
			<%
			callback(null);
		},
		function (callback) {
			//now we render close html tag
			%>
</html>
			<%
			callback(null);
		}
	],
	function (err, result) {
		done(err);
	});
%>
