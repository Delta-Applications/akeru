navigator.mozL10n.once(function(){var e={time:4,onidle:function(){navigator.removeIdleObserver(e),navigator.mozId&&LazyLoader.load(["/shared/js/fxa_iac_client.js","/shared/js/text_normalizer.js","js/firefox_accounts/menu.js"],function(){FxaMenu.init(FxAccountsIACHelper)})}};navigator.addIdleObserver(e)});