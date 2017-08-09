var request_new = require('request');
var request = require('request-promise');
var moment = require('moment');
var _ = require('lodash');

function OCChannelService() {
    var now = moment(new Date()).format();
    var year = moment(now).format("YYYY");
    
    this.getTimeStampData = function(callback) {
        var now = moment(new Date()).format();
        var year = moment(now).format("YYYY");
        var options1 = {
            method: 'GET',
            uri: 'https://www.olympicchannel.com/en/api/listing/events/calendar/',
            qs: {
                "start_date": year,
                "end_date": now
            },
            json: true
        };

        request(options1)
            .then(function (parsedBody) {
                console.log("GET Request Succeded 11");
                callback(parsedBody);
            })
            .catch(function (err) {
        });
    };

    this.getEventData = function(startDate, endDate, callback) {
        var options = {
            method: 'GET',
            uri: 'https://www.olympicchannel.com/en/api/v2/listing/events/',
            qs: {
                "year": startDate,
                "end_date": endDate
            },
            json: true
        };

        request(options)
            .then(function (parsedBody) {
                console.log("GET Request Succeded");
                console.log("Hello",parsedBody);
                console.log("Event Triggered");
                callback(parsedBody);
            })
            .catch(function (err) {

        });
    };
};

module.exports = OCChannelService;