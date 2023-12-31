define({
    load: function(id, require, onload, config) {
        if (config.isBuild) {
            return onload();
        }
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl(id + ".css");
        link.addEventListener("load", onload, false);
        document.head.appendChild(link);
    }
});