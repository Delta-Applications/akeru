const DebugHelper=function(){let n=!1;function u(e){var n=document.location.hostname.replace(/\..*$/u,"");dump(`[${n}] ${e}`)}return{init:function(){SettingsObserver.observe("debug.gaia.enabled",!1,e=>{u(`Debug:${n=e}`)})},log:u,debug:function(e){n&&u(e)}}}();window.DebugHelper=DebugHelper;