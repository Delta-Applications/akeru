define(["require","modules/settings_panel"],function(e){var t=e("modules/settings_panel");return function(){function e(){var e={menuClassName:"menu-button",header:{l10nId:"message"},items:[{name:"Save",l10nId:"save",priority:2,method:function(){if("#doNotTrack"===Settings._currentPanel){var e=o();null!==e&&(e.click(),i(),n())}}}]};SettingsSoftkey.init(e)}function n(){var e=document.querySelectorAll(".current [data-href]");null!==e&&void 0!==e&&(preSection=e[0].getAttribute("data-href")),null!==preSection&&void 0!==preSection&&"#root"===preSection&&(Settings.currentPanel=preSection)}function i(){var e=o();if(null!==e){var t="true"===e.value?!0:!1;if(u!==t){var n={};n["privacy.donottrackheader.enabled"]=t,navigator.mozSettings.createLock().set(n),showToast("changessaved")}}}function o(){var e=null,t=c.querySelector(".current li.focus");return null!==t&&(e=t.querySelector("input")),e}function r(e){a.querySelector("input").checked=e,s.querySelector("input").checked=!e}var a=null,s=null,c=null,u=null,d=document.querySelectorAll("#doNotTrack li");return t({onInit:function(e){a=e.querySelector(".doNotTrack-setting-DoNotTrack"),s=e.querySelector(".doNotTrack-setting-Track"),c=e},onBeforeShow:function(t){e(),ListFocusHelper.updateSoftkey(t);var n=navigator.mozSettings.createLock(),i=n.get("privacy.donottrackheader.enabled");i.onsuccess=function(){if(void 0!=i)r(i.result["privacy.donottrackheader.enabled"]),u=i.result["privacy.donottrackheader.enabled"];else{var e=navigator.mozSettings.createLock();e.set({"privacy.donottrackheader.enabled":!1}),r(!1),u=!1}},ListFocusHelper.addEventListener(d)},onBeforeHide:function(){ListFocusHelper.removeEventListener(d)}})}});