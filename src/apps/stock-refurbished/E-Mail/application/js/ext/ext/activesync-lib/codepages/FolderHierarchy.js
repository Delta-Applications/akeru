(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPHierarchy = t();
})(this, function() {
    return {
        Tags: {
            Folders: 1797,
            Folder: 1798,
            DisplayName: 1799,
            ServerId: 1800,
            ParentId: 1801,
            Type: 1802,
            Response: 1803,
            Status: 1804,
            ContentClass: 1805,
            Changes: 1806,
            Add: 1807,
            Delete: 1808,
            Update: 1809,
            SyncKey: 1810,
            FolderCreate: 1811,
            FolderDelete: 1812,
            FolderUpdate: 1813,
            FolderSync: 1814,
            Count: 1815
        },
        Enums: {
            Type: {
                Generic: "1",
                DefaultInbox: "2",
                DefaultDrafts: "3",
                DefaultDeleted: "4",
                DefaultSent: "5",
                DefaultOutbox: "6",
                DefaultTasks: "7",
                DefaultCalendar: "8",
                DefaultContacts: "9",
                DefaultNotes: "10",
                DefaultJournal: "11",
                Mail: "12",
                Calendar: "13",
                Contacts: "14",
                Tasks: "15",
                Journal: "16",
                Notes: "17",
                Unknown: "18",
                RecipientCache: "19"
            },
            Status: {
                Success: "1",
                FolderExists: "2",
                SystemFolder: "3",
                FolderNotFound: "4",
                ParentFolderNotFound: "5",
                ServerError: "6",
                InvalidSyncKey: "9",
                MalformedRequest: "10",
                UnknownError: "11",
                CodeUnknown: "12"
            }
        }
    };
});