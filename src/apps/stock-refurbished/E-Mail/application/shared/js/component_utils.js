(function(e) {
    e.ComponentUtils = {
        style: function(e) {
            var t = document.createElement("style"), n = e + "style.css", r = this;
            t.setAttribute("scoped", ""), t.innerHTML = "@import url(" + n + ");", this.appendChild(t), 
            this.style.visibility = "hidden", t.addEventListener("load", function() {
                r.shadowRoot && r.shadowRoot.appendChild(t.cloneNode(!0)), r.style.visibility = "";
            });
        }
    };
})(window);