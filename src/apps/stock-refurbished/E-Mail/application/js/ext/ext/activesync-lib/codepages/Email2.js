(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPEmail2 = t();
})(this, function() {
    return {
        Tags: {
            UmCallerID: 5637,
            UmUserNotes: 5638,
            UmAttDuration: 5639,
            UmAttOrder: 5640,
            ConversationId: 5641,
            ConversationIndex: 5642,
            LastVerbExecuted: 5643,
            LastVerbExecutionTime: 5644,
            ReceivedAsBcc: 5645,
            Sender: 5646,
            CalendarType: 5647,
            IsLeapMonth: 5648,
            AccountId: 5649,
            FirstDayOfWeek: 5650,
            MeetingMessageType: 5651
        },
        Enums: {
            LastVerbExecuted: {
                Unknown: "0",
                ReplyToSender: "1",
                ReplyToAll: "2",
                Forward: "3"
            },
            CalendarType: {
                Default: "0",
                Gregorian: "1",
                GregorianUS: "2",
                Japan: "3",
                Taiwan: "4",
                Korea: "5",
                Hijri: "6",
                Thai: "7",
                Hebrew: "8",
                GregorianMeFrench: "9",
                GregorianArabic: "10",
                GregorianTranslatedEnglish: "11",
                GregorianTranslatedFrench: "12",
                JapaneseLunar: "14",
                ChineseLunar: "15",
                KoreanLunar: "20"
            },
            FirstDayOfWeek: {
                Sunday: "0",
                Monday: "1",
                Tuesday: "2",
                Wednesday: "3",
                Thursday: "4",
                Friday: "5",
                Saturday: "6"
            },
            MeetingMessageType: {
                Unspecified: "0",
                InitialRequest: "1",
                FullUpdate: "2",
                InformationalUpdate: "3",
                Outdated: "4",
                DelegatorsCopy: "5",
                Delegated: "6"
            }
        }
    };
});