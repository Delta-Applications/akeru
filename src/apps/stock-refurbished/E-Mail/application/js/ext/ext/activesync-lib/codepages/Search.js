(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPSearch = t();
})(this, function() {
    return {
        Tags: {
            Search: 3845,
            Stores: 3846,
            Store: 3847,
            Name: 3848,
            Query: 3849,
            Options: 3850,
            Range: 3851,
            Status: 3852,
            Response: 3853,
            Result: 3854,
            Properties: 3855,
            Total: 3856,
            EqualTo: 3857,
            Value: 3858,
            And: 3859,
            Or: 3860,
            FreeText: 3861,
            DeepTraversal: 3863,
            LongId: 3864,
            RebuildResults: 3865,
            LessThan: 3866,
            GreaterThan: 3867,
            Schema: 3868,
            Supported: 3869,
            UserName: 3870,
            Password: 3871,
            ConversationId: 3872,
            Picture: 3873,
            MaxSize: 3874,
            MaxPictures: 3875
        },
        Enums: {
            Status: {
                Success: "1",
                InvalidRequest: "2",
                ServerError: "3",
                BadLink: "4",
                AccessDenied: "5",
                NotFound: "6",
                ConnectionFailure: "7",
                TooComplex: "8",
                Timeout: "10",
                SyncFolders: "11",
                EndOfRange: "12",
                AccessBlocked: "13",
                CredentialsRequired: "14"
            }
        }
    };
});