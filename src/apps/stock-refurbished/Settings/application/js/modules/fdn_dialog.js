define(["require","simcard_dialog"],function(t){var e=t("simcard_dialog"),n=function(){var t=document.querySelector("#simpin2-dialog");LazyLoader.load(t),this.pinDialog=new e(t)};n.prototype={show:function(t,e){return this.pinDialog.show(t,e)}};var i=new n;return i});