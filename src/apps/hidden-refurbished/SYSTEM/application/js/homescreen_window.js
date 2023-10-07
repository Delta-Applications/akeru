'use strict';(function(exports){var HomescreenWindow=function HomescreenWindow(manifestURL){this.instanceID='homescreen';this.setBrowserConfig(manifestURL);this.render();this.publish('created');this.createdTime=this.launchTime=Date.now();return this;};HomescreenWindow.prototype=Object.create(AppWindow.prototype);HomescreenWindow.prototype.constructor=HomescreenWindow;HomescreenWindow.prototype._DEBUG=false;HomescreenWindow.prototype.CLASS_NAME='HomescreenWindow';HomescreenWindow.prototype.setBrowserConfig=function hw_setBrowserConfig(manifestURL){var app=window.applications.getByManifestURL(manifestURL);this.origin=app.origin;this.manifestURL=app.manifestURL;this.url=app.origin+'/index.html';this.browser_config=new BrowserConfigHelper({url:this.origin,manifestURL:this.manifestURL});this.name=this.browser_config.name;this.manifest=this.browser_config.manifest;this.browser_config.url=this.url;this.browser_config.isHomescreen=true;this.config=this.browser_config;this.isHomescreen=true;};HomescreenWindow.REGISTERED_EVENTS=AppWindow.REGISTERED_EVENTS;HomescreenWindow.SUB_COMPONENTS={'transitionController':window.AppTransitionController,'modalDialog':window.AppModalDialog,'valueSelector':window.ValueSelector,'authDialog':window.AppAuthenticationDialog,'childWindowFactory':window.ChildWindowFactory,'statusbar':window.AppStatusbar};HomescreenWindow.prototype.openAnimation='no-animation';HomescreenWindow.prototype.closeAnimation='no-animation';HomescreenWindow.prototype._handle__opening=function hw__handle__opening(){this.ensure();};HomescreenWindow.prototype._handle_mozbrowserclose=function hw__handle_mozbrowserclose(evt){this.restart();};HomescreenWindow.prototype._handle_mozbrowsererror=function hw__handle_mozbrowsererror(evt){if(evt.detail.type=='fatal'){this.loaded=false;this.publish('crashed');this.restart();}};HomescreenWindow.prototype.restart=function hw_restart(){if(this.isActive()){this.kill();if(this.element){return;}
this.render();this.open();}else{this.kill();}};HomescreenWindow.prototype.view=function hw_view(){var content=`<div class="appWindow homescreen" id="homescreen">
              <div class="browser-container"></div>
           </div>`;return content;};HomescreenWindow.prototype.eventPrefix='homescreen';HomescreenWindow.prototype.toggle=function hw_toggle(visible){this.ensure();if(this.browser.element){this.setVisible(visible);}};HomescreenWindow.prototype.ensure=function hw_ensure(reset){this.debug('ensuring homescreen...',this.frontWindow);if(!this.element){this.render();}else if(reset){if(this.frontWindow){this.frontWindow.kill();}else{}}
return this.element;};HomescreenWindow.prototype.resize=function aw_resize(){this.debug('request RESIZE...');this.debug(' will resize... ');this._resize();};exports.HomescreenWindow=HomescreenWindow;}(window));