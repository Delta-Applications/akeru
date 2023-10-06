(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPResolveRecipients = t();
})(this, function() {
    return {
        Tags: {
            ResolveRecipients: 2565,
            Response: 2566,
            Status: 2567,
            Type: 2568,
            Recipient: 2569,
            DisplayName: 2570,
            EmailAddress: 2571,
            Certificates: 2572,
            Certificate: 2573,
            MiniCertificate: 2574,
            Options: 2575,
            To: 2576,
            CertificateRetrieval: 2577,
            RecipientCount: 2578,
            MaxCertificates: 2579,
            MaxAmbiguousRecipients: 2580,
            CertificateCount: 2581,
            Availability: 2582,
            StartTime: 2583,
            EndTime: 2584,
            MergedFreeBusy: 2585,
            Picture: 2586,
            MaxSize: 2587,
            Data: 2588,
            MaxPictures: 2589
        },
        Enums: {
            Status: {
                Success: "1",
                AmbiguousRecipientFull: "2",
                AmbiguousRecipientPartial: "3",
                RecipientNotFound: "4",
                ProtocolError: "5",
                ServerError: "6",
                InvalidSMIMECert: "7",
                CertLimitReached: "8"
            },
            CertificateRetrieval: {
                None: "1",
                Full: "2",
                Mini: "3"
            },
            MergedFreeBusy: {
                Free: "0",
                Tentative: "1",
                Busy: "2",
                Oof: "3",
                NoData: "4"
            }
        }
    };
});