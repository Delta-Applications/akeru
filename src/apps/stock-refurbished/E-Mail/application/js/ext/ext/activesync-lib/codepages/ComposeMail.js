(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPComposeMail = t();
})(this, function() {
    return {
        Tags: {
            SendMail: 5381,
            SmartForward: 5382,
            SmartReply: 5383,
            SaveInSentItems: 5384,
            ReplaceMime: 5385,
            Source: 5387,
            FolderId: 5388,
            ItemId: 5389,
            LongId: 5390,
            InstanceId: 5391,
            Mime: 5392,
            ClientId: 5393,
            Status: 5394,
            AccountId: 5395
        }
    };
});