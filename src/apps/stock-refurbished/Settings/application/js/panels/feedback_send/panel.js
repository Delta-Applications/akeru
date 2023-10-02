define("panels/feedback_send/feedback_send",["require","modules/settings_service","shared/async_storage"],function(e){var t=e("modules/settings_service");e("shared/async_storage");var n=function(){};return n.prototype={_SettingsCache:SettingsDBCache,_SettingsService:t,init:function(e){this.elements=e,this.options={},this._sendData={product:"Firefox OS",platform:"Firefox OS"},this._showEmail=!1},_isHappy:function(){var e=this.options&&this.options.feel;return"feedback-happy"===e},updateTitle:function(){var e="feedback_whyfeel_"+(this._isHappy()?"happy":"sad");this.elements.title.setAttribute("data-l10n-id",e)},getPreviousInputs:function(){window.asyncStorage.getItem("feedback",function(e){this._inputData=e||{}}.bind(this))},keepAllInputs:function(){window.asyncStorage.setItem("feedback",this._inputData)},get _inputData(){return{description:this.elements.description.value,email:this.elements.emailInput.value,emailEnable:this._showEmail}},set _inputData(e){this.elements.description.value=e.description||"",this.elements.emailInput.value=e.email||"",this._showEmail=!e.emailEnable,this.enableEmail()},alertConfirm:function(){this.elements.alertDialog.hidden=!0,this.elements.alertMsg.textContent="",this.elements.alertMsg.removeAttribute("data-l10n-id")},done:function(){this._SettingsService.navigate("improveBrowserOS"),this.elements.doneDialog.hidden=!0},send:function(){if(this.elements.sendBtn.disabled=!0,!navigator.onLine)return this._messageHandler("connect-error"),void 0;var e=this.elements.emailColumn,t=this.elements.emailInput,n=this.elements.description;if(0===n.textLength)return this._messageHandler("empty-comment"),void 0;if(this._sendData.description=n.value,e.hidden?delete this._sendData.email:this._sendData.email=t.value,!(e.hidden||t.value.length&&t.validity.valid))return this._messageHandler("wrong-email"),void 0;var i=this._SettingsCache.cache,o=i["feedback.url"];this._sendData.version=i["deviceinfo.os"],this._sendData.device=i["deviceinfo.hardware"],this._sendData.locale=i["language.current"],this._sendData.happy=this._isHappy(),this._xhr=new XMLHttpRequest({mozSystem:!0}),this._xhr.open("POST",o,!0),this._xhr.setRequestHeader("Content-type","application/json"),this._xhr.timeout=5e3,this._xhr.onload=this._responseHandler.bind(this),this._xhr.ontimeout=function(){this._messageHandler("timeout")}.bind(this),this._xhr.send(JSON.stringify(this._sendData))},enableEmail:function(){var e=this._showEmail;this._showEmail=!e,this.elements.emailEnable.checked=!e,this.elements.emailColumn.hidden=e},back:function(){this.keepAllInputs(),this._SettingsService.navigate("improveBrowserOS-chooseFeedback")},_responseHandler:function(){switch(this._xhr.status){case 201:this._messageHandler("success");break;case 429:this._messageHandler("success");break;case 404:this._messageHandler("server-off");break;case 400:this._messageHandler("wrong-email");break;default:this._messageHandler("connect-error")}},_messageHandler:function(e){"success"===e?this.elements.doneDialog.hidden=!1:(this.keepAllInputs(),this.elements.alertMsg.setAttribute("data-l10n-id","feedback-errormessage-"+e),this.elements.alertDialog.hidden=!1),this.elements.sendBtn.disabled=!1}},function(){return new n}}),define("panels/feedback_send/panel",["require","modules/settings_panel","panels/feedback_send/feedback_send"],function(e){var t=e("modules/settings_panel"),n=e("panels/feedback_send/feedback_send");return function(){function e(e){a.forEach(function(t){t.method=r[t.methodName].bind(r),e[t.elementName].addEventListener(t.eventType,t.method)})}function i(e){a.forEach(function(t){t.method&&e[t.elementName].removeEventListener(t.eventType,t.method)})}var o={},r=n(),a=[{elementName:"alertBtn",eventType:"click",methodName:"alertConfirm"},{elementName:"doneBtn",eventType:"click",methodName:"done"},{elementName:"sendBtn",eventType:"click",methodName:"send"},{elementName:"emailEnable",eventType:"click",methodName:"enableEmail"},{elementName:"header",eventType:"action",methodName:"back"}];return t({onInit:function(e){o={alertDialog:e.querySelector("#feedback-alert"),alertMsg:e.querySelector("#feedback-alert-msg"),alertBtn:e.querySelector("#feedback-alert-btn"),doneDialog:e.querySelector("#feedback-done"),doneBtn:e.querySelector("#feedback-done-btn"),title:e.querySelector("#feedback-title"),description:e.querySelector("#feedback-description"),emailInput:e.querySelector("#feedback-email"),emailColumn:e.querySelector("#feedback-emailbar"),emailEnable:e.querySelector("#email-enable"),sendBtn:e.querySelector("#feedback-send-btn"),header:e.querySelector("#feedback-header")},r.init(o)},onBeforeShow:function(t,n){e(o),r.options=n,r.updateTitle(),r.getPreviousInputs()},onBeforeHide:function(){i(o),document.hidden&&r.keepAllInputs()}})}});