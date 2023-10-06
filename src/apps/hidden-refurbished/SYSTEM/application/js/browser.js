
(function(exports){'use strict';function handleOpenUrl(url){var config=new BrowserConfigHelper({url:url});config.oop=true;var newApp=new AppWindow(config);newApp.requestOpen();}
function Browser(){}
Browser.prototype={start:function(){window.navigator.mozSetMessageHandler('activity',this.handleActivity.bind(this));},handleActivity:function(activity){var data=activity.source.data;switch(data.type){case'url':handleOpenUrl(UrlHelper.getUrlFromInput(data.url));break;}},};exports.Browser=Browser;}(window));