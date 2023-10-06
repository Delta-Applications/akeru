(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPItemOperations = t();
})(this, function() {
    return {
        Tags: {
            ItemOperations: 5125,
            Fetch: 5126,
            Store: 5127,
            Options: 5128,
            Range: 5129,
            Total: 5130,
            Properties: 5131,
            Data: 5132,
            Status: 5133,
            Response: 5134,
            Version: 5135,
            Schema: 5136,
            Part: 5137,
            EmptyFolderContents: 5138,
            DeleteSubFolders: 5139,
            UserName: 5140,
            Password: 5141,
            Move: 5142,
            DstFldId: 5143,
            ConversationId: 5144,
            MoveAlways: 5145
        },
        Enums: {
            Status: {
                Success: "1",
                ProtocolError: "2",
                ServerError: "3",
                BadURI: "4",
                AccessDenied: "5",
                ObjectNotFound: "6",
                ConnectionFailure: "7",
                InvalidByteRange: "8",
                UnknownStore: "9",
                EmptyFile: "10",
                DataTooLarge: "11",
                IOFailure: "12",
                ConversionFailure: "14",
                InvalidAttachment: "15",
                ResourceAccessDenied: "16"
            }
        }
    };
});