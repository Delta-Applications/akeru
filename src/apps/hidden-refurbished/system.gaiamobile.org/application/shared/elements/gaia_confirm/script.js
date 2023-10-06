'use strict';window.GaiaConfirm=(function(win){var proto=Object.create(HTMLElement.prototype);var baseurl=window.GaiaConfirmBaseurl||'/shared/elements/gaia_confirm/';var EATEN_EVENTS=['touchmove'];function eatEvent(unless,event){if(unless&&unless.indexOf(event.target)!==-1){return;}
event.preventDefault();event.stopImmediatePropagation();}
proto.createdCallback=function(){var shadow=this.createShadowRoot();this._template=template.content.cloneNode(true);var _self=this;shadow.appendChild(this._template);ComponentUtils.style.call(this,baseurl);var confirm=this.querySelector('gaia-buttons .confirm');var cancel=this.querySelector('gaia-buttons .cancel');var allowedTargets=[confirm,cancel].filter(function(element){return!!element;});EATEN_EVENTS.forEach(function(type){this.addEventListener(type,(event)=>{eatEvent(allowedTargets,event);});},this);if(confirm){confirm.addEventListener('click',(e)=>{eatEvent(null,e);this.dispatchEvent(new CustomEvent('confirm'));});}
if(cancel){cancel.addEventListener('click',(e)=>{eatEvent(null,e);this.dispatchEvent(new CustomEvent('cancel'));});}
function _handleKDEvent(e){switch(e.key){case'BrowserBack':case'Backspace':SoftkeyHelper.hide();_self.dispatchEvent(new CustomEvent('cancel'));e.preventDefault();break;}}
function _handleCenterEvent(e){switch(e.key){case'Accept':SoftkeyHelper.hide();_self.dispatchEvent(new CustomEvent('confirm'));e.preventDefault();break;default:break;}}};var template=document.createElement('template');template.innerHTML=`<div class="container"><form role="dialog" class="confirm">
      <section>
        <content select="h1"></content>
        <content select="div"></content>
      </section>
    </form></div>

    <style>
      div.container {
        height: 100%;
        display: flex;
        align-items: flex-end;
      }
      .container .confirm {
        width: 100%;
      }
    </style>
    `;return document.registerElement('gaia-confirm',{prototype:proto});})(window);