<!DOCTYPE html>
<html>
<head>
	<% require('./header.jss'); %>
	<title>JsStencil - Index</title>
</head>
<body>
	<% require('./toptoolbar.jss'); %>
	<div class="container">
		<p>HtmlEntities test: <%= htmlentities("<>") %></p>
		<%
		if (!req.session.value)
			req.session.value = 1;
		else
			req.session.value++;
		%>
		<p>Session value: <% echo(req.session.value.toString()); %></p>
	</div>
	<% require('./footer.jss'); %>
</body>
</html>
<%
done();
%>
