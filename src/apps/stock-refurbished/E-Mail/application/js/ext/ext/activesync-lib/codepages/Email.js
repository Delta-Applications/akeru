(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPEmail = t();
})(this, function() {
    return {
        Tags: {
            Attachment: 517,
            Attachments: 518,
            AttName: 519,
            AttSize: 520,
            Att0Id: 521,
            AttMethod: 522,
            AttRemoved: 523,
            Body: 524,
            BodySize: 525,
            BodyTruncated: 526,
            DateReceived: 527,
            DisplayName: 528,
            DisplayTo: 529,
            Importance: 530,
            MessageClass: 531,
            Subject: 532,
            Read: 533,
            To: 534,
            Cc: 535,
            From: 536,
            ReplyTo: 537,
            AllDayEvent: 538,
            Categories: 539,
            Category: 540,
            DTStamp: 541,
            EndTime: 542,
            InstanceType: 543,
            BusyStatus: 544,
            Location: 545,
            MeetingRequest: 546,
            Organizer: 547,
            RecurrenceId: 548,
            Reminder: 549,
            ResponseRequested: 550,
            Recurrences: 551,
            Recurrence: 552,
            Recurrence_Type: 553,
            Recurrence_Until: 554,
            Recurrence_Occurrences: 555,
            Recurrence_Interval: 556,
            Recurrence_DayOfWeek: 557,
            Recurrence_DayOfMonth: 558,
            Recurrence_WeekOfMonth: 559,
            Recurrence_MonthOfYear: 560,
            StartTime: 561,
            Sensitivity: 562,
            TimeZone: 563,
            GlobalObjId: 564,
            ThreadTopic: 565,
            MIMEData: 566,
            MIMETruncated: 567,
            MIMESize: 568,
            InternetCPID: 569,
            Flag: 570,
            Status: 571,
            ContentClass: 572,
            FlagType: 573,
            CompleteTime: 574,
            DisallowNewTimeProposal: 575
        },
        Enums: {
            Importance: {
                Low: "0",
                Normal: "1",
                High: "2"
            },
            InstanceType: {
                Single: "0",
                RecurringMaster: "1",
                RecurringInstance: "2",
                RecurringException: "3"
            },
            BusyStatus: {
                Free: "0",
                Tentative: "1",
                Busy: "2",
                Oof: "3"
            },
            Recurrence_Type: {
                Daily: "0",
                Weekly: "1",
                MonthlyNthDay: "2",
                Monthly: "3",
                YearlyNthDay: "5",
                YearlyNthDayOfWeek: "6"
            },
            Sensitivity: {
                Normal: "0",
                Personal: "1",
                Private: "2",
                Confidential: "3"
            },
            Status: {
                Cleared: "0",
                Complete: "1",
                Active: "2"
            }
        }
    };
});