
!function(t){t.ComponentUtils={style:function(t){var e=document.createElement("style"),i=t+"style.css",n=this;e.setAttribute("scoped",""),e.innerHTML="@import url("+i+");",this.appendChild(e),this.style.visibility="hidden",e.addEventListener("load",function(){n.shadowRoot&&n.shadowRoot.appendChild(e.cloneNode(!0)),n.style.visibility=""})}}}(window);