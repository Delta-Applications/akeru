'use strict';const IGNORED_INPUT_TYPES={'select-one':true,'select-multiple':true,'date':true,'time':true,'datetime':true,'datetime-local':true};const TYPE_GROUP_MAPPING={'text':'text','textarea':'text','url':'url','email':'email','password':'password','search':'text','number':'number','tel':'number','select-one':'option','select-multiple':'option','time':'option','week':'option','month':'option','date':'option','datetime':'option','datetime-local':'option','color':'option'};const SWITCH_CHANGE_DELAY=20;window.KeyboardManager={_showingInputGroup:null,_switchChangeTimeout:0,_onDebug:false,_debug:function km_debug(msg){if(this._onDebug){console.log('[Keyboard Manager] '+msg);}},init:function km_init(){window.addEventListener('keyboardhide',this);window.addEventListener('mozChromeEvent',this);window.addEventListener('iac-spell-dialog',this);this.inputLayouts=new InputLayouts(this,TYPE_GROUP_MAPPING);this.inputLayouts.start();LazyLoader.load(['js/dynamic_input_registry.js','shared/js/input_mgmt/input_app_list.js','shared/js/keyboard_helper.js','shared/js/keypad_helper.js'],function(){this.dynamicInputRegistry=new DynamicInputRegistry();this.dynamicInputRegistry.start();KeyboardHelper.watchLayouts({enabled:true},this._updateLayouts.bind(this));this.keypadHelper=new KeypadHelper();this.keypadHelper.start();this.keypadHelper.getActiveLayout().then(this._setActiveLayout.bind(this));this.keypadHelper.setActiveModeChangedCallback(this._publishModeChanged.bind(this));this.keypadHelper.setActiveLayoutChangedCallback(this._handleLayoutChanged.bind(this));}.bind(this));},_tryLaunchOnBoot:function km_launchOnBoot(){if(inputWindowManager.getLoadedManifestURLs().length){return;}
var LAUNCH_ON_BOOT_KEY='keyboard.launch-on-boot';var req=navigator.mozSettings.createLock().get(LAUNCH_ON_BOOT_KEY);req.onsuccess=req.onerror=(function(){var launchOnBoot=req.result&&req.result[LAUNCH_ON_BOOT_KEY];if(typeof launchOnBoot!=='boolean'){launchOnBoot=true;}
if(launchOnBoot&&!inputWindowManager.getLoadedManifestURLs().length){this._preloadKeyboard();}}).bind(this);},_setActiveLayout:function(activeLayout){this.activeLayout=activeLayout;},_handleLayoutChanged:function(layout){var languages=this.keypadHelper.DISPLAY_LANGUAGES[layout];this.activeLayout=layout;this._showToaster({text:languages});},_publishModeChanged:function(value){var idMap={'abc':'ime-lowercase','ABC':'ime-uppercase','123':'ime-number','Abc':'ime-capitalize','T9':'ime-predictive'};var displayName=this.keypadHelper.DISPLAY_LANGUAGES[this.activeLayout];var iconText=this.keypadHelper.LANGUAGES_ICON_TEXT[this.activeLayout];window.dispatchEvent(new CustomEvent('keyboard-mode-changed',{detail:{mode:value.mode,iconText:iconText,activeLayout:this.activeLayout}}));if(value.byUser){var ariaLabel=navigator.mozL10n.get(idMap[value.mode]);if(iconText&&value.mode==='abc'){this._showToaster({text:displayName});return;}
if(value.mode==='T9'){if(this.activeLayout.indexOf('chinese')>-1||this.activeLayout==='korean'){this._showToaster({text:displayName,ariaLabel:ariaLabel});}else{this._showToaster({text:ariaLabel,ariaLabel:ariaLabel});}
return;}
this._showToaster({text:value.mode,ariaLabel:ariaLabel});}},_showToaster:function(option){Service.request('SystemToaster:show',{text:option.text,ariaLabel:option.ariaLabel,timeout:1500});},_updateLayouts:function km_updateLayouts(layouts){var enabledApps=this.inputLayouts.processLayouts(layouts);var manifestURLsToRemove=inputWindowManager.getLoadedManifestURLs().filter(manifestURL=>!enabledApps.has(manifestURL));var currentLayoutRemoved=inputWindowManager._onInputLayoutsRemoved(manifestURLsToRemove);if(currentLayoutRemoved){this._showingInputGroup=null;}
this._tryLaunchOnBoot();},_onKeyboardKilled:function km_onKeyboardKilled(manifestURL){if(!this.inputLayouts.layouts[this._showingInputGroup]){this._showingInputGroup='text';}
if(Service.query('InputWindowManager.isActivated')){this._setKeyboardToShow(this._showingInputGroup);}},_activateKeyboard:function km_activateKeyboard(group){if(!this.inputLayouts.layouts[group]){KeyboardHelper.checkDefaults(function changedDefaults(){KeyboardHelper.getLayouts({enabled:true},this._updateLayouts.bind(this));KeyboardHelper.saveToSettings();}.bind(this));}
if(!this.inputLayouts.layouts[group]){group='text';}
if(this.inputLayouts.layouts[group]&&this.inputLayouts.layouts[group]._activeLayoutIdx!==undefined){this._setKeyboardToShow(group);}else{this.inputLayouts.getGroupCurrentActiveLayoutIndexAsync(group).then(currentActiveLayoutIdx=>{this._setKeyboardToShow(group,currentActiveLayoutIdx);}).catch(e=>{console.error(`KeyboardManager: failed to retrieve
                         currentActiveLayoutIdx`,e);this._setKeyboardToShow(group);});}},_inputFocusChange:function km_inputFocusChange(evt){var type=evt.detail.inputType;if(!type||type in IGNORED_INPUT_TYPES){inputWindowManager.hideInputWindow();return;}
if('blur'===type){this._debug('get blur event');inputWindowManager.hideInputWindow();}else{var group=TYPE_GROUP_MAPPING[type];this._debug('get focus event '+type);this._activateKeyboard(group);}},handleEvent:function km_handleEvent(evt){switch(evt.type){case'mozChromeEvent':switch(evt.detail.type){case'inputmethod-showall':this._showImeMenu();break;case'inputmethod-next':this._switchToNext();break;case'inputmethod-contextchange':this._inputFocusChange(evt);break;}
break;case'keyboardhide':this._showingInputGroup=null;break;case'iac-spell-dialog':if(evt.detail==='voice-input-ftu'){Service.request('DialogService:show',{type:'alert',style:'google',content:'ime-voice-input-messsage'});}else{Service.request('DialogService:show',{type:'prompt',content:'ime-insert-word',inputMode:'spell',maxLength:256,ok:'ok',cancel:'cancel'});}
break;}},_preloadKeyboard:function km_preloadKeyboard(){if(!this.inputLayouts.layouts.text){console.warn('trying to preload \'text\' layout while it\'s unavailable');return;}
this._debug('preloading a keyboard');inputWindowManager.preloadInputWindow(this.inputLayouts.layouts.text[0]);},_setKeyboardToShow:function km_setKeyboardToShow(group,index){if(!this.inputLayouts.layouts[group]){console.warn('trying to set a layout group to show that doesnt exist');return;}
if(undefined===index){index=this.inputLayouts.layouts[group]._activeLayoutIdx||0;}
this._debug('set layout to display: group='+group+' index='+index);var layout=this.inputLayouts.layouts[group][index];inputWindowManager.showInputWindow(layout);this.inputLayouts.saveGroupsCurrentActiveLayout(layout);this._showingInputGroup=group;},_waitForSwitchTimeout:function km_waitForSwitchTimeout(callback){clearTimeout(this._switchChangeTimeout);this._switchChangeTimeout=setTimeout(callback,SWITCH_CHANGE_DELAY);},_switchToNext:function km_switchToNext(){var showedGroup=this._showingInputGroup;this._waitForSwitchTimeout(function keyboardSwitchLayout(){if(!this.inputLayouts.layouts[showedGroup]){showedGroup='text';}
var showedIndex=this.inputLayouts.layouts[showedGroup]._activeLayoutIdx;var length=this.inputLayouts.layouts[showedGroup].length;var index=(showedIndex+1)%length;this._setKeyboardToShow(showedGroup,index);}.bind(this));},_imeMenuCallback:function km_imeMenuCallback(showedGroup,selectedIndex){if(typeof selectedIndex==='number'){this._setKeyboardToShow(showedGroup,selectedIndex);window.dispatchEvent(new CustomEvent('keyboardchanged'));}else{this._setKeyboardToShow(showedGroup);window.dispatchEvent(new CustomEvent('keyboardchangecanceled'));}},_showImeMenu:function km_showImeMenu(){var showedGroup=this._showingInputGroup;var activeLayoutIdx=this.inputLayouts.layouts[showedGroup]._activeLayoutIdx;var actionMenuTitle=navigator.mozL10n.get('choose-option');this._waitForSwitchTimeout(function listLayouts(){var items=this.inputLayouts.layouts[showedGroup].map(function(layout,index){return{layoutName:layout.name,appName:layout.appName,value:index,selected:(index===activeLayoutIdx)};});inputWindowManager.hideInputWindow();var menu=new ImeMenu(items,actionMenuTitle,this._imeMenuCallback.bind(this,showedGroup),this._imeMenuCallback.bind(this,showedGroup));menu.start();}.bind(this));}};