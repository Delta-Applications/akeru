(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPAirSync = t();
})(this, function() {
    return {
        Tags: {
            Sync: 5,
            Responses: 6,
            Add: 7,
            Change: 8,
            Delete: 9,
            Fetch: 10,
            SyncKey: 11,
            ClientId: 12,
            ServerId: 13,
            Status: 14,
            Collection: 15,
            Class: 16,
            Version: 17,
            CollectionId: 18,
            GetChanges: 19,
            MoreAvailable: 20,
            WindowSize: 21,
            Commands: 22,
            Options: 23,
            FilterType: 24,
            Truncation: 25,
            RtfTruncation: 26,
            Conflict: 27,
            Collections: 28,
            ApplicationData: 29,
            DeletesAsMoves: 30,
            NotifyGUID: 31,
            Supported: 32,
            SoftDelete: 33,
            MIMESupport: 34,
            MIMETruncation: 35,
            Wait: 36,
            Limit: 37,
            Partial: 38,
            ConversationMode: 39,
            MaxItems: 40,
            HeartbeatInterval: 41
        },
        Enums: {
            Status: {
                Success: "1",
                InvalidSyncKey: "3",
                ProtocolError: "4",
                ServerError: "5",
                ConversionError: "6",
                MatchingConflict: "7",
                ObjectNotFound: "8",
                OutOfSpace: "9",
                HierarchyChanged: "12",
                IncompleteRequest: "13",
                InvalidInterval: "14",
                InvalidRequest: "15",
                Retry: "16"
            },
            FilterType: {
                NoFilter: "0",
                OneDayBack: "1",
                ThreeDaysBack: "2",
                OneWeekBack: "3",
                TwoWeeksBack: "4",
                OneMonthBack: "5",
                ThreeMonthsBack: "6",
                SixMonthsBack: "7",
                IncompleteTasks: "8"
            },
            Conflict: {
                ClientReplacesServer: "0",
                ServerReplacesClient: "1"
            },
            MIMESupport: {
                Never: "0",
                SMIMEOnly: "1",
                Always: "2"
            },
            MIMETruncation: {
                TruncateAll: "0",
                Truncate4K: "1",
                Truncate5K: "2",
                Truncate7K: "3",
                Truncate10K: "4",
                Truncate20K: "5",
                Truncate50K: "6",
                Truncate100K: "7",
                NoTruncate: "8"
            }
        }
    };
});