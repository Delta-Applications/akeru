!function(e){var t={};function n(o){if(t[o])return t[o].exports;var s=t[o]={i:o,l:!1,exports:{}};return e[o].call(s.exports,s,s.exports,n),s.l=!0,s.exports}n.m=e,n.c=t,n.d=function(e,t,o){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:o})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var o=Object.create(null);if(n.r(o),Object.defineProperty(o,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var s in e)n.d(o,s,function(t){return e[t]}.bind(null,s));return o},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="dist/",n(n.s=589)}({589:function(e,t){window.onload=function(){window.noticeClick=null,navigator.serviceWorker.addEventListener("message",function e(t){var n=t.data;switch(n.type){case"notificationclick":window.noticeClick=n.data,navigator.serviceWorker.removeEventListener("message",e)}});var e=document.querySelector(".launcherView #current-today"),t=document.querySelector(".launcherView #launch-softkey"),n=document.querySelector(".launcherView #current-week-view"),o=document.querySelector(".launcherView #current-day-view"),s=document.querySelector(".launcherView #current-month-year-view"),a=new Date;n.textContent=a.toLocaleString(navigator.language,{weekday:"long"}),o.textContent=a.toLocaleString(navigator.language,{day:"numeric"}),s.textContent=a.toLocaleString(navigator.language,{month:"long",year:"numeric"}),e.textContent=localStorage.getItem("calendar-start-header")||"Today",t.textContent=localStorage.getItem("calendar-start-softkey")||"calendar",document.querySelector(".launcherView").focus(),setTimeout(function(){LazyLoader.load(["http://shared.localhost/js/utils/l10n/l10n.js","http://shared.localhost/js/utils/l10n/l10n_date.js","http://shared.localhost/style/commons/action_menu.css","http://shared.localhost/style/commons/option_menu.css","http://shared.localhost/style/commons/confirm.css","http://shared.localhost/style/commons/switches.css","http://shared.localhost/style/commons/buttons.css","http://shared.localhost/style/commons/progress_activity.css","http://shared.localhost/style/gaia_theme/gaia-font.css","http://shared.localhost/style/gaia_icons/gaia-icons.css","http://shared.localhost/style/commons/softkey.css","http://shared.localhost/style/commons/navigation.css","http://shared.localhost/js/session/task_scheduler.js","http://shared.localhost/js/session/lib_session.js","http://shared.localhost/js/session/settings/settings_observer.js","http://shared.localhost/js/session/time_service/time_service.js","http://shared.localhost/js/session/device_capability/device_capability.js","http://shared.localhost/js/session/apps_manager/apps_manager.js","http://shared.localhost/js/session/account_manager/account_manager.js","http://shared.localhost/js/utils/common/dump.js","http://shared.localhost/js/utils/components/component_utils.js","http://shared.localhost/js/helper/option_menu/option_menu.js","http://shared.localhost/js/helper/option_menu/option_menu_helper.js","http://shared.localhost/js/helper/softkey/softkey_panel.js","http://shared.localhost/js/helper/softkey/softkey_panel_helper.js","http://shared.localhost/js/helper/date_time/date_time_helper.js","http://shared.localhost/js/utils/toaster/toaster.js","http://shared.localhost/elements/gaia_progress/gaia_progress.js","dist/vendors.bundle.js","dist/app.bundle.js"],function(){window.libSession.initService(["settingsService","timeService","devicecapabilityService","appsService","accountsService"]).then(function(){SettingsObserver.init()}),e.setAttribute("data-l10n-id","header-today"),t.setAttribute("data-l10n-id","kai-event-calendar"),window.api.l10n.once(function(){localStorage.setItem("calendar-start-header",window.api.l10n.get("header-today")),localStorage.setItem("calendar-start-softkey",window.api.l10n.get("kai-event-calendar"))})})},100),window.addEventListener("keydown",function e(t){var n=document.getElementById("launch-view"),o=document.getElementById("root"),s=document.querySelector("#root #monthView .focus");switch(t.key){case"Enter":t.stopPropagation(),t.preventDefault(),n.classList.add("hidden"),o.classList.remove("hidden"),s&&s.focus(),window.removeEventListener("keydown",e);break;case"BrowserBack":case"Backspace":console.log("Calendar: Backspace pressed!"),window.close()}}),window.performance.mark("visuallyLoaded")}}});