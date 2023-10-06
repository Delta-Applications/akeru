define([ "require", "./base", "template!./setup_fix_password.html", "./setup_fix_mixin" ], function(e) {
    return [ e("./base")(e("template!./setup_fix_password.html")), e("./setup_fix_mixin") ];
});