(function(e, t) {
    "object" == typeof exports ? module.exports = t() : "function" == typeof define && define.amd ? define([], t) : e.ASCPItemEstimate = t();
})(this, function() {
    return {
        Tags: {
            GetItemEstimate: 1541,
            Version: 1542,
            Collections: 1543,
            Collection: 1544,
            Class: 1545,
            CollectionId: 1546,
            DateTime: 1547,
            Estimate: 1548,
            Response: 1549,
            Status: 1550
        },
        Enums: {
            Status: {
                Success: "1",
                InvalidCollection: "2",
                NoSyncState: "3",
                InvalidSyncKey: "4"
            }
        }
    };
});