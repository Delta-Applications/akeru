'use strict';var FxaModuleNavigation={stepCount:0,currentModule:null,init:function fxam_nav_init(flow){window.addEventListener('hashchange',this.hashchangeHandler.bind(this),false);LazyLoader.load('view/view_'+flow+'.js',function loaded(){FxaModuleUI.setMaxSteps(View.length);window.location.hash=View.start.id;}.bind(this));},hashchangeHandler:function fxam_nav_hashchangeHandler(){if(!location.hash){return;}
var panel=document.querySelector(location.hash);if(!panel||!panel.classList.contains('screen')){return;}
if(this.backAnim){this.stepCount--;this.loadStep(panel,true);}else{this.stepCount++;this.loadStep(panel);}},loadStep:function fxam_nav_loadStep(panel,back){if(!panel){return;}
FxaModuleUI.loadScreen({panel:panel,count:this.stepCount,back:this.backAnim,onload:function(){this.currentModule=window[this.moduleById(panel.id)];this.currentModule.init&&this.currentModule.init(FxaModuleManager.paramsRetrieved);}.bind(this),onanimate:function(){this.backAnim=false;this.updatingStep=false;window.dispatchEvent(new CustomEvent('windowLoaded'));}.bind(this)});},back:function fxam_nav_back(isSoftBack){if(this.updatingStep){return;}
this.updatingStep=true;this.currentModule.onBack&&this.currentModule.onBack(this.loadNextStep.bind(this));if(!isSoftBack){this.backAnim=true;window.history.back();}},loadNextStep:function fxam_loadNextStep(nextStep){if(!nextStep||!nextStep.id){return;}
location.hash=nextStep.id;},next:function fxam_nav_next(){this.currentModule.onNext(this.loadNextStep.bind(this));},moduleById:function fxam_nav_moduleById(id){ViewManager.switchSection(id);var moduleKey=Object.keys(FxaModuleStates).filter(function(module){return FxaModuleStates[module]&&FxaModuleStates[module].id&&FxaModuleStates[module].id===id;}).pop();if(moduleKey){return FxaModuleStates[moduleKey].module;}},done:function fxam_nav_done(){this.currentModule.onDone(FxaModuleManager.done);}};