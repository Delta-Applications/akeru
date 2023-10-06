(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPSettings = t();
})(this, function() {
    return {
        Tags: {
            Settings: 4613,
            Status: 4614,
            Get: 4615,
            Set: 4616,
            Oof: 4617,
            OofState: 4618,
            StartTime: 4619,
            EndTime: 4620,
            OofMessage: 4621,
            AppliesToInternal: 4622,
            AppliesToExternalKnown: 4623,
            AppliesToExternalUnknown: 4624,
            Enabled: 4625,
            ReplyMessage: 4626,
            BodyType: 4627,
            DevicePassword: 4628,
            Password: 4629,
            DeviceInformation: 4630,
            Model: 4631,
            IMEI: 4632,
            FriendlyName: 4633,
            OS: 4634,
            OSLanguage: 4635,
            PhoneNumber: 4636,
            UserInformation: 4637,
            EmailAddresses: 4638,
            SmtpAddress: 4639,
            UserAgent: 4640,
            EnableOutboundSMS: 4641,
            MobileOperator: 4642,
            PrimarySmtpAddress: 4643,
            Accounts: 4644,
            Account: 4645,
            AccountId: 4646,
            AccountName: 4647,
            UserDisplayName: 4648,
            SendDisabled: 4649,
            RightsManagementInformation: 4651
        },
        Enums: {
            Status: {
                Success: "1",
                ProtocolError: "2",
                AccessDenied: "3",
                ServerError: "4",
                InvalidArguments: "5",
                ConflictingArguments: "6",
                DeniedByPolicy: "7"
            },
            OofState: {
                Disabled: "0",
                Global: "1",
                TimeBased: "2"
            }
        }
    };
});