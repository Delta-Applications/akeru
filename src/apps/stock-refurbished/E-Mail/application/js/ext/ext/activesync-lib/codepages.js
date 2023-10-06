(function(e, t) {
    "object" == typeof exports && (define = function(e, t) {
        e = e.map.forEach(function(e) {
            return require(e);
        }), module.exports = t(e);
    }, define.amd = {}), "function" == typeof define && define.amd ? define([ "wbxml", "./codepages/Common", "./codepages/AirSync", "./codepages/Contacts", "./codepages/Email", "./codepages/Calendar", "./codepages/Move", "./codepages/ItemEstimate", "./codepages/FolderHierarchy", "./codepages/MeetingResponse", "./codepages/Tasks", "./codepages/ResolveRecipients", "./codepages/ValidateCert", "./codepages/Contacts2", "./codepages/Ping", "./codepages/Provision", "./codepages/Search", "./codepages/GAL", "./codepages/AirSyncBase", "./codepages/Settings", "./codepages/DocumentLibrary", "./codepages/ItemOperations", "./codepages/ComposeMail", "./codepages/Email2", "./codepages/Notes", "./codepages/RightsManagement" ], t) : e.ActiveSyncCodepages = t(WBXML, ASCPCommon, ASCPAirSync, ASCPContacts, ASCPEmail, ASCPCalendar, ASCPMove, ASCPItemEstimate, ASCPHierarchy, ASCPMeetingResponse, ASCPTasks, ASCPResolveRecipients, ASCPValidateCert, ASCPContacts2, ASCPPing, ASCPProvision, ASCPSearch, ASCPGAL, ASCPAirSyncBase, ASCPSettings, ASCPDocumentLibrary, ASCPItemOperations, ASCPComposeMail, ASCPEmail2, ASCPNotes, ASCPRightsManagement);
})(this, function(e, t, n, r, i, o, s, a, u, c, l, d, f, h, p, m, g, y, _, v, b, w, A, S, T, C) {
    var I = {
        Common: t,
        AirSync: n,
        Contacts: r,
        Email: i,
        Calendar: o,
        Move: s,
        ItemEstimate: a,
        FolderHierarchy: u,
        MeetingResponse: c,
        Tasks: l,
        ResolveRecipients: d,
        ValidateCert: f,
        Contacts2: h,
        Ping: p,
        Provision: m,
        Search: g,
        GAL: y,
        AirSyncBase: _,
        Settings: v,
        DocumentLibrary: b,
        ItemOperations: w,
        ComposeMail: A,
        Email2: S,
        Notes: T,
        RightsManagement: C
    };
    return e.CompileCodepages(I), I;
});