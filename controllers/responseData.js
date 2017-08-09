var azure = require('azure-storage');
var uuid = require('node-uuid');
var entityGen = azure.TableUtilities.entityGenerator;


function ResponseData(azureTable) {
    this.modal = azureTable;
    this.getData = function(callback) {
        var query = new azure.TableQuery();
        this.modal.storageClient.queryEntities(this.modal.tableName, query, null, function entitiesQueried(error, result) {
            if(error) {
                callback(error);
            } else {
                console.log(result);
                callback(null, result.entries);
            }
        });
    }
};

module.exports = ResponseData;