(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPPing = t();
})(this, function() {
    return {
        Tags: {
            Ping: 3333,
            AutdState: 3334,
            Status: 3335,
            HeartbeatInterval: 3336,
            Folders: 3337,
            Folder: 3338,
            Id: 3339,
            Class: 3340,
            MaxFolders: 3341
        },
        Enums: {
            Status: {
                Expired: "1",
                Changed: "2",
                MissingParameters: "3",
                SyntaxError: "4",
                InvalidInterval: "5",
                TooManyFolders: "6",
                SyncFolders: "7",
                ServerError: "8"
            }
        }
    };
});