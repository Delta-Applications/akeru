define([ "require", "./base", "template!./setup_fix_gmail_twofactor.html", "./setup_fix_mixin" ], function(e) {
    return [ e("./base")(e("template!./setup_fix_gmail_twofactor.html")), e("./setup_fix_mixin") ];
});