
!function(t){var e=null,n=[],r=!1,i=function(t){switch(t.type){case"screenchange":t.detail.screenEnabled||e&&e.hide();break;case"lockscreen-appopened":e&&e.hide();break;case"lockscreen-appclosed":case"wake":r&&e&&e.show();break;case"keydown":("Backspace"===t.key||"BrowserBack"===t.key)&&r&&(n.apply(null,[]),t.preventDefault())}};window.addEventListener("keydown",i),window.addEventListener("lockscreen-appopened",i),window.addEventListener("lockscreen-appclosed",i),window.addEventListener("screenchange",i),window.addEventListener("wake",i);var o={applist:[],init:function(t,i){e||(e=new SoftkeyPanel({menuClassName:"menu-button",items:[{name:"create",priority:1,method:function(){}}]})),e.initSoftKeyPanel(t),e.show(),n=i||function(){},r=!0},updateSoftkey:function(t,n,r){switch(n){case"1":t.items[0].l10nId=r;break;case"3":t.items[1].l10nId=r}e&&e.initSoftKeyPanel(t)},show:function(){e&&e.show()},onlyHide:function(){e&&e.hide()},hide:function(t){e&&e.hide(),n=function(){},r=!1;for(var i=0;i<this.applist.length;i++)if(this.applist[i].name==t){this.applist.splice(i,1),0==i&&this.applist.length>0&&void 0!=this.applist[0].appliacation.front&&this.applist[0].appliacation.front();break}},getSoftkey:function(){return e},register:function(t,e){for(var n=0;n<this.applist.length;n++)if(this.applist[n].name==e)return;var r={appliacation:t,name:e};this.applist.length>0&&void 0!=this.applist[0].appliacation.back&&this.applist[0].appliacation.back(),this.applist.unshift(r)}};t.SoftkeyHelper=o}(this);