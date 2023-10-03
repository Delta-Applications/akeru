
var CustomDialog=function(){var e=null,n=null,t=null,o=null,r=null,i=null,l=null,a=null,c=null,s=!1,u={cancel:null,confirm:null,accept:null,run:function(e){this[e]&&this[e].callback()}},d=function(e){1===CustomDialog.__version?"undefined"==typeof SoftkeyPanel?LazyLoader.load("/shared/js/softkey_panel.js",function(){SoftkeyHelper.init(e,function(){null!=c&&(SoftkeyHelper.hide(),c())})}.bind(this)):SoftkeyHelper.init(e,function(){null!=c&&(SoftkeyHelper.hide(),c())}):2===CustomDialog.__version?(OptionHelper.softkeyPanel&&OptionHelper.softkeyPanel.menuVisible&&OptionHelper.softkeyPanel.hideMenu(),OptionHelper.saveContext(),OptionHelper.optionParams._for_custom_dialog=e,OptionHelper.show("_for_custom_dialog")):3===CustomDialog.__version&&CustomDialog.softkeyPanel&&CustomDialog.softkeyPanel.initSoftKeyPanel(e)};return{hide:function(){null!==n&&(e||(e=document.body),e.removeChild(n),n=null,t=null,o=null,r=null,l=null,a=null,2===CustomDialog.__version?OptionHelper.returnContext():1===CustomDialog.__version&&SoftkeyHelper.hide(),s=!1,window.dispatchEvent(new CustomEvent("customDialogEvent",{detail:{visibility:!1}})))},show:function(m,f,p,y,v,g,h){function b(e){n.classList.remove("visible"),e.target===l&&y.callback?y.callback():e.target===a&&cancel.callback&&cancel.callback()}var k={menuClassName:"menu-button",header:{l10nId:""},items:[]};if(e=v||document.body,u.confirm=y,u.cancel=p,u.accept=g,p&&(void 0!=p.backkeyCallback&&(c=p.backkeyCallback),k.items.push({name:"Cancel",l10nId:p.title,priority:1,method:function(){1===CustomDialog.__version&&SoftkeyHelper.hide(),p.callback()}})),g&&k.items.push({name:"",l10nId:g.title,priority:2,method:function(){1===CustomDialog.__version&&SoftkeyHelper.hide(),g.callback()}}),y&&k.items.push({name:"Delete",l10nId:y.title,priority:3,method:function(){1===CustomDialog.__version&&SoftkeyHelper.hide(),i?y.callback(i):y.callback()}}),d(k),null===n){n=document.createElement("form"),n.setAttribute("role","dialog"),n.setAttribute("data-type","confirm"),n.id="dialog-screen",t=document.createElement("section"),n.appendChild(t);var C=function(e,n,t){if("string"==typeof n)return t.setAttribute("data-l10n-id",n),t;var o=n.icon,r=t;if(o&&""!==o){r=document.createElement("span");var i=new Image;i.src=o,i.classList.add("custom-dialog-"+e+"-icon"),t.insertBefore(i,t.firstChild),t.appendChild(r)}if(n.id)navigator.mozL10n.setAttributes(r,n.id,n.args);else{var l=n[e];r.textContent=l}return t},_=function(e,n){"string"==typeof n&&e.setAttribute("data-l10n-id",n),n.id&&navigator.mozL10n.setAttributes(e,n.id,n.args)};if(o=document.createElement("h1"),o.id="dialog-title",m&&""!==m&&(o=C("title",m,o,t)),t.appendChild(o),r=document.createElement("p"),r.id="dialog-message",r=C("message",f,r,t),t.appendChild(r),h&&(i=document.createElement("input"),i.setAttribute("type",h),i.setAttribute("id","custom-input"),y.input=i,t.appendChild(i)),p){var S=document.createElement("menu");S.dataset.items=1,a=document.createElement("button"),a.type="button",_(a,p.title),a.id="dialog-no",a.addEventListener("click",b),S.appendChild(a),y?(S.dataset.items=2,l=document.createElement("button"),l.type="button",_(l,y.title),l.id="dialog-yes",l.className=y.recommend?"recommend":"danger",l.addEventListener("click",b),S.appendChild(l)):a.classList.add("full")}e.appendChild(n)}return n.classList.add("visible"),s=!0,window.dispatchEvent(new CustomEvent("customDialogEvent",{detail:{visibility:!0}})),h&&i.focus(),n},runConfirm:function(){u.run("confirm")},runCancel:function(){u.cancel?u.run("cancel"):u.run("accept")},__version:1,setVersion:function(e){this.__version=e},setSoftkeyPanel:function(e){this.softkeyPanel=e},get isVisible(){return s}}}();