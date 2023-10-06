(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPMeetingResponse = t();
})(this, function() {
    return {
        Tags: {
            CalendarId: 2053,
            CollectionId: 2054,
            MeetingResponse: 2055,
            RequestId: 2056,
            Request: 2057,
            Result: 2058,
            Status: 2059,
            UserResponse: 2060,
            InstanceId: 2062
        },
        Enums: {
            Status: {
                Success: "1",
                InvalidRequest: "2",
                MailboxError: "3",
                ServerError: "4"
            },
            UserResponse: {
                Accepted: "1",
                Tentative: "2",
                Declined: "3"
            }
        }
    };
});