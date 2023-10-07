'use strict';(function(exports){var InputWindow=function(configs){configs.isInputMethod=true;configs.name='InputMethods';configs.url=configs.origin+configs.path;this.splashed=true;this._pendingReady=false;AppWindow.call(this,configs);this.transitionController.OPENING_TRANSITION_TIMEOUT=5000;this.transitionController.CLOSING_TRANSITION_TIMEOUT=5000;this.browser.element.dataset.frameName=configs.id;};InputWindow.prototype=Object.create(AppWindow.prototype);InputWindow.prototype.constructor=InputWindow;InputWindow.REGISTERED_EVENTS=['mozbrowsererror'];InputWindow.SUB_COMPONENTS={'transitionController':AppTransitionController};InputWindow.prototype.containerElement=document.getElementById('keyboards');InputWindow.prototype.view=function iw_view(){return`<div class="${this.CLASS_LIST}" id="${this.instanceID}"
            transition-state="closed">
              <div class="browser-container"></div>
           </div>`;};InputWindow.prototype.eventPrefix='input-app';InputWindow.prototype.openAnimation='slide-from-bottom';InputWindow.prototype.closeAnimation='slide-to-bottom';InputWindow.prototype._DEBUG=false;InputWindow.prototype.CLASS_LIST='inputWindow';InputWindow.prototype.CLASS_NAME='InputWindow';InputWindow.prototype._handle_mozbrowserresize=function iw_handle_mozbrowserresize(evt){var height=evt.detail.height;this._setHeight(height);this.publish('ready');if('opened'===this.transitionController._transitionState){this.publish('heightchanged');}
evt.stopPropagation();};InputWindow.prototype._handle__ready=function iw_handle__ready(evt){this.element.removeEventListener('_ready',this);this._pendingReady=false;this._setHeight(evt.detail.height);AppWindow.prototype.open.call(this,this.immediateOpen?'immediate':undefined);};InputWindow.prototype._setHeight=function iw_setHeight(height){var dpx=window.devicePixelRatio;if((height*dpx)%1!==0){height=Math.floor(height*dpx)/dpx;}
this.height=height;};InputWindow.prototype._setAsActiveInput=function iw_setAsActiveInput(active){this.debug('setAsActiveInput: '+this.manifestURL+this.path+', active: '+active);this.setVisible(active);if(this.browser.element.setInputMethodActive){this.browser.element.setInputMethodActive(active);}else{console.warn('setInputMethodActive is not available');}
if(active){this.browser.element.addEventListener('mozbrowserresize',this,true);this.element.classList.add('top-most');}else{this.browser.element.removeEventListener('mozbrowserresize',this,true);this.element.classList.remove('top-most');this.height=0;}};InputWindow.prototype.lockOrientation=function iw_setOrientation(){};InputWindow.prototype.setOrientation=function iw_setOrientation(){};InputWindow.prototype.close=function iw_close(immediate){this.element.removeEventListener('_ready',this);AppWindow.prototype.close.call(this,immediate);};InputWindow.prototype.open=function iw_open(configs){var hashChanged=false;if(configs.hash!==this.hash){this.browser.element.src=this.origin+this.pathInitial+configs.hash;this.debug(this.browser.element.frameName+' is overwritten: '+
this.browser.element.src);this.browser.element.dataset.frameName=configs.id;this.hash=configs.hash;hashChanged=true;}
this.immediateOpen=configs.immediateOpen;this.element.addEventListener('_ready',this);this._pendingReady=true;this._setAsActiveInput(true);if(!hashChanged&&'closing'===this.transitionController._transitionState){this.immediateOpen=true;this.publish('ready');}};exports.InputWindow=InputWindow;})(window);