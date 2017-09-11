<nav class="navbar navbar-inverse navbar-fixed-top">
    <div class="container">
        <div class="navbar-header">
            <button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">
                <span class="sr-only">Toggle navigation</span>
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
                <span class="icon-bar"></span>
            </button>
            <a class="navbar-brand" href="#"><b>JSSTENCIL</b></a>
        </div>
        <div id="navbar" class="collapse navbar-collapse">
            <ul class="nav navbar-nav">
                <li<% if (__filename.length >= 10 && __filename.substr(-10) == "/index.jss") echo(' class="active"'); %>><a href="index.jss">Home</a></li>
                <li<% if (__filename.length >= 11 && __filename.substr(-11) == "/page2.jss") echo(' class="active"'); %>><a href="page2.jss">Page 2</a></li>
            </ul>
        </div>
    </div>
</nav>
